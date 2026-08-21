"""Durable parse-job resilience — recovery mode + checkpoint resume."""
import os
import time
import uuid
import requests
import pymongo
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
db = pymongo.MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

SAMPLE_TEXT = "Blackrod Quiz Night, Friday 10 October 2026, 8pm at the Village Club. £2 entry."


def _now():
    return datetime.now(timezone.utc).isoformat()


def _insert_job(texts, attempts=0, partial_docs=None):
    job_id = str(uuid.uuid4())
    doc = {
        "id": job_id,
        "status": "queued",
        "total": len(texts),
        "done": 0,
        "current": "Waiting for parser",
        "error": None,
        "source_org_slug": "",
        "file_count": 0,
        "url_count": 0,
        "text_count": len(texts),
        "attempts": attempts,
        "recoveries": 0,
        "created_at": _now(),
        "updated_at": _now(),
    }
    if partial_docs is not None:
        doc["partial_docs"] = partial_docs
    db.parse_jobs.insert_one(doc)
    rows = []
    for i, t in enumerate(texts):
        rows.append({
            "id": str(uuid.uuid4()), "job_id": job_id, "order": i, "kind": "text",
            "value": t, "created_at": _now(), "expires_at": datetime.now(timezone.utc),
        })
    db.parse_job_sources.insert_many(rows)
    return job_id


def _wait_done(job_id, timeout=120):
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = requests.get(f"{API}/admin/documents/parse-jobs/{job_id}", timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        if j["status"] in ("done", "failed"):
            return j
        time.sleep(2)
    raise AssertionError("job did not finish in time")


def _cleanup(job_id):
    db.parse_jobs.delete_one({"id": job_id})
    db.parse_job_sources.delete_many({"job_id": job_id})


def test_normal_job_completes():
    r = requests.post(f"{API}/admin/documents/parse-jobs", data={"texts_json": f'["{SAMPLE_TEXT}"]'}, timeout=30)
    assert r.status_code == 200, r.text
    job_id = r.json()["job_id"]
    try:
        j = _wait_done(job_id)
        assert j["status"] == "done", j.get("error")
        assert len(j["result"]["documents"]) == 1
        assert j["result"]["documents"][0]["items"]
    finally:
        _cleanup(job_id)


def test_recovery_mode_after_repeated_attempts():
    """A job on its final attempts completes WITHOUT the LLM (no more 'stopped after 5 attempts')."""
    max_attempts = int(os.environ.get("PARSE_JOB_MAX_ATTEMPTS", "5"))
    job_id = _insert_job([SAMPLE_TEXT], attempts=max_attempts - 1)
    try:
        j = _wait_done(job_id)
        assert j["status"] == "done", j.get("error")
        doc = j["result"]["documents"][0]
        assert any("recovery mode" in w for w in doc["warnings"]), doc["warnings"]
        assert doc["items"], "recovery mode must still produce reviewable items"
        assert doc["items"][0].get("title")
    finally:
        _cleanup(job_id)


def test_checkpoint_resume_skips_completed_sources():
    """partial_docs from a crashed attempt are kept and only remaining sources are parsed."""
    pre = {
        "filename": "pasted-text-1.txt",
        "source_type": "text",
        "text_excerpt": "checkpointed already",
        "warnings": ["from previous attempt"],
        "items": [],
    }
    job_id = _insert_job([SAMPLE_TEXT, "Blackrod coffee morning every Tuesday 10am at the Library."], attempts=1, partial_docs=[pre])
    try:
        j = _wait_done(job_id)
        assert j["status"] == "done", j.get("error")
        docs = j["result"]["documents"]
        assert len(docs) == 2, f"expected 2 docs, got {len(docs)}"
        assert docs[0]["text_excerpt"] == "checkpointed already"
        assert "from previous attempt" in docs[0]["warnings"]
        assert docs[1]["items"], "second source must be freshly parsed"
        assert "partial_docs" not in j, "polling response must not leak checkpoints"
    finally:
        _cleanup(job_id)
