import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from fastapi import APIRouter, HTTPException
from starlette.requests import Request

# Keep this unit test runnable both from /app/backend and from the repository
# root, unlike the older integration tests that assume a deployed backend.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import admin_event_lifecycle
import claim_verification_safety


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
        self.org_claim_relationship_checks = FakeCollection()


def make_request(admin_code="", *, method="POST", path="/"):
    headers = []
    if admin_code:
        headers.append((b"x-admin-code", admin_code.encode("utf-8")))
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": headers,
            "query_string": b"",
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 1234),
            "scheme": "http",
            "root_path": "",
        }
    )


class FakeFormRequest:
    def __init__(self, path, confirmed="yes"):
        self.url = SimpleNamespace(path=path)
        self.confirmed = confirmed

    async def form(self):
        return {"confirmed": self.confirmed}


def test_prefixed_legacy_routes_are_replaced_and_secured():
    admin_event_lifecycle._INSTALLED = False
    claim_verification_safety._INSTALLED = False

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


def test_claim_email_link_get_is_read_only_and_post_records_decision():
    claim_verification_safety._INSTALLED = False
    api = APIRouter(prefix="/api")
    db = FakeDb()
    calls = {"decision": 0}
    token = "safe-test-token"
    secret = "secret"
    token_hash = claim_verification_safety._claim_token_hash(token, secret)
    db.org_claim_relationship_checks.rows.append(
        {
            "id": "verification-1",
            "token_hash": token_hash,
            "status": "pending",
            "org_name": "Test Organisation",
            "claimant_name": "Test Person",
            "claimant_email": "person@example.com",
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        }
    )

    @api.get("/claim-verifications/{token}/{decision}")
    async def legacy_decision(token: str, decision: str):
        calls["decision"] += 1
        return {"ok": True, "token": token, "decision": decision}

    claim_verification_safety.install_claim_verification_safety(
        api=api,
        db=db,
        admin_code=secret,
    )

    matching_get = [
        route.endpoint
        for route in api.routes
        if route.path == "/api/claim-verifications/{token}/{decision}" and "GET" in route.methods
    ]
    matching_post = [
        route.endpoint
        for route in api.routes
        if route.path == "/api/claim-verifications/{token}/{decision}" and "POST" in route.methods
    ]
    assert len(matching_get) == 1
    assert len(matching_post) == 1

    async def scenario():
        confirmation = await matching_get[0](
            token,
            "approve",
            make_request(
                method="GET",
                path=f"/api/claim-verifications/{token}/approve",
            ),
        )
        assert confirmation.status_code == 200
        body = confirmation.body.decode("utf-8")
        assert "method='post'" in body
        assert "Yes — confirm authorisation" in body
        assert calls["decision"] == 0

        try:
            await matching_post[0](
                token,
                "approve",
                FakeFormRequest(f"/api/claim-verifications/{token}/approve", confirmed=""),
            )
            assert False, "POST without explicit confirmation unexpectedly succeeded"
        except HTTPException as exc:
            assert exc.status_code == 400

        result = await matching_post[0](
            token,
            "approve",
            FakeFormRequest(f"/api/claim-verifications/{token}/approve"),
        )
        assert result["decision"] == "approve"
        assert calls["decision"] == 1

    asyncio.run(scenario())
