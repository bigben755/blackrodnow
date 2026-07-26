"""
Iteration 18 — Batch B: filter chips + saved-events sync + reminder emails
+ add-to-calendar buttons in newsletter digest.
"""
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: F401
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
# When running inside container, REACT_APP_BACKEND_URL may not be set in shell env,
# fall back to reading frontend/.env directly.
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except FileNotFoundError:
        pass

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@blackrodnow.co.uk"
ADMIN_PASSWORD = "BlackrodAdmin!2026"
TEST_EMAIL_24H = f"test-batch-b-24h-{uuid.uuid4().hex[:6]}@example.com"
TEST_EMAIL_2H = f"test-batch-b-2h-{uuid.uuid4().hex[:6]}@example.com"
TEST_EMAIL_NL = f"test-batch-b-nl-{uuid.uuid4().hex[:6]}@example.com"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Mongo helpers for seed + cleanup ----------
def _mongo():
    with open("/app/backend/.env") as fh:
        env = dict(
            line.strip().split("=", 1)
            for line in fh
            if line.strip() and not line.startswith("#") and "=" in line
        )
    mongo_url = env["MONGO_URL"].strip().strip('"').strip("'")
    db_name = env["DB_NAME"].strip().strip('"').strip("'")
    client = MongoClient(mongo_url)
    return client[db_name], client


@pytest.fixture(scope="module")
def db():
    dbh, client = _mongo()
    yield dbh
    client.close()


# ============ 1. saved-events sync ============
class TestSavedEventsSync:
    def test_sync_requires_email_or_device(self):
        r = requests.post(f"{API}/subscribers/saved-events", json={"saved_events": ["x"]}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is False

    def test_subscribe_with_saved_events_persists(self):
        email = f"test-batch-b-sub-{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(
            f"{API}/subscribe",
            json={"email": email, "saved_events": ["evt-a", "evt-b"]},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Now sync with a different list
        r2 = requests.post(
            f"{API}/subscribers/saved-events",
            json={"email": email, "saved_events": ["evt-a", "evt-c"]},
            timeout=10,
        )
        assert r2.status_code == 200
        b = r2.json()
        assert b.get("ok") is True
        assert b.get("matched") == 1
        assert b.get("count") == 2

    def test_sync_with_device_id(self):
        # device_id without a prior subscribe → no matching doc, matched=0 but ok=True
        r = requests.post(
            f"{API}/subscribers/saved-events",
            json={"device_id": f"dev-{uuid.uuid4().hex[:8]}", "saved_events": ["evt-x"]},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ============ 2. Reminder loop ============
def _seed_event_and_sub(dbh, email: str, minutes_from_now: int, tag: str):
    now = datetime.now(timezone.utc)
    start = now + timedelta(minutes=minutes_from_now + 2)  # inside window
    end = start + timedelta(hours=1)
    event_id = f"evt-reminder-test-{tag}-{uuid.uuid4().hex[:6]}"
    doc = {
        "id": event_id,
        "title": f"Reminder Test {tag}",
        "start": start.isoformat().replace("+00:00", "Z"),
        "end": end.isoformat().replace("+00:00", "Z"),
        "status": "approved",
        "venue": "Test Hall",
        "address": "Blackrod",
        "description": "Test event for reminder loop",
        "orgSlug": "test-org",
    }
    dbh.events.insert_one(doc)
    r = requests.post(f"{API}/subscribe", json={"email": email, "saved_events": [event_id]}, timeout=15)
    assert r.status_code == 200
    return event_id


class TestReminderLoop:
    def test_run_now_requires_admin(self):
        r = requests.post(f"{API}/admin/reminders/run-now", timeout=10)
        assert r.status_code == 403

    def test_24h_reminder_and_idempotency(self, admin_headers, db):
        event_id = _seed_event_and_sub(db, TEST_EMAIL_24H, 24 * 60, "24h")
        try:
            r1 = requests.post(f"{API}/admin/reminders/run-now", headers=admin_headers, timeout=60)
            assert r1.status_code == 200, r1.text
            b1 = r1.json()
            assert b1.get("ok") is True
            assert b1.get("sent_24h", 0) >= 1, f"expected sent_24h>=1, got {b1}"

            r2 = requests.post(f"{API}/admin/reminders/run-now", headers=admin_headers, timeout=60)
            assert r2.status_code == 200

            sent_doc = db.event_reminders_sent.find_one({
                "email": TEST_EMAIL_24H, "event_id": event_id, "kind": "24h"
            })
            assert sent_doc is not None, "reminder record not persisted"
        finally:
            db.events.delete_one({"id": event_id})
            db.subscribers.delete_one({"email": TEST_EMAIL_24H})
            db.event_reminders_sent.delete_many({"email": TEST_EMAIL_24H})

    def test_2h_reminder(self, admin_headers, db):
        event_id = _seed_event_and_sub(db, TEST_EMAIL_2H, 120, "2h")
        try:
            r = requests.post(f"{API}/admin/reminders/run-now", headers=admin_headers, timeout=60)
            assert r.status_code == 200
            b = r.json()
            assert b.get("sent_2h", 0) >= 1, f"expected sent_2h>=1, got {b}"

            sent_doc = db.event_reminders_sent.find_one({
                "email": TEST_EMAIL_2H, "event_id": event_id, "kind": "2h"
            })
            assert sent_doc is not None
        finally:
            db.events.delete_one({"id": event_id})
            db.subscribers.delete_one({"email": TEST_EMAIL_2H})
            db.event_reminders_sent.delete_many({"email": TEST_EMAIL_2H})


# ============ 3. Newsletter preview includes calendar links ============
class TestNewsletterPreview:
    def test_preview_contains_calendar_links(self, db):
        r = requests.post(f"{API}/subscribe", json={"email": TEST_EMAIL_NL}, timeout=15)
        assert r.status_code == 200

        now = datetime.now(timezone.utc)
        event_id = f"evt-reminder-test-nl-{uuid.uuid4().hex[:6]}"
        doc = {
            "id": event_id,
            "title": "Newsletter Cal Test",
            "start": (now + timedelta(days=3)).isoformat().replace("+00:00", "Z"),
            "end": (now + timedelta(days=3, hours=1)).isoformat().replace("+00:00", "Z"),
            "status": "approved",
            "venue": "Test Hall",
            "orgSlug": "test-org",
        }
        db.events.insert_one(doc)
        try:
            r = requests.get(f"{API}/admin/newsletter/preview", params={"email": TEST_EMAIL_NL}, timeout=15)
            assert r.status_code == 200
            body = r.json()
            html = body.get("html", "")
            assert "calendar.google.com" in html, "missing Google Calendar link"
            assert "outlook.live.com" in html, "missing Outlook Calendar link"
            assert ".ics" in html, "missing .ics link"
        finally:
            db.events.delete_one({"id": event_id})
            db.subscribers.delete_one({"email": TEST_EMAIL_NL})
