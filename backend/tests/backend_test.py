"""BlackrodLife backend tests - health + AI parse-content."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rodlife-events.preview.emergentagent.com').rstrip('/')


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# Health check
class TestHealth:
    def test_root_api(self, api):
        r = api.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert "BlackrodLife" in data.get("message", "")


# Status CRUD (Mongo write/read)
class TestStatus:
    def test_create_and_list_status(self, api):
        payload = {"client_name": "TEST_pytest_client"}
        r = api.post(f"{BASE_URL}/api/status", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["client_name"] == payload["client_name"]
        assert "id" in body and "timestamp" in body

        r2 = api.get(f"{BASE_URL}/api/status", timeout=15)
        assert r2.status_code == 200
        names = [s.get("client_name") for s in r2.json()]
        assert payload["client_name"] in names


# AI parse-content (real Emergent LLM)
class TestParseContent:
    def test_empty_text_400(self, api):
        r = api.post(f"{BASE_URL}/api/parse-content", json={"text": ""}, timeout=30)
        assert r.status_code == 400

    def test_event_text_returns_event(self, api):
        payload = {"text": "Summer Fair Saturday 14 June 11am-4pm at Community Centre. Bouncy castles, food stalls, live music."}
        r = api.post(f"{BASE_URL}/api/parse-content", json=payload, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        # Verify all required keys present
        for k in ["suggested_type", "title", "date", "start_time", "end_time",
                  "location", "category", "description", "social_caption", "notification_text"]:
            assert k in data, f"missing {k}"
        assert data["suggested_type"] == "event"
        assert isinstance(data["title"], str) and len(data["title"]) > 0
        assert isinstance(data["description"], str) and len(data["description"]) > 0
        assert isinstance(data["social_caption"], str) and len(data["social_caption"]) > 0
        assert isinstance(data["notification_text"], str) and len(data["notification_text"]) > 0

    def test_update_text_returns_update_or_event(self, api):
        payload = {"text": "We are excited to announce our new community garden is now open for volunteers."}
        r = api.post(f"{BASE_URL}/api/parse-content", json=payload, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["suggested_type"] in ("event", "update")
        assert data["title"]
