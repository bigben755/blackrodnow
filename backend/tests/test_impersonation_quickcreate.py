"""Backend tests for iteration_14: admin impersonation + quick-create dialogs."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to frontend/.env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_CODE = "Blackr0dN0w!&"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- Impersonation ---
class TestImpersonation:
    def test_impersonate_valid(self, s):
        # ensure at least one org exists
        orgs = s.get(f"{API}/organisations").json()
        assert orgs, "need at least one org"
        slug = orgs[0]["slug"]
        r = s.post(f"{API}/admin/organisations/{slug}/impersonate",
                   json={"admin_code": ADMIN_CODE})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["slug"] == slug
        assert d["mode"] == "impersonate"
        assert isinstance(d["token"], str) and d["token"]
        assert "org_name" in d

    def test_impersonate_wrong_code(self, s):
        orgs = s.get(f"{API}/organisations").json()
        slug = orgs[0]["slug"]
        r = s.post(f"{API}/admin/organisations/{slug}/impersonate",
                   json={"admin_code": "wrong"})
        assert r.status_code == 403

    def test_impersonate_unknown_slug(self, s):
        r = s.post(f"{API}/admin/organisations/does-not-exist-xyz/impersonate",
                   json={"admin_code": ADMIN_CODE})
        assert r.status_code == 404


# --- Venues ---
class TestVenues:
    def test_create_and_get_venue(self, s):
        name = f"TEST_Venue_{uuid.uuid4().hex[:8]}"
        payload = {
            "id": f"ven-test-{uuid.uuid4().hex[:6]}",
            "name": name,
            "address": "1 Test St, Blackrod",
            "facilities": ["Main hall", "Kitchen"],
            "accessibility": "Step-free",
            "capacity": 100,
            "booking": "mailto:test@example.com",
            "image": "",
        }
        r = s.post(f"{API}/venues", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("name") == name

        listed = s.get(f"{API}/venues").json()
        names = [v["name"] for v in listed]
        assert name in names

    def test_duplicate_venue_name_409(self, s):
        name = f"TEST_DupVenue_{uuid.uuid4().hex[:8]}"
        base = {
            "id": f"ven-dup-{uuid.uuid4().hex[:6]}",
            "name": name,
            "address": "2 Dup St",
            "facilities": [],
            "accessibility": "",
            "capacity": 50,
            "booking": "",
            "image": "",
        }
        r1 = s.post(f"{API}/venues", json=base)
        assert r1.status_code in (200, 201), r1.text
        base2 = dict(base, id=f"ven-dup2-{uuid.uuid4().hex[:6]}")
        r2 = s.post(f"{API}/venues", json=base2)
        assert r2.status_code == 409, r2.text


# --- Volunteers ---
class TestVolunteers:
    def test_create_and_get_volunteer(self, s):
        orgs = s.get(f"{API}/organisations").json()
        slug = orgs[0]["slug"]
        title = f"TEST_Vol_{uuid.uuid4().hex[:8]}"
        payload = {
            "id": f"vol-test-{uuid.uuid4().hex[:6]}",
            "title": title,
            "orgSlug": slug,
            "description": "Help out at the community centre.",
        }
        r = s.post(f"{API}/volunteers", json=payload)
        assert r.status_code in (200, 201), r.text
        listed = s.get(f"{API}/volunteers").json()
        assert any(v.get("title") == title for v in listed)


# --- Events ---
class TestEvents:
    def test_create_and_get_event(self, s):
        orgs = s.get(f"{API}/organisations").json()
        slug = orgs[0]["slug"]
        title = f"TEST_Event_{uuid.uuid4().hex[:8]}"
        payload = {
            "id": f"evt-test-{uuid.uuid4().hex[:6]}",
            "title": title,
            "orgSlug": slug,
            "category": "Community",
            "start": "2026-06-15T10:00:00",
            "end": "2026-06-15T12:00:00",
            "venue": "Community Centre",
            "address": "Blackrod",
            "description": "Test event",
            "status": "approved",
        }
        r = s.post(f"{API}/events", json=payload)
        assert r.status_code in (200, 201), r.text
        listed = s.get(f"{API}/events").json()
        assert any(e.get("title") == title for e in listed)


# --- Organisation create + admin approve ---
class TestOrgApprovalFlow:
    def test_create_org_and_approve(self, s):
        slug = f"test-org-{uuid.uuid4().hex[:6]}"
        payload = {
            "slug": slug,
            "name": f"TEST_Org_{uuid.uuid4().hex[:6]}",
            "category": "Community",
            "shortDescription": "Test org",
            "about": "About test org",
            "email": "test@example.com",
        }
        r = s.post(f"{API}/organisations", json=payload)
        assert r.status_code in (200, 201), r.text

        # Should not be in public list yet unless approved
        r2 = s.post(f"{API}/admin/organisations/{slug}/status",
                    json={"status": "approved", "admin_code": ADMIN_CODE})
        assert r2.status_code == 200, r2.text

        listed = s.get(f"{API}/organisations").json()
        assert any(o.get("slug") == slug for o in listed), \
            f"approved org {slug} not visible in /organisations"
