"""Web push endpoints — subscription lifecycle + admin announce."""
import os

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
FAKE_ENDPOINT = "https://fcm.googleapis.com/fcm/send/PYTEST-FAKE"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(os.environ["MONGO_URL"])
    yield client[os.environ["DB_NAME"]]
    client.close()


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(
        f"{API}/auth/admin/login",
        json={"email": "admin@blackrodnow.co.uk", "password": "BlackrodAdmin!2026"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_public_key_served():
    r = requests.get(f"{API}/push/public-key", timeout=10)
    assert r.status_code == 200
    assert r.json()["key"].startswith("B")


def test_subscribe_upsert_and_unsubscribe(db):
    sub = {
        "endpoint": FAKE_ENDPOINT,
        "keys": {"p256dh": "BFakeKey", "auth": "FakeAuth"},
    }
    r = requests.post(f"{API}/push/subscribe", json={"device_id": "pytest-dev", "subscription": sub}, timeout=10)
    assert r.status_code == 200
    # idempotent upsert
    r2 = requests.post(f"{API}/push/subscribe", json={"device_id": "pytest-dev", "subscription": sub}, timeout=10)
    assert r2.status_code == 200
    assert db.push_subscriptions.count_documents({"endpoint": FAKE_ENDPOINT}) == 1

    r3 = requests.post(f"{API}/push/unsubscribe", json={"endpoint": FAKE_ENDPOINT}, timeout=10)
    assert r3.status_code == 200
    assert db.push_subscriptions.count_documents({"endpoint": FAKE_ENDPOINT}) == 0


def test_subscribe_rejects_missing_endpoint():
    r = requests.post(f"{API}/push/subscribe", json={"device_id": "x", "subscription": {}}, timeout=10)
    assert r.status_code == 400


def test_announce_requires_admin():
    r = requests.post(f"{API}/admin/push/announce", json={"title": "t", "body": "b"}, timeout=10)
    assert r.status_code == 403


def test_announce_validates_and_prunes_dead_sub(db, admin_headers):
    sub = {
        "endpoint": FAKE_ENDPOINT,
        "keys": {
            "p256dh": "BDRIR_9SPZGvLjZMekLDGxGbBhuGsmXh2Pn_FnV8iUOgrvQf9Fy4C_3uYoBKkKedWZj2LAdeNa-Iy3ssceNyxxI",
            "auth": "dGVzdGF1dGh0ZXN0YQ",
        },
    }
    requests.post(f"{API}/push/subscribe", json={"device_id": "pytest-dev", "subscription": sub}, timeout=10)

    r = requests.post(f"{API}/admin/push/announce", json={"title": "", "body": "x"}, headers=admin_headers, timeout=15)
    assert r.status_code == 400

    r2 = requests.post(
        f"{API}/admin/push/announce",
        json={"title": "Pytest", "body": "Hello"},
        headers=admin_headers,
        timeout=60,
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body["subscriptions"] >= 1
    # fake FCM endpoint is dead → pruned automatically
    assert db.push_subscriptions.count_documents({"endpoint": FAKE_ENDPOINT}) == 0
