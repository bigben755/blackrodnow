"""Advanced recurrence — interval, monthly_weekday, extra one-off dates."""
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


def _create_event(admin_headers, recurrence, title="TEST_AdvRecur"):
    start = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0)
    end = start + timedelta(hours=1)
    payload = {
        "title": title,
        "orgSlug": TEST_ORG_SLUG,
        "category": "Community",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "venue": "Blackrod",
        "description": "advanced recurrence test",
        "status": "approved",
        "recurrence": recurrence,
    }
    r = requests.post(f"{API}/events", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["id"], start


def _create_event_at(admin_headers, recurrence, start, title="TEST_AdvRecur_At"):
    end = start + timedelta(hours=1)
    payload = {
        "title": title,
        "orgSlug": TEST_ORG_SLUG,
        "category": "Community",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "venue": "Blackrod",
        "description": "advanced recurrence test",
        "status": "approved",
        "recurrence": recurrence,
    }
    r = requests.post(f"{API}/events", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["id"], start


def _instances(eid):
    r = requests.get(f"{API}/events", timeout=15)
    assert r.status_code == 200
    return sorted(
        [e for e in r.json() if e.get("id") == eid or e.get("parent_id") == eid],
        key=lambda e: e["start"],
    )


def test_weekly_interval_3(admin_headers):
    eid, start = _create_event(admin_headers, {"freq": "weekly", "interval": 3})
    try:
        matches = _instances(eid)
        assert len(matches) >= 3
        d0 = datetime.fromisoformat(matches[0]["start"])
        d1 = datetime.fromisoformat(matches[1]["start"])
        assert (d1 - d0).days == 21, f"expected 21-day gap, got {(d1 - d0).days}"
    finally:
        requests.delete(f"{API}/admin/events/{eid}", headers=admin_headers, timeout=15)


def test_monthly_weekday(admin_headers):
    eid, start = _create_event(admin_headers, {"freq": "monthly_weekday"})
    try:
        matches = _instances(eid)
        assert len(matches) >= 3
        nth = (start.day - 1) // 7 + 1
        for m in matches:
            d = datetime.fromisoformat(m["start"])
            assert d.weekday() == start.weekday(), f"weekday mismatch on {m['start']}"
            assert (d.day - 1) // 7 + 1 in (nth, nth - 1), f"nth mismatch on {m['start']}"
    finally:
        requests.delete(f"{API}/admin/events/{eid}", headers=admin_headers, timeout=15)


def test_monthly_weekday_old_anchor_still_has_future_instances(admin_headers):
    old_start = datetime(2012, 1, 5, 10, 30, tzinfo=timezone.utc)  # first Thursday anchor
    eid, _ = _create_event_at(admin_headers, {"freq": "monthly_weekday"}, old_start, title="TEST_OldMonthlyWeekday")
    try:
        matches = _instances(eid)
        now = datetime.now()
        future = [m for m in matches if datetime.fromisoformat(m["start"][:19]) >= now - timedelta(days=1)]
        assert future, "expected at least one upcoming recurrence instance from old monthly_weekday anchor"
    finally:
        requests.delete(f"{API}/admin/events/{eid}", headers=admin_headers, timeout=15)


def test_extra_dates_only(admin_headers):
    d1 = (datetime.now(timezone.utc) + timedelta(days=10)).date().isoformat()
    d2 = (datetime.now(timezone.utc) + timedelta(days=25)).date().isoformat()
    eid, start = _create_event(admin_headers, {"freq": "none", "extra_dates": [d1, d2]})
    try:
        matches = _instances(eid)
        assert len(matches) == 3, f"expected original + 2 extras, got {len(matches)}"
        dates = {m["start"][:10] for m in matches}
        assert d1 in dates and d2 in dates
        # time-of-day preserved on extras
        for m in matches:
            assert m["start"][11:16] == matches[0]["start"][11:16]
    finally:
        requests.delete(f"{API}/admin/events/{eid}", headers=admin_headers, timeout=15)


def test_weekly_plus_extra_date(admin_headers):
    extra = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()
    until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    eid, start = _create_event(admin_headers, {"freq": "weekly", "until": until, "extra_dates": [extra]})
    try:
        matches = _instances(eid)
        dates = {m["start"][:10] for m in matches}
        assert extra in dates, "extra date missing from weekly expansion"
        assert len(matches) >= 5  # ~4 weekly + 1 extra
    finally:
        requests.delete(f"{API}/admin/events/{eid}", headers=admin_headers, timeout=15)


def test_virtual_instance_detail_fetch(admin_headers):
    """A virtual instance id (parent__YYYY-MM-DD) resolves via GET /events/{id}."""
    extra = (datetime.now(timezone.utc) + timedelta(days=12)).date().isoformat()
    eid, start = _create_event(admin_headers, {"freq": "none", "extra_dates": [extra]})
    try:
        r = requests.get(f"{API}/events/{eid}__{extra}", timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["start"][:10] == extra
    finally:
        requests.delete(f"{API}/admin/events/{eid}", headers=admin_headers, timeout=15)


def test_naive_start_with_z_suffixed_until_does_not_500(admin_headers):
    """Regression: naive wall-clock start + Z-suffixed until must not crash /api/events."""
    start = (datetime.now() + timedelta(days=3)).replace(hour=10, minute=0, second=0, microsecond=0)
    until = (start + timedelta(days=28)).strftime("%Y-%m-%dT23:59:59Z")
    eid, _ = _create_event_at(
        admin_headers,
        {"freq": "weekly", "until": until},
        start,
        title="TEST_NaiveStartZUntil",
    )
    try:
        inst = _instances(eid)
        assert len(inst) >= 4, [e["start"] for e in inst]
        assert all("T10:00" in e["start"] for e in inst)
    finally:
        requests.delete(f"{API}/admin/events/{eid}", headers=admin_headers, timeout=15)


def test_naive_until_matches_naive_start(admin_headers):
    """New UI saves until as naive string — expansion must respect it."""
    start = (datetime.now() + timedelta(days=2)).replace(hour=9, minute=30, second=0, microsecond=0)
    until = (start + timedelta(days=21)).strftime("%Y-%m-%dT23:59:59")
    eid, _ = _create_event_at(
        admin_headers,
        {"freq": "weekly", "until": until, "exception_dates": [(start + timedelta(days=7)).strftime("%Y-%m-%d")]},
        start,
        title="TEST_NaiveUntil",
    )
    try:
        inst = _instances(eid)
        starts = [e["start"][:10] for e in inst]
        assert (start + timedelta(days=7)).strftime("%Y-%m-%d") not in starts
        assert len(inst) == 3, starts
    finally:
        requests.delete(f"{API}/admin/events/{eid}", headers=admin_headers, timeout=15)


def test_mixed_naive_start_aware_end_does_not_500(admin_headers):
    """Regression: AI-edit left naive start + legacy Z end on a recurring event → /api/events crashed."""
    import uuid as _uuid
    from pymongo import MongoClient
    client = MongoClient(os.environ["MONGO_URL"])
    dbh = client[os.environ["DB_NAME"]]
    eid = f"evt-mixed-{_uuid.uuid4().hex[:8]}"
    dbh.events.insert_one({
        "id": eid, "title": "TEST_MixedTz", "orgSlug": "blackrod-town-council",
        "category": "Community", "start": "2026-11-02T10:00:00",
        "end": "2026-11-02T11:00:00.000Z", "venue": "Hall", "status": "approved",
        "recurrence": {"freq": "weekly", "until": "2026-12-14"},
    })
    try:
        r = requests.get(f"{API}/events", timeout=20)
        assert r.status_code == 200
        inst = [e for e in r.json() if e.get("id") == eid or e.get("parent_id") == eid]
        assert len(inst) >= 4
        assert all("T10:00" in e["start"] for e in inst)
    finally:
        dbh.events.delete_one({"id": eid})
        client.close()
