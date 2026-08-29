"""Tests for org member invitation and lifecycle endpoints."""
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
TEST_ORG_SLUG = f"test-member-org-{_UID}"
TEST_MEMBER_EMAIL = f"test.member.{_UID}@example.com"
TEST_MEMBER_PASSWORD = "MemberPass!2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/admin/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def test_org(auth):
    """Create a disposable org for member tests."""
    r = requests.post(f"{API}/organisations", json={
        "name": f"Test Member Org {_UID}",
        "short": "Test org for member lifecycle testing.",
        "category": "Community",
        "slug": TEST_ORG_SLUG,
        "owner_email": f"owner-{_UID}@example.com",
    }, timeout=15)
    assert r.status_code in (200, 201), f"org creation failed: {r.status_code} {r.text}"
    # Approve the org so member logins work.
    requests.post(f"{API}/admin/organisations/{TEST_ORG_SLUG}/lifecycle",
                  json={"action": "approve"}, headers=auth, timeout=15)
    yield r.json()
    # Cleanup.
    requests.delete(f"{API}/admin/organisations/{TEST_ORG_SLUG}", headers=auth, timeout=15)


@pytest.fixture(scope="module")
def invite_token(auth, test_org):
    """Invite a member and return their raw token string."""
    r = requests.post(
        f"{API}/admin/organisations/{TEST_ORG_SLUG}/members/invite",
        json={"email": TEST_MEMBER_EMAIL, "role": "editor", "note": "automated test"},
        headers=auth, timeout=15,
    )
    assert r.status_code == 200, f"member invite failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("token"), "invite token should be present"
    assert data.get("email") == TEST_MEMBER_EMAIL
    assert data.get("role") == "editor"
    return data["token"]


