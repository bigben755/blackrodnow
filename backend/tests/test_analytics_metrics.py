import os
import uuid

import requests


BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def test_track_and_read_analytics_metrics():
    api = requests.Session()
    api.headers.update({"Accept": "application/json"})

    events = api.get(f"{API}/events", timeout=15).json()
    target_event = next((event for event in events if event.get("orgSlug") == "blackrod-town-council"), None)
    assert target_event is not None

    device_id = f"TEST_ANALYTICS_{uuid.uuid4().hex[:8]}"
    payloads = [
        {"kind": "org_view", "entity_type": "org", "entity_id": "blackrod-town-council", "org_slug": "blackrod-town-council", "device_id": device_id},
        {"kind": "event_view", "entity_type": "event", "entity_id": target_event["id"], "org_slug": "blackrod-town-council", "device_id": device_id},
        {"kind": "share_click", "entity_type": "event", "entity_id": target_event["id"], "org_slug": "blackrod-town-council", "platform": "facebook", "device_id": device_id},
    ]

    for payload in payloads:
        response = api.post(f"{API}/analytics/track", json=payload, timeout=15)
        assert response.status_code == 200, response.text
        assert response.json()["ok"] is True

    stats = api.get(f"{API}/admin/stats", timeout=15)
    assert stats.status_code == 200, stats.text
    analytics = stats.json()["analytics"]
    assert analytics["engagement"]["org_views_30d"] >= 1
    assert analytics["engagement"]["event_views_30d"] >= 1
    assert analytics["engagement"]["share_clicks_30d"] >= 1

    org_analytics = api.get(f"{API}/organisations/blackrod-town-council/analytics", timeout=15)
    assert org_analytics.status_code == 200, org_analytics.text
    payload = org_analytics.json()
    assert payload["overview"]["page_views_30d"] >= 1
    assert payload["overview"]["event_views_30d"] >= 1
    assert payload["overview"]["share_clicks_30d"] >= 1
    assert isinstance(payload["top_events_30d"], list)