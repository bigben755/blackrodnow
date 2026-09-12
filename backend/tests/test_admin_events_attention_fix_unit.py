import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from fastapi import APIRouter, HTTPException

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import admin_events_attention_fix


class FakeRequest:
    def __init__(self, admin_code=""):
        self.headers = {}
        if admin_code:
            self.headers["X-Admin-Code"] = admin_code


class FakeCursor:
    def __init__(self, rows):
        self.rows = [dict(row) for row in rows]

    async def to_list(self, limit):
        return self.rows[:limit]


class FakeCollection:
    def __init__(self, rows=None):
        self.rows = rows or []

    def find(self, query, projection=None):
        return FakeCursor(self.rows)


class FakeDb:
    def __init__(self):
        now = datetime.now(timezone.utc)
        self.events = FakeCollection([
            {
                "id": "naive-past",
                "title": "Past event",
                "start": (now - timedelta(days=2)).replace(tzinfo=None).isoformat(),
                "end": (now - timedelta(days=2, hours=-1)).replace(tzinfo=None).isoformat(),
                "status": "approved",
                "venue": "Hall",
                "image": "image.jpg",
            },
            {
                "id": "aware-upcoming",
                "title": "Upcoming event",
                "start": (now + timedelta(days=2)).isoformat(),
                "end": (now + timedelta(days=2, hours=1)).isoformat(),
                "status": "approved",
                "venue": "Hall",
                "image": "image.jpg",
            },
        ])


def route_endpoint(api, path, method):
    matches = [
        route.endpoint
        for route in api.routes
        if route.path == path and method.upper() in route.methods
    ]
    assert len(matches) == 1, f"Expected exactly one {method} {path}; found {len(matches)}"
    return matches[0]


def test_admin_attention_normalises_naive_and_aware_datetimes():
    admin_events_attention_fix._INSTALLED = False
    api = APIRouter(prefix="/api")
    db = FakeDb()

    @api.get("/admin/events/attention")
    async def legacy_attention(request):
        return {"legacy": True}

    admin_events_attention_fix.install_admin_events_attention_fix(
        api=api,
        db=db,
        admin_code="secret",
    )

    endpoint = route_endpoint(api, "/api/admin/events/attention", "GET")

    async def scenario():
        try:
            await endpoint(FakeRequest())
            assert False, "Unauthenticated attention summary unexpectedly succeeded"
        except HTTPException as exc:
            assert exc.status_code == 403

        result = await endpoint(FakeRequest("secret"))
        assert result["counts"]["total"] == 2
        assert result["counts"]["past"] == 1
        assert result["counts"]["upcoming"] == 1
        assert result["attention"]["date_passed_but_published"] == 1

    asyncio.run(scenario())
