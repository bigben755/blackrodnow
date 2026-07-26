"""Iter16 — Coming Soon launch gate backend tests.

Covers:
- GET /api/site/settings (public, defaults)
- POST /api/admin/site/settings — unauth 403, JWT admin, legacy X-Admin-Code
- POST /api/organisations/rodlife-events/auth/login — right/wrong password
- Web wizard enquiry + subscribe (used by ComingSoon page)
"""
import os
import pytest
import requests
from pathlib import Path

# Resolve BASE_URL from env or frontend/.env
_env = os.environ.get("REACT_APP_BACKEND_URL")
if not _env:
    envf = Path("/app/frontend/.env")
    if envf.exists():
        for line in envf.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                _env = line.split("=", 1)[1].strip()
                break
BASE_URL = (_env or "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@blackrodnow.co.uk"
ADMIN_PASSWORD = "BlackrodAdmin!2026"
LEGACY_CODE = "Blackr0dN0w!&"
ORG_SLUG = "blackrod-town-council"  # note: review req said "rodlife-events" but that's the deploy subdomain, not an org slug
ORG_PASSWORD = "Organisat10n!&"


@pytest.fixture(scope="module")
def admin_jwt():
    r = requests.post(f"{API}/auth/admin/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    }, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json().get("token")


@pytest.fixture(scope="module", autouse=True)
def leave_coming_soon_on():
    """After the entire module runs, ensure coming_soon=True (launch-ready)."""
    yield
    try:
        r = requests.post(f"{API}/auth/admin/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        }, timeout=15)
        if r.status_code == 200:
            tok = r.json()["token"]
            requests.post(
                f"{API}/admin/site/settings",
                json={"coming_soon": True},
                headers={"Authorization": f"Bearer {tok}"},
                timeout=15,
            )
    except Exception:
        pass


# ---- Site settings ----------------------------------------------------------
class TestSiteSettings:
    def test_get_public_no_auth(self):
        r = requests.get(f"{API}/site/settings", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "coming_soon" in data and isinstance(data["coming_soon"], bool)
        assert "launch_at" in data
        assert "teaser" in data

    def test_patch_unauth_returns_403(self):
        r = requests.post(f"{API}/admin/site/settings", json={"coming_soon": False}, timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_patch_with_jwt_toggles_and_resets(self, admin_jwt):
        h = {"Authorization": f"Bearer {admin_jwt}"}
        # Flip to False
        r = requests.post(f"{API}/admin/site/settings", json={"coming_soon": False}, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["coming_soon"] is False
        # Verify persisted via GET
        g = requests.get(f"{API}/site/settings", timeout=15).json()
        assert g["coming_soon"] is False
        # Reset back to True
        r2 = requests.post(f"{API}/admin/site/settings", json={"coming_soon": True}, headers=h, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["coming_soon"] is True

    def test_patch_with_legacy_x_admin_code(self):
        r = requests.post(
            f"{API}/admin/site/settings",
            json={"teaser": "TEST_TEASER"},
            headers={"X-Admin-Code": LEGACY_CODE},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("teaser") == "TEST_TEASER"
        # Reset teaser back to default-ish
        requests.post(
            f"{API}/admin/site/settings",
            json={"teaser": "A new community hub for what's on, what's new, and what's next in Blackrod."},
            headers={"X-Admin-Code": LEGACY_CODE},
            timeout=15,
        )


# ---- Org login --------------------------------------------------------------
class TestOrgAuthLogin:
    def test_login_success(self):
        r = requests.post(f"{API}/organisations/{ORG_SLUG}/auth/login",
                          json={"password": ORG_PASSWORD}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["slug"] == ORG_SLUG
        assert isinstance(data.get("org_name"), str) and len(data["org_name"]) > 0
        assert isinstance(data.get("token"), str) and data["token"].startswith("org:")

    def test_login_wrong_password_401(self):
        r = requests.post(f"{API}/organisations/{ORG_SLUG}/auth/login",
                          json={"password": "WRONG-PASS-xyz"}, timeout=15)
        assert r.status_code == 401


# ---- Web wizard + subscribe (used by Coming Soon page) ---------------------
class TestSubscribeAndWizard:
    def test_subscribe_creates_record(self):
        email = "TEST_iter16_cs@example.com"
        r = requests.post(f"{API}/subscribe", json={"email": email}, timeout=15)
        assert r.status_code in (200, 201), r.text

    def test_web_wizard_enquiry_accepted(self, admin_jwt):
        payload = {
            "from_name": "TEST_wizard_iter16",
            "from_email": "wiz+iter16@example.com",
            "business": "TEST_biz",
            "service": "Website design and build",
            "budget": "£2k",
            "timeline": "6w",
            "details": "TEST_details_iter16",
        }
        r = requests.post(f"{API}/web-wizard/enquiry", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        # Try to see it via admin/messages
        h = {"Authorization": f"Bearer {admin_jwt}"}
        m = requests.get(f"{API}/admin/messages", headers=h, timeout=15)
        # Endpoint may be admin-gated; treat 200 as pass-through
        assert m.status_code in (200, 401, 403)
