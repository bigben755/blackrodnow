"""Broadcast preview endpoint tests."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@blackrodnow.co.uk")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "BlackrodAdmin!2026")


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{API}/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


def test_preview_sends_ok(auth_headers):
    r = requests.post(
        f"{API}/admin/broadcasts/preview",
        json={
            "subject": "Blackrod newsletter test",
            "body": "Hi there — this is a test preview.",
            "preview_to": ADMIN_EMAIL,
        },
        headers=auth_headers,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    assert data["preview_to"] == ADMIN_EMAIL


def test_preview_requires_auth():
    r = requests.post(
        f"{API}/admin/broadcasts/preview",
        json={"subject": "x", "body": "y", "preview_to": "a@b.co"},
        timeout=15,
    )
    assert r.status_code == 403


def test_preview_rejects_invalid_email(auth_headers):
    r = requests.post(
        f"{API}/admin/broadcasts/preview",
        json={"subject": "x", "body": "y", "preview_to": "not-an-email"},
        headers=auth_headers,
        timeout=15,
    )
    assert r.status_code == 400


def test_preview_rejects_empty_body(auth_headers):
    r = requests.post(
        f"{API}/admin/broadcasts/preview",
        json={"subject": "x", "body": "   ", "preview_to": ADMIN_EMAIL},
        headers=auth_headers,
        timeout=15,
    )
    assert r.status_code == 400
