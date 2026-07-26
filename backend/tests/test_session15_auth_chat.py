"""Session 15 tests: JWT admin auth + chat context feed + parser regression."""
import os
import io
import pytest
import requests

def _load_base_url():
    v = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if v:
        return v.rstrip("/")
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    return ""

BASE_URL = _load_base_url()
LOCAL_URL = "http://localhost:8001"
ADMIN_EMAIL = "admin@blackrodnow.co.uk"
ADMIN_PASSWORD = "BlackrodAdmin!2026"


@pytest.fixture(scope="module")
def clear_lockouts():
    """Clear login_attempts before running to avoid stale lockouts."""
    try:
        from pymongo import MongoClient
        client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "test_database")]
        db.login_attempts.delete_many({})
    except Exception as e:
        print(f"Warning: could not clear lockouts: {e}")
    yield
    try:
        from pymongo import MongoClient
        client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = client[os.environ.get("DB_NAME", "test_database")]
        db.login_attempts.delete_many({})
    except Exception:
        pass


@pytest.fixture(scope="module")
def admin_token(clear_lockouts):
    r = requests.post(f"{BASE_URL}/api/auth/admin/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["token"].count(".") == 2
    assert data["user"]["email"] == ADMIN_EMAIL
    assert data["user"]["role"] == "admin"
    return data["token"]


# ---------- Chat context feed ----------
class TestChatContext:
    def test_json_context(self):
        r = requests.get(f"{BASE_URL}/api/chat/context?days=30", timeout=15)
        assert r.status_code == 200
        j = r.json()
        for k in ("site", "events", "organisations", "venues", "volunteering", "faqs"):
            assert k in j, f"missing key {k}"
        for k in ("name", "url", "description", "contact"):
            assert k in j["site"], f"site missing {k}"
        assert isinstance(j["events"], list)
        assert isinstance(j["faqs"], list)
        if j["faqs"]:
            for k in ("cat", "q", "a"):
                assert k in j["faqs"][0], f"faq missing {k}"
        # If any events, verify shape
        if j["events"]:
            for k in ("id", "title", "date", "time", "venue", "url", "description", "organiser"):
                assert k in j["events"][0], f"event missing {k}"

    def test_markdown_context(self):
        r = requests.get(f"{BASE_URL}/api/chat/context.md?days=14", timeout=15)
        assert r.status_code == 200
        text = r.text
        assert text.startswith("# Blackrod Now"), f"got: {text[:80]!r}"
        for section in ("## Upcoming events", "## Organisations", "## Venues",
                        "## Volunteering opportunities", "## Frequently asked questions"):
            assert section in text, f"missing section {section}"


# ---------- JWT Admin Auth ----------
class TestAdminAuth:
    def test_login_success(self, admin_token):
        assert admin_token and admin_token.count(".") == 2

    def test_login_wrong_password(self, clear_lockouts):
        r = requests.post(f"{BASE_URL}/api/auth/admin/login",
                          json={"email": ADMIN_EMAIL, "password": "wrongpass-xyz"}, timeout=15)
        assert r.status_code == 401
        assert "Invalid email or password" in r.json().get("detail", "")

    def test_lockout_after_5_failures(self):
        # Clear first
        try:
            from pymongo import MongoClient
            client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client[os.environ.get("DB_NAME", "test_database")]
            db.login_attempts.delete_many({})
        except Exception:
            pass
        # hit localhost so same client IP
        statuses = []
        for _ in range(6):
            r = requests.post(f"{LOCAL_URL}/api/auth/admin/login",
                              json={"email": ADMIN_EMAIL, "password": "badpass"}, timeout=10)
            statuses.append(r.status_code)
        assert statuses[-1] == 429, f"expected 429, got {statuses}"
        detail = requests.post(f"{LOCAL_URL}/api/auth/admin/login",
                               json={"email": ADMIN_EMAIL, "password": "badpass"}, timeout=10).json().get("detail", "")
        assert "Too many failed attempts" in detail
        # cleanup lockouts so admin_token fixture in next test works
        try:
            from pymongo import MongoClient
            client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client[os.environ.get("DB_NAME", "test_database")]
            db.login_attempts.delete_many({})
        except Exception:
            pass

    def test_auth_me_with_token(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["email"] == ADMIN_EMAIL
        assert j["role"] == "admin"
        assert "exp" in j
        assert "name" in j

    def test_auth_me_without_header(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401


# ---------- Impersonation via JWT ----------
class TestImpersonateJWT:
    def test_impersonate_with_jwt(self, admin_token):
        slug = "blackrod-town-council"
        r = requests.post(f"{BASE_URL}/api/admin/organisations/{slug}/impersonate",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          json={}, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True
        assert j.get("slug") == slug
        assert j.get("mode") == "impersonate"
        assert "token" in j
        assert "org_name" in j

    def test_impersonate_without_auth_returns_403(self):
        slug = "blackrod-town-council"
        r = requests.post(f"{BASE_URL}/api/admin/organisations/{slug}/impersonate",
                          json={}, timeout=15)
        assert r.status_code == 403, f"got {r.status_code}: {r.text}"


# ---------- Admin document parse regression ----------
class TestAdminParseRegression:
    def test_image_upload_ocr(self, admin_token):
        # tiny PNG (1x1 white)
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
            "890000000d49444154789c63f8ffff3f0005fe02fe22b1b6e40000000049454e"
            "44ae426082"
        )
        files = {"files": ("test.png", io.BytesIO(png), "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/admin/documents/parse",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        # should have documents key or similar
        assert isinstance(j, dict)

    def test_multiple_documents(self, admin_token):
        files = [
            ("files", ("a.txt", io.BytesIO(b"Hello world event on 2026-03-01"), "text/plain")),
            ("files", ("b.txt", io.BytesIO(b"Another doc content"), "text/plain")),
        ]
        r = requests.post(
            f"{BASE_URL}/api/admin/documents/parse",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            timeout=60,
        )
        assert r.status_code == 200, r.text
