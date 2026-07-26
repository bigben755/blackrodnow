"""Post Now social bundle endpoint tests."""
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
    assert r.status_code == 200, r.text
    return {"X-Org-Auth": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def event_id(admin_headers):
    start = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=5, hours=2)).isoformat()
    payload = {
        "title": "TEST_Post Now Bundle Event",
        "orgSlug": TEST_ORG_SLUG,
        "category": "Community",
        "start": start,
        "end": end,
        "venue": "Blackrod Village Hall",
        "address": "Manchester Road, BL6 5EH",
        "description": "Community coffee morning with cake, chat and warm welcome. Everyone invited.",
        "cost": "Free",
        "status": "approved",
    }
    r = requests.post(f"{API}/events", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    eid = r.json()["id"]
    yield eid
    requests.delete(f"{API}/events/{eid}", headers=admin_headers, timeout=15)


def test_bundle_default_friendly(event_id):
    r = requests.get(f"{API}/events/{event_id}/social-bundle", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["event_id"] == event_id
    assert data["tone"] == "friendly"
    assert data["ai"] is False
    assert "TEST_Post Now Bundle Event" in data["caption"]
    assert data["link"].endswith(f"/events/{event_id}")
    assert data["poster_png"].endswith(f"/events/{event_id}/poster.png")
    # Hashtags contain expected base tags and are deduped
    tags_lower = [t.lower() for t in data["hashtags"]]
    assert "#blackrod" in tags_lower
    assert "#blackrodnow" in tags_lower
    assert len(tags_lower) == len(set(tags_lower)), "hashtags must be unique"


@pytest.mark.parametrize("tone", ["friendly", "punchy", "formal"])
def test_bundle_all_tones(event_id, tone):
    r = requests.get(f"{API}/events/{event_id}/social-bundle", params={"tone": tone}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["tone"] == tone
    assert data["link"] in data["caption"] or data["link"] in data["caption_with_link"]
    # Formal tone should not contain emoji rocket / sparkle
    if tone == "formal":
        assert "✨" not in data["caption"]
        assert "🎉" not in data["caption"]


def test_bundle_invalid_tone_falls_back_to_friendly(event_id):
    r = requests.get(f"{API}/events/{event_id}/social-bundle", params={"tone": "sassy"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["tone"] == "friendly"


def test_bundle_ai_flag_returns_caption(event_id):
    # AI may or may not be enabled depending on env — but the endpoint must not 500.
    r = requests.get(f"{API}/events/{event_id}/social-bundle", params={"ai": "true"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["caption"], "caption must not be empty"
    assert data["link"] in data["caption"] or data["link"] in data["caption_with_link"]


def test_bundle_missing_event_404():
    r = requests.get(f"{API}/events/nonexistent-event-xyz/social-bundle", timeout=15)
    assert r.status_code == 404
