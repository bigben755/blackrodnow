"""Tests for admin event filter and pagination behaviour.

These are unit-level integration tests using pytest; they test the AdminEvents
page filter logic directly through pure-JS equivalents expressed in Python, as
well as smoke-testing the backend endpoints the page relies on.
"""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rodlife-events.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@blackrodnow.co.uk"
ADMIN_PASSWORD = "BlackrodAdmin!2026"

_UID = uuid.uuid4().hex[:8]
_ORG_SLUG = f"filter-test-org-{_UID}"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/admin/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def filter_org(auth):
    r = requests.post(f"{API}/organisations", json={
        "name": f"Filter Test Org {_UID}",
        "short": "Org for event filter tests.",
        "category": "Community",
        "slug": _ORG_SLUG,
        "owner_email": f"filter-owner-{_UID}@example.com",
    }, timeout=15)
    assert r.status_code in (200, 201)
    requests.patch(f"{API}/organisations/{_ORG_SLUG}",
                   json={"status": "approved"}, headers=auth, timeout=15)
    yield r.json()
    requests.delete(f"{API}/admin/organisations/{_ORG_SLUG}", headers=auth, timeout=15)


@pytest.fixture(scope="module")
def seeded_events(auth, filter_org):
    """Create three events with known attributes to target filters."""
    created = []
    org_token_resp = requests.post(f"{API}/organisations/{_ORG_SLUG}/login",
                                   json={"password": "Organisat10n!&"}, timeout=15)
    org_headers = {"X-Org-Token": org_token_resp.json().get("token", "")} if org_token_resp.ok else {}

    events = [
        {"title": f"Future Venue Event {_UID}", "start": "2027-06-01T10:00:00", "end": "2027-06-01T12:00:00",
         "venue": "Town Hall", "category": "Community", "orgSlug": _ORG_SLUG},
        {"title": f"Past No Venue {_UID}", "start": "2023-01-01T00:00:00", "end": "2023-01-01T01:00:00",
         "venue": "", "category": "Fitness", "orgSlug": _ORG_SLUG},
        {"title": f"Draft Event {_UID}", "start": "2027-09-15T14:00:00", "end": "2027-09-15T16:00:00",
         "venue": "Sports Centre", "category": "Sports", "orgSlug": _ORG_SLUG, "status": "draft"},
    ]
    for ev_data in events:
        r = requests.post(f"{API}/events", json=ev_data, headers={**org_headers}, timeout=15)
        if r.ok:
            created.append(r.json())
        else:
            # Fallback: post with admin headers and mark as needed
            r2 = requests.post(f"{API}/events", json=ev_data, headers=auth, timeout=15)
            if r2.ok:
                created.append(r2.json())

    yield created

    for ev in created:
        ev_id = ev.get("id") or ev.get("_id") or (ev.get("event") or {}).get("id")
        if ev_id:
            requests.delete(f"{API}/events/{ev_id}", headers=auth, timeout=15)


# ─────────── Filter logic unit tests (pure Python equivalents) ───────────

class TestEventFilterLogic:
    """Validate the filter algorithm that AdminEvents.jsx applies to its local event list."""

    EVENTS = [
        {"id": "1", "title": "Community Fun Day", "start": "2027-07-01T10:00:00",
         "status": "approved", "category": "Community", "venue": "Park", "orgSlug": "scouts"},
        {"id": "2", "title": "Fitness Class", "start": "2027-08-15T09:00:00",
         "status": "approved", "category": "Fitness", "venue": "", "orgSlug": "leisure"},
        {"id": "3", "title": "Old Festival", "start": "2022-06-01T00:00:00",
         "status": "approved", "category": "Arts", "venue": "Town Hall", "orgSlug": "arts"},
        {"id": "4", "title": "Pending Gig", "start": "2027-09-01T19:00:00",
         "status": "pending", "category": "Music", "venue": "Club", "orgSlug": "music"},
        {"id": "5", "title": "Community Fun Day", "start": "2027-07-01T10:00:00",
         "status": "approved", "category": "Community", "venue": "Park", "orgSlug": "other"},
    ]

    @staticmethod
    def _apply_filter(events, *, status="all", org="all", category="all", search=""):
        from datetime import datetime, timezone
        now = datetime(2026, 8, 10, tzinfo=timezone.utc)

        def parse(v):
            try:
                return datetime.fromisoformat(v.replace("Z", "+00:00")).replace(tzinfo=timezone.utc) if v else None
            except Exception:
                return None

        out = []
        for ev in events:
            start = parse(ev.get("start"))
            ev_status = ev.get("status") or "pending"
            if status not in ("all", "upcoming", "past"):
                if ev_status != status:
                    continue
            elif status == "upcoming" and start and start < now:
                continue
            elif status == "past" and (not start or start >= now):
                continue
            if org != "all" and ev.get("orgSlug") != org:
                continue
            if category != "all" and ev.get("category") != category:
                continue
            if search:
                needle = search.lower()
                hay = " ".join(filter(None, [ev.get("title"), ev.get("venue"), ev.get("category"), ev.get("orgSlug")])).lower()
                if needle not in hay:
                    continue
            out.append(ev)
        return out

    def test_all_filter_returns_all(self):
        result = self._apply_filter(self.EVENTS)
        assert len(result) == len(self.EVENTS)

    def test_status_pending_filter(self):
        result = self._apply_filter(self.EVENTS, status="pending")
        assert all(e["status"] == "pending" for e in result)
        assert len(result) == 1

    def test_status_upcoming_filter(self):
        result = self._apply_filter(self.EVENTS, status="upcoming")
        assert all(e["start"] > "2026-08-10" for e in result)
        # events 1, 2, 4, 5 are upcoming; 3 is past
        assert len(result) == 4

    def test_status_past_filter(self):
        result = self._apply_filter(self.EVENTS, status="past")
        assert all(e["start"] < "2026-08-10" for e in result)
        assert len(result) == 1
        assert result[0]["id"] == "3"

    def test_org_filter(self):
        result = self._apply_filter(self.EVENTS, org="leisure")
        assert len(result) == 1
        assert result[0]["id"] == "2"

    def test_category_filter(self):
        result = self._apply_filter(self.EVENTS, category="Community")
        assert all(e["category"] == "Community" for e in result)
        assert len(result) == 2

    def test_search_filter_title(self):
        result = self._apply_filter(self.EVENTS, search="fitness")
        assert len(result) == 1
        assert result[0]["id"] == "2"

    def test_search_filter_venue(self):
        result = self._apply_filter(self.EVENTS, search="town hall")
        assert len(result) == 1
        assert result[0]["id"] == "3"

    def test_search_no_match(self):
        result = self._apply_filter(self.EVENTS, search="nonexistent xyz abc")
        assert result == []

    def test_combined_category_and_status_filter(self):
        result = self._apply_filter(self.EVENTS, category="Community", status="approved")
        assert all(e["status"] == "approved" and e["category"] == "Community" for e in result)
        assert len(result) == 2


