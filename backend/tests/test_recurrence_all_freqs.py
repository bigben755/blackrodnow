"""Recurrence expansion — verifies daily / weekly / biweekly / monthly / annually."""
import os
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
def admin_headers():
    r = requests.post(
        f"{API}/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200
    return {"X-Org-Auth": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


def _create_event(admin_headers, freq, until=None):
    start = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0)
    end = start + timedelta(hours=1)
    rec = {"freq": freq}
    if until:
        rec["until"] = until
    payload = {
        "title": f"TEST_Recur {freq}",
        "orgSlug": TEST_ORG_SLUG,
        "category": "Community",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "venue": "Blackrod",
        "description": "recurrence test",
        "status": "approved",
        "recurrence": rec,
    }
    r = requests.post(f"{API}/events", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.mark.parametrize("freq,min_instances", [
    ("daily", 5),      # 180-day horizon, capped at 60
    ("weekly", 5),
    ("biweekly", 3),
    ("monthly", 2),
    ("annually", 1),
])
def test_recurrence_expansion(admin_headers, freq, min_instances):
    eid = _create_event(admin_headers, freq)
    try:
        # Fetch full events feed with expansion, then count matches
        r = requests.get(f"{API}/events", timeout=15)
        assert r.status_code == 200
        events = r.json()
        matches = [e for e in events if e.get("id") == eid or e.get("parent_id") == eid]
        assert len(matches) >= min_instances, f"{freq}: got {len(matches)}"
    finally:
        requests.delete(f"{API}/events/{eid}", headers=admin_headers, timeout=15)


def test_none_creates_single_instance(admin_headers):
    eid = _create_event(admin_headers, "none")
    try:
        r = requests.get(f"{API}/events", timeout=15)
        events = r.json()
        matches = [e for e in events if e.get("id") == eid or e.get("parent_id") == eid]
        assert len(matches) == 1
    finally:
        requests.delete(f"{API}/events/{eid}", headers=admin_headers, timeout=15)
