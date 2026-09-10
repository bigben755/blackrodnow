import asyncio
from types import SimpleNamespace

from fastapi import APIRouter, HTTPException
from starlette.requests import Request

import admin_event_lifecycle


class FakeCollection:
    def __init__(self, rows=None):
        self.rows = [dict(row) for row in (rows or [])]
        self.inserted = []

    async def find_one(self, query, projection=None):
        for row in self.rows:
            if all(row.get(key) == value for key, value in query.items()):
                result = dict(row)
                if projection and projection.get("_id") == 0:
                    result.pop("_id", None)
                return result
        return None

    async def update_one(self, query, update):
        for row in self.rows:
            if all(row.get(key) == value for key, value in query.items()):
                for key, value in update.get("$set", {}).items():
                    row[key] = value
                for key in update.get("$unset", {}):
                    row.pop(key, None)
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)

    async def insert_one(self, row):
        self.inserted.append(dict(row))
        return SimpleNamespace(inserted_id=row.get("id"))


class FakeDb:
    def __init__(self):
        self.events = FakeCollection(
            [
                {
                    "id": "event-1",
                    "title": "Test event",
                    "orgSlug": "test-org",
                    "status": "approved",
                    "featured": True,
                }
            ]
        )
        self.admin_audit = FakeCollection()


def make_request(admin_code=""):
    headers = []
    if admin_code:
        headers.append((b"x-admin-code", admin_code.encode("utf-8")))
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": headers,
            "query_string": b"",
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 1234),
            "scheme": "http",
            "root_path": "",
        }
    )


def test_prefixed_legacy_routes_are_replaced_and_secured():
    admin_event_lifecycle._INSTALLED = False

    api = APIRouter(prefix="/api")
    db = FakeDb()
    calls = {"archive_past": 0}

    @api.post("/admin/events/archive-past")
    async def legacy_archive_past():
        calls["archive_past"] += 1
        return {"ok": True, "archived": 0}

    @api.post("/admin/events/{event_id}/restore")
    async def legacy_restore(event_id: str):
        return {"ok": True, "event_id": event_id}

    admin_event_lifecycle.install_admin_event_lifecycle(
        api=api,
        db=db,
        admin_code="secret",
    )

    by_path = {}
    for route in api.routes:
        by_path.setdefault(route.path, []).append(route.endpoint)

    assert len(by_path["/api/admin/events/archive-past"]) == 1
    assert len(by_path["/api/admin/events/{event_id}/restore"]) == 1
    assert len(by_path["/api/admin/community/events/{event_id}/archive"]) == 1
    assert len(by_path["/api/admin/community/events/{event_id}/restore"]) == 1

    archive = by_path["/api/admin/community/events/{event_id}/archive"][0]
    restore = by_path["/api/admin/events/{event_id}/restore"][0]
    archive_past = by_path["/api/admin/events/archive-past"][0]

    async def scenario():
        try:
            await archive("event-1", make_request())
            assert False, "Unauthenticated archive unexpectedly succeeded"
        except HTTPException as exc:
            assert exc.status_code == 403

        archived = await archive("event-1", make_request("secret"))
        assert archived["status"] == "archived"
        assert db.events.rows[0]["status"] == "archived"
        assert db.events.rows[0]["featured"] is False
        assert db.events.rows[0].get("archived_at")

        restored = await restore("event-1", make_request("secret"))
        assert restored["status"] == "approved"
        assert db.events.rows[0]["status"] == "approved"
        assert "archived_at" not in db.events.rows[0]

        try:
            await archive_past(make_request())
            assert False, "Unauthenticated archive-past unexpectedly succeeded"
        except HTTPException as exc:
            assert exc.status_code == 403

        result = await archive_past(make_request("secret"))
        assert result == {"ok": True, "archived": 0}
        assert calls["archive_past"] == 1

    asyncio.run(scenario())

    assert [row["action"] for row in db.admin_audit.inserted] == [
        "event_archived",
        "event_restored",
    ]