class TestDuplicateDetection:
    """Verify duplicate detection logic: same normalised title + same date."""

    def _duplicate_counts(self, events):
        from collections import Counter
        def norm(v):
            import re
            return re.sub(r"[^a-z0-9]+", " ", (v or "").lower()).strip()
        keys = [f"{norm(e.get('title'))}|{(e.get('start') or '')[:10]}" for e in events]
        return Counter(k for k in keys if k.split("|")[0])

    def test_duplicate_detected(self):
        events = [
            {"title": "Community Fun Day", "start": "2027-07-01T10:00:00"},
            {"title": "Community Fun Day", "start": "2027-07-01T14:00:00"},
            {"title": "Unique Event", "start": "2027-07-01T10:00:00"},
        ]
        counts = self._duplicate_counts(events)
        assert counts["community fun day|2027-07-01"] == 2
        assert counts.get("unique event|2027-07-01", 0) == 1

    def test_no_duplicate_different_dates(self):
        events = [
            {"title": "Fun Run", "start": "2027-07-01T10:00:00"},
            {"title": "Fun Run", "start": "2027-07-08T10:00:00"},
        ]
        counts = self._duplicate_counts(events)
        assert counts.get("fun run|2027-07-01", 0) == 1
        assert counts.get("fun run|2027-07-08", 0) == 1

    def test_normalisation_case_insensitive(self):
        events = [
            {"title": "FUN RUN", "start": "2027-07-01"},
            {"title": "fun run", "start": "2027-07-01"},
        ]
        counts = self._duplicate_counts(events)
        assert counts["fun run|2027-07-01"] == 2


class TestPaginationMath:
    """Verify page size / total-pages arithmetic used in AdminEvents."""

    @staticmethod
    def _paginate(items, page, page_size):
        total_pages = max(1, -(-len(items) // page_size))  # ceiling division
        start = (page - 1) * page_size
        return items[start:start + page_size], total_pages

    def test_first_page(self):
        items = list(range(60))
        page, total = self._paginate(items, 1, 25)
        assert page == list(range(25))
        assert total == 3

    def test_last_partial_page(self):
        items = list(range(60))
        page, total = self._paginate(items, 3, 25)
        assert page == list(range(50, 60))
        assert total == 3

    def test_single_page_when_few_items(self):
        items = list(range(10))
        page, total = self._paginate(items, 1, 25)
        assert page == list(range(10))
        assert total == 1

    def test_empty_list(self):
        page, total = self._paginate([], 1, 25)
        assert page == []
        assert total == 1

    def test_exact_multiple(self):
        items = list(range(50))
        _, total = self._paginate(items, 1, 25)
        assert total == 2


# ─────────── API smoke tests for endpoints AdminEvents depends on ───────────

class TestAdminEventsEndpoints:
    def test_events_endpoint_accessible_admin(self, auth):
        r = requests.get(f"{API}/events", headers=auth, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) or isinstance(data, dict)

    def test_events_attention_endpoint(self, auth):
        r = requests.get(f"{API}/admin/events/attention", headers=auth, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "counts" in data or "attention" in data

    def test_events_attention_attention_keys(self, auth):
        r = requests.get(f"{API}/admin/events/attention", headers=auth, timeout=15)
        data = r.json()
        attention = data.get("attention") or {}
        # These keys must exist for the AdminEvents attention panel to render correctly.
        for key in ("missing_venue", "missing_time", "missing_image"):
            assert key in attention, f"expected '{key}' in attention: {attention}"