class TestMemberInviteFlow:
    def test_invite_creates_pending_invite(self, auth, invite_token):
        r = requests.get(f"{API}/admin/member-invites", params={"status": "pending"}, headers=auth, timeout=15)
        assert r.status_code == 200
        tokens = [i["token"] for i in r.json() if i.get("status") == "pending"]
        assert invite_token in tokens

    def test_resend_invite(self, auth, invite_token):
        r_list = requests.get(f"{API}/admin/member-invites", params={"status": "pending"}, headers=auth, timeout=15)
        assert r_list.status_code == 200
        invite_id = next((i["id"] for i in r_list.json() if i.get("token") == invite_token), None)
        assert invite_id, "invite id not found"
        r = requests.post(f"{API}/admin/member-invites/{invite_id}/resend", headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_list_org_members_before_redeem(self, auth):
        r = requests.get(f"{API}/admin/organisations/{TEST_ORG_SLUG}/members", headers=auth, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "members" in data
        assert "invites" in data
        pending = [i for i in data["invites"] if i.get("email") == TEST_MEMBER_EMAIL and i.get("status") == "pending"]
        assert len(pending) == 1

    def test_redeem_invite_bad_token(self):
        r = requests.post(f"{API}/organisations/member-invites/redeem",
                          json={"token": "bad-token-xyz", "password": "AnyPass!99"}, timeout=15)
        assert r.status_code == 404

    def test_redeem_invite_short_password(self, invite_token):
        r = requests.post(f"{API}/organisations/member-invites/redeem",
                          json={"token": invite_token, "password": "short"}, timeout=15)
        assert r.status_code == 400
        assert "8" in r.json().get("detail", "")

    def test_redeem_invite_success(self, invite_token):
        r = requests.post(f"{API}/organisations/member-invites/redeem",
                          json={"token": invite_token, "name": "Test Member", "password": TEST_MEMBER_PASSWORD}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("org_slug") == TEST_ORG_SLUG
        assert data.get("email") == TEST_MEMBER_EMAIL

    def test_invite_marked_accepted(self, auth, invite_token):
        r = requests.get(f"{API}/admin/organisations/{TEST_ORG_SLUG}/members", headers=auth, timeout=15)
        assert r.status_code == 200
        data = r.json()
        invite = next((i for i in data["invites"] if i.get("token") == invite_token), None)
        assert invite is not None
        assert invite.get("status") == "accepted"


class TestMemberLogin:
    def test_login_wrong_password(self):
        r = requests.post(f"{API}/organisations/member/login",
                          json={"org_slug": TEST_ORG_SLUG, "email": TEST_MEMBER_EMAIL, "password": "WrongPass!99"}, timeout=15)
        assert r.status_code == 401

    def test_login_unknown_email(self):
        r = requests.post(f"{API}/organisations/member/login",
                          json={"org_slug": TEST_ORG_SLUG, "email": "nobody@example.com", "password": TEST_MEMBER_PASSWORD}, timeout=15)
        assert r.status_code == 404

    def test_login_success(self):
        r = requests.post(f"{API}/organisations/member/login",
                          json={"org_slug": TEST_ORG_SLUG, "email": TEST_MEMBER_EMAIL, "password": TEST_MEMBER_PASSWORD}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("token", "").startswith("Bearer ")
        assert data.get("slug") == TEST_ORG_SLUG
        member = data.get("member") or {}
        assert member.get("email") == TEST_MEMBER_EMAIL
        assert member.get("role") == "editor"


class TestMemberAdminActions:
    @pytest.fixture(scope="class")
    def member_id(self, auth):
        r = requests.get(f"{API}/admin/organisations/{TEST_ORG_SLUG}/members", headers=auth, timeout=15)
        assert r.status_code == 200
        members = r.json().get("members", [])
        m = next((m for m in members if m.get("email") == TEST_MEMBER_EMAIL), None)
        assert m, f"member not found in {members}"
        return m["id"]

    def test_change_role(self, auth, member_id):
        r = requests.post(f"{API}/admin/organisations/{TEST_ORG_SLUG}/members/{member_id}/role",
                          json={"role": "admin"}, headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json().get("role") == "admin"

    def test_change_role_invalid(self, auth, member_id):
        r = requests.post(f"{API}/admin/organisations/{TEST_ORG_SLUG}/members/{member_id}/role",
                          json={"role": "superuser"}, headers=auth, timeout=15)
        assert r.status_code == 422

    def test_suspend_member(self, auth, member_id):
        r = requests.post(f"{API}/admin/organisations/{TEST_ORG_SLUG}/members/{member_id}/suspend",
                          json={"suspended": True}, headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "suspended"

    def test_suspended_member_cannot_login(self):
        r = requests.post(f"{API}/organisations/member/login",
                          json={"org_slug": TEST_ORG_SLUG, "email": TEST_MEMBER_EMAIL, "password": TEST_MEMBER_PASSWORD}, timeout=15)
        assert r.status_code == 403

    def test_reactivate_member(self, auth, member_id):
        r = requests.post(f"{API}/admin/organisations/{TEST_ORG_SLUG}/members/{member_id}/suspend",
                          json={"suspended": False}, headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "active"

    def test_remove_member(self, auth, member_id):
        r = requests.delete(f"{API}/admin/organisations/{TEST_ORG_SLUG}/members/{member_id}", headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_member_gone_after_removal(self, auth):
        r = requests.get(f"{API}/admin/organisations/{TEST_ORG_SLUG}/members", headers=auth, timeout=15)
        assert r.status_code == 200
        members = r.json().get("members", [])
        emails = [m.get("email") for m in members]
        assert TEST_MEMBER_EMAIL not in emails


class TestMemberInviteReset:
    def test_invite_new_member_and_reset_token(self, auth, test_org):
        email = f"reset-test-{_UID}@example.com"
        r = requests.post(
            f"{API}/admin/organisations/{TEST_ORG_SLUG}/members/invite",
            json={"email": email, "role": "viewer", "note": "reset test"},
            headers=auth, timeout=15,
        )
        assert r.status_code == 200
        invite_id = r.json()["id"]
        old_token = r.json()["token"]

        r2 = requests.post(f"{API}/admin/member-invites/{invite_id}/reset", headers=auth, timeout=15)
        assert r2.status_code == 200
        new_token = r2.json().get("token")
        assert new_token and new_token != old_token


class TestAdminUsersOverviewIncludesMembers:
    def test_overview_has_pending_member_invites_count(self, auth):
        r = requests.get(f"{API}/admin/users", headers=auth, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "pending_member_invites" in data
        assert isinstance(data["pending_member_invites"], int)
        assert "users" in data
