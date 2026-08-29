"""Iter21 targeted tests: org member lifecycle admin actions + event attention behavior."""
import os
import time
import asyncio

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rodlife-events.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@blackrodnow.co.uk"
ADMIN_PASSWORD = "BlackrodAdmin!2026"
TEST_PREFIX = "iter21-member-"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session", autouse=True)
def cleanup_iter21_members():
    yield

    async def _cleanup():
        mongo = os.environ.get("MONGO_URL")
        dbname = os.environ.get("DB_NAME")
        if not mongo or not dbname:
            return
        client = AsyncIOMotorClient(mongo)
        db = client[dbname]
        await db.org_members.delete_many({"email": {"$regex": f"^{TEST_PREFIX}"}})
        await db.org_member_invites.delete_many({"email": {"$regex": f"^{TEST_PREFIX}"}})
        client.close()

    try:
        asyncio.run(_cleanup())
    except Exception as exc:
        print(f"cleanup error: {exc}")


def _approved_org_slug():
    r = requests.get(f"{BASE_URL}/api/organisations", params={"include_pending": "true"}, timeout=20)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list) and rows, "No organisations available for member tests"
    for row in rows:
        if row.get("status") == "approved":
            return row["slug"]
    return rows[0]["slug"]


class TestOrgMemberAdminLifecycle:
    def test_invite_redeem_login_and_admin_controls(self, admin_headers):
        slug = _approved_org_slug()
        suffix = str(int(time.time()))
        email = f"{TEST_PREFIX}{suffix}@example.com"
        password = "Iter21Member!123"

        invite_res = requests.post(
            f"{BASE_URL}/api/admin/organisations/{slug}/members/invite",
            headers=admin_headers,
            json={"email": email, "role": "editor", "note": "iter21 flow"},
            timeout=20,
        )
        assert invite_res.status_code == 200, invite_res.text
        invite = invite_res.json()
        invite_id = invite["id"]
        token = invite["token"]

        list_res = requests.get(
            f"{BASE_URL}/api/admin/organisations/{slug}/members",
            headers=admin_headers,
            timeout=20,
        )
        assert list_res.status_code == 200, list_res.text
        listing = list_res.json()
        assert any(i.get("id") == invite_id for i in listing.get("invites", []))

        resend_res = requests.post(
            f"{BASE_URL}/api/admin/member-invites/{invite_id}/resend",
            headers=admin_headers,
            timeout=20,
        )
        assert resend_res.status_code == 200, resend_res.text

        reset_res = requests.post(
            f"{BASE_URL}/api/admin/member-invites/{invite_id}/reset",
            headers=admin_headers,
            timeout=20,
        )
        assert reset_res.status_code == 200, reset_res.text
        token = reset_res.json()["token"]

        redeem_res = requests.post(
            f"{BASE_URL}/api/organisations/member-invites/redeem",
            json={"token": token, "name": "Iter 21 Member", "password": password},
            timeout=20,
        )
        assert redeem_res.status_code == 200, redeem_res.text
        redeem = redeem_res.json()
        member_id = redeem["member_id"]

        login_res = requests.post(
            f"{BASE_URL}/api/organisations/member/login",
            json={"org_slug": slug, "email": email, "password": password},
            timeout=20,
        )
        assert login_res.status_code == 200, login_res.text
        login_payload = login_res.json()
        assert login_payload.get("token", "").startswith("Bearer ")
        assert login_payload.get("member", {}).get("role") == "editor"

        role_res = requests.post(
            f"{BASE_URL}/api/admin/organisations/{slug}/members/{member_id}/role",
            headers=admin_headers,
            json={"role": "admin"},
            timeout=20,
        )
        assert role_res.status_code == 200, role_res.text
        assert role_res.json().get("role") == "admin"

        suspend_res = requests.post(
            f"{BASE_URL}/api/admin/organisations/{slug}/members/{member_id}/suspend",
            headers=admin_headers,
            json={"suspended": True},
            timeout=20,
        )
        assert suspend_res.status_code == 200, suspend_res.text
        assert suspend_res.json().get("status") == "suspended"

        blocked_login = requests.post(
            f"{BASE_URL}/api/organisations/member/login",
            json={"org_slug": slug, "email": email, "password": password},
            timeout=20,
        )
        assert blocked_login.status_code == 403, blocked_login.text

        unsuspend_res = requests.post(
            f"{BASE_URL}/api/admin/organisations/{slug}/members/{member_id}/suspend",
            headers=admin_headers,
            json={"suspended": False},
            timeout=20,
        )
        assert unsuspend_res.status_code == 200, unsuspend_res.text
        assert unsuspend_res.json().get("status") == "active"

        remove_res = requests.delete(
            f"{BASE_URL}/api/admin/organisations/{slug}/members/{member_id}",
            headers=admin_headers,
            timeout=20,
        )
        assert remove_res.status_code == 200, remove_res.text

        missing_login = requests.post(
            f"{BASE_URL}/api/organisations/member/login",
            json={"org_slug": slug, "email": email, "password": password},
            timeout=20,
        )
        assert missing_login.status_code == 404, missing_login.text


class TestAdminEventsAttention:
    def test_attention_summary_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/events/attention", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        payload = r.json()
        assert "counts" in payload
        assert "attention" in payload
        for key in ["pending", "approved", "rejected", "cancelled", "draft"]:
            assert key in payload["counts"], f"Missing count key: {key}"
        for key in ["missing_venue", "missing_time", "missing_image", "possible_duplicate", "date_passed_but_published"]:
            assert key in payload["attention"], f"Missing attention key: {key}"
