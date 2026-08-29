"""AI accuracy audit — approval queue endpoints (no LLM calls needed)."""
import os
import uuid

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(os.environ["MONGO_URL"])
    yield client[os.environ["DB_NAME"]]
    client.close()


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(
        f"{API}/auth/admin/login",
        json={"email": "admin@blackrodnow.co.uk", "password": "BlackrodAdmin!2026"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _seed(db, changes):
    eid = f"evt-audit-test-{uuid.uuid4().hex[:8]}"
    db.events.insert_one({
        "id": eid,
        "title": "AI Audit Test Event",
        "orgSlug": "blackrod-town-council",
        "category": "Community",
        "start": "2027-03-01T10:00:00",
        "end": "2027-03-01T11:00:00",
        "venue": "Old Hall",
        "status": "approved",
    })
    pid = f"prop-{uuid.uuid4().hex[:8]}"
    db.event_edit_proposals.insert_one({
        "id": pid,
        "event_id": eid,
        "event_title": "AI Audit Test Event",
        "org_slug": "blackrod-town-council",
        "verdict": "needs_attention",
        "summary": "test",
        "changes": changes,
        "sources": [],
        "status": "pending",
        "created_at": "2026-06-25T00:00:00",
    })
    return eid, pid


def _cleanup(db, eid, pid):
    db.events.delete_one({"id": eid})
    db.event_edit_proposals.delete_one({"id": pid})


def test_requires_admin_auth():
    assert requests.get(f"{API}/admin/event-edit-proposals", timeout=10).status_code == 403
    assert requests.post(f"{API}/admin/events/audit", json={"mode": "new"}, timeout=10).status_code == 403


def test_approve_subset_applies_only_ticked_fields(db, admin_headers):
    eid, pid = _seed(db, [
        {"field": "venue", "old": "Old Hall", "new": "New Hall", "evidence": "site says", "source_url": "https://example.org"},
        {"field": "cost", "old": "", "new": "£5", "evidence": "", "source_url": ""},
    ])
    try:
        listed = requests.get(f"{API}/admin/event-edit-proposals", headers=admin_headers, timeout=10).json()
        assert any(p["id"] == pid for p in listed)

        r = requests.post(
            f"{API}/admin/event-edit-proposals/{pid}/approve",
            json={"fields": ["venue"]},
            headers=admin_headers,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json()["applied"] == ["venue"]

        ev = db.events.find_one({"id": eid})
        assert ev["venue"] == "New Hall"
        assert ev.get("cost") in (None, "")  # unticked field untouched

        prop = db.event_edit_proposals.find_one({"id": pid})
        assert prop["status"] == "approved"
        assert prop["applied_fields"] == ["venue"]

        # already decided → 404
        r2 = requests.post(
            f"{API}/admin/event-edit-proposals/{pid}/approve",
            json={},
            headers=admin_headers,
            timeout=10,
        )
        assert r2.status_code == 404
    finally:
        _cleanup(db, eid, pid)


def test_reject_marks_rejected_without_touching_event(db, admin_headers):
    eid, pid = _seed(db, [{"field": "venue", "old": "Old Hall", "new": "Elsewhere", "evidence": "", "source_url": ""}])
    try:
        r = requests.post(f"{API}/admin/event-edit-proposals/{pid}/reject", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        assert db.events.find_one({"id": eid})["venue"] == "Old Hall"
        assert db.event_edit_proposals.find_one({"id": pid})["status"] == "rejected"
    finally:
        _cleanup(db, eid, pid)


def test_approve_guards_end_before_start(db, admin_headers):
    eid, pid = _seed(db, [{"field": "end", "old": "2027-03-01T11:00:00", "new": "2027-03-01T09:00:00", "evidence": "", "source_url": ""}])
    try:
        r = requests.post(
            f"{API}/admin/event-edit-proposals/{pid}/approve",
            json={"fields": ["end"]},
            headers=admin_headers,
            timeout=10,
        )
        assert r.status_code == 400
        assert db.events.find_one({"id": eid})["end"] == "2027-03-01T11:00:00"
    finally:
        _cleanup(db, eid, pid)


def test_audit_status_endpoint(admin_headers):
    r = requests.get(f"{API}/admin/events/audit/status", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert "pending_proposals" in body


def test_approve_org_change_applies_org_slug(db, admin_headers):
    eid, pid = _seed(db, [{
        "field": "orgSlug", "old": "blackrod-town-council", "new": "st-katharines-church",
        "old_display": "Blackrod Town Council", "new_display": "St Katharine's Church",
        "evidence": "Official page credits St Katharine's", "source_url": "https://example.org",
    }])
    try:
        r = requests.post(
            f"{API}/admin/event-edit-proposals/{pid}/approve",
            json={"fields": ["orgSlug"]},
            headers=admin_headers,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert db.events.find_one({"id": eid})["orgSlug"] == "st-katharines-church"
    finally:
        _cleanup(db, eid, pid)
