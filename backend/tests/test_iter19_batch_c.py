"""Iter19 — Batch C: recurring events, duplicate, poster PNG/PDF, org analytics v2."""
import os
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@blackrodnow.co.uk")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "BlackrodAdmin!2026")

TEST_ORG_SLUG = "horwich-blackrod-community-events-cic"


@pytest.fixture(scope="module")
def admin_jwt():
    r = requests.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_jwt):
    return {"X-Org-Auth": f"Bearer {admin_jwt}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def source_event(admin_headers):
    """Create a real source event we can duplicate, patch recurrence on, poster, etc."""
    start = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=3, hours=2)).isoformat()
    payload = {
        "title": "TEST_Batch C Source Event",
        "orgSlug": TEST_ORG_SLUG,
        "category": "Community",
        "start": start,
        "end": end,
        "venue": "Test Hall",
        "address": "1 Test Rd",
        "description": "Iter19 Batch C source",
        "status": "approved",
    }
    r = requests.post(f"{API}/events", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    ev = r.json()
    yield ev
    # Teardown: delete this event + any Copy of clones
    from pymongo import MongoClient
    mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    mdb.events.delete_one({"id": ev["id"]})
    mdb.events.delete_many({"title": {"$regex": "^Copy of TEST_"}})
    mdb.analytics_events.delete_many({"entity_id": ev["id"]})


# ─────────── Duplicate ───────────
class TestDuplicate:
    def test_duplicate_returns_new_event(self, source_event, admin_headers):
        src_id = source_event["id"]
        r = requests.post(f"{API}/events/{src_id}/duplicate", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        new_ev = r.json()
        assert new_ev["id"] != src_id
        assert new_ev["title"].startswith("Copy of ")
        assert new_ev["title"] == f"Copy of {source_event['title']}"
        assert new_ev["start"] == ""
        assert new_ev["end"] == ""
        assert new_ev["status"] == "approved"  # admin caller
        assert new_ev.get("recurrence") in (None, {"freq": "none"})
        # Verify it appears in GET /api/events (include pending to be safe)
        g = requests.get(f"{API}/events?include_pending=true&expand_recurring=false", timeout=15)
        assert g.status_code == 200
        ids = {e["id"] for e in g.json()}
        assert new_ev["id"] in ids


# ─────────── Recurring events ───────────
class TestRecurring:
    def test_patch_recurrence_and_expand(self, source_event, admin_headers):
        src_id = source_event["id"]
        patch = {"recurrence": {"freq": "weekly", "until": "2026-12-31T23:59:59Z"}}
        r = requests.patch(f"{API}/events/{src_id}", json=patch, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated.get("recurrence") is not None, f"recurrence not persisted on PATCH: {updated}"
        assert updated["recurrence"].get("freq") == "weekly"

        # Expand: default expand_recurring=true → should get master + weekly instances
        g_exp = requests.get(f"{API}/events?include_pending=true", timeout=15)
        assert g_exp.status_code == 200
        exp = [e for e in g_exp.json() if e["id"] == src_id or e.get("parent_id") == src_id]
        assert len(exp) >= 3, f"Expected multiple weekly instances, got {len(exp)}"
        instances = [e for e in exp if e.get("parent_id") == src_id]
        assert len(instances) >= 1
        # id format `parent__YYYY-MM-DD`
        for inst in instances:
            assert inst["id"].startswith(f"{src_id}__")
            assert len(inst["id"].split("__")[1]) == 10  # date
            assert inst.get("is_recurrence_instance") is True

        # expand_recurring=false → only master
        g_flat = requests.get(f"{API}/events?include_pending=true&expand_recurring=false", timeout=15)
        flat = [e for e in g_flat.json() if e["id"] == src_id or e.get("parent_id") == src_id]
        assert len(flat) == 1
        assert flat[0]["id"] == src_id

    def test_get_instance_by_virtual_id(self, source_event, admin_headers):
        src_id = source_event["id"]
        # Recurrence already set by previous test. Pick a date reachable within 180d horizon from source start.
        src_start = datetime.fromisoformat(source_event["start"].replace("Z", "+00:00"))
        # An instance ~5 weeks later
        target_date = (src_start + timedelta(days=35)).date().isoformat()
        vid = f"{src_id}__{target_date}"
        r = requests.get(f"{API}/events/{vid}", timeout=15)
        assert r.status_code == 200, r.text
        inst = r.json()
        assert inst["id"] == vid
        assert inst["parent_id"] == src_id
        assert inst["start"][:10] == target_date

    def test_clear_recurrence(self, source_event, admin_headers):
        src_id = source_event["id"]
        r = requests.patch(f"{API}/events/{src_id}", json={"recurrence": None}, headers=admin_headers, timeout=15)
        assert r.status_code == 200


# ─────────── Poster PNG / PDF ───────────
class TestPoster:
    def test_poster_png(self, source_event):
        r = requests.get(f"{API}/events/{source_event['id']}/poster.png", timeout=30)
        assert r.status_code == 200, r.text[:200]
        assert r.headers["content-type"].startswith("image/png")
        assert r.content[:4] == b"\x89PNG"
        assert len(r.content) > 20 * 1024, f"PNG too small: {len(r.content)} bytes"

    def test_poster_pdf(self, source_event):
        r = requests.get(f"{API}/events/{source_event['id']}/poster.pdf", timeout=30)
        assert r.status_code == 200, r.text[:200]
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:4] == b"%PDF"


# ─────────── Org analytics v2 ───────────
class TestOrgAnalyticsV2:
    def test_analytics_shape_and_track_updates_totals(self, source_event):
        slug = TEST_ORG_SLUG
        # 1. Baseline
        r1 = requests.get(f"{API}/orgs/{slug}/analytics?days=30", timeout=15)
        assert r1.status_code == 200, r1.text
        base = r1.json()
        assert base["slug"] == slug
        assert base["window_days"] == 30
        assert isinstance(base["series"], list) and len(base["series"]) == 30
        row0 = base["series"][0]
        for k in ("day", "event_views", "org_views", "share_clicks", "volunteer_contacts"):
            assert k in row0
        assert "totals" in base
        base_ev = base["totals"]["event_views"]

        # 2. Fire enough analytics_track events to make our source event the best
        for _ in range(5):
            tr = requests.post(
                f"{API}/analytics/track",
                json={"kind": "event_view", "entity_id": source_event["id"], "org_slug": slug, "entity_type": "event"},
                timeout=15,
            )
            assert tr.status_code == 200
        time.sleep(1)

        # 3. Verify totals bumped + best_event picked up
        r2 = requests.get(f"{API}/orgs/{slug}/analytics?days=30", timeout=15)
        after = r2.json()
        assert after["totals"]["event_views"] >= base_ev + 5, f"totals not updated: {after['totals']}"
        best = after.get("best_event")
        # best may be some other event with even more views; still assert shape
        assert best is None or ("id" in best and "views" in best and "title" in best)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
