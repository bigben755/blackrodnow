import asyncio
import os
import sys
from types import SimpleNamespace

from fastapi import APIRouter, HTTPException

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import admin_content_security


class FakeRequest:
    def __init__(self, *, admin_code="", payload=None):
        self.headers = {}
        if admin_code:
            self.headers["X-Admin-Code"] = admin_code
        self._payload = payload if payload is not None else {}

    async def json(self):
        return self._payload


class FakeCollection:
    def __init__(self, rows=None):
        self.rows = [dict(row) for row in (rows or [])]
        self.inserted = []

    async def find_one(self, query, projection=None, **kwargs):
        for row in self.rows:
            if all(row.get(key) == value for key, value in query.items()):
                result = dict(row)
                if projection:
                    if projection.get("_id") == 0:
                        result.pop("_id", None)
                    include = [key for key, value in projection.items() if value and key != "_id"]
                    if include:
                        result = {key: result.get(key) for key in include if key in result}
                return result
        return None

    async def update_one(self, query, update):
        for row in self.rows:
            if all(row.get(key) == value for key, value in query.items()):
                for key, value in update.get("$set", {}).items():
                    row[key] = value
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)

    async def insert_one(self, row):
        self.inserted.append(dict(row))
        return SimpleNamespace(inserted_id=row.get("id"))


class FakeDb:
    def __init__(self):
        self.orgs = FakeCollection([
            {"slug": "org-one", "name": "Org One", "email": "OLD@example.com"},
            {"slug": "org-two", "name": "Org Two", "email": "two@example.com"},
        ])
        self.venues = FakeCollection([
            {"id": "venue-one", "name": "Venue One", "capacity": 20},
        ])
        self.volunteers = FakeCollection([
            {"id": "vol-one", "title": "Help out", "orgSlug": "org-one"},
        ])
        self.admin_audit = FakeCollection()


def route_endpoint(api, path, method):
    matches = [
        route.endpoint
        for route in api.routes
        if route.path == path and method.upper() in route.methods
    ]
    assert len(matches) == 1, f"Expected exactly one {method} {path}; found {len(matches)}"
    return matches[0]


def test_live_check_is_wrapped_with_admin_authentication():
    admin_content_security._INSTALLED = False
    api = APIRouter(prefix="/api")
    db = FakeDb()
    calls = {"count": 0}

    @api.post("/admin/check")
    async def legacy_check(req: admin_content_security.AdminCheckReq):
        calls["count"] += 1
        return {"kind": req.kind, "id": req.id, "verdict": "looks_accurate"}

    admin_content_security.install_admin_content_security(
        api=api,
        db=db,
        admin_code="secret",
    )

    check = route_endpoint(api, "/api/admin/check", "POST")

    async def scenario():
        req = admin_content_security.AdminCheckReq(kind="event", id="event-one")
        try:
            await check(req, FakeRequest())
            assert False, "Unauthenticated live check unexpectedly succeeded"
        except HTTPException as exc:
            assert exc.status_code == 403

        result = await check(req, FakeRequest(admin_code="secret"))
        assert result["verdict"] == "looks_accurate"
        assert calls["count"] == 1

    asyncio.run(scenario())


def test_admin_quick_edits_require_auth_and_validate_updates():
    admin_content_security._INSTALLED = False
    api = APIRouter(prefix="/api")
    db = FakeDb()

    admin_content_security.install_admin_content_security(
        api=api,
        db=db,
        admin_code="secret",
    )

    update_org = route_endpoint(api, "/api/admin/community/organisations/{slug}", "PATCH")
    update_venue = route_endpoint(api, "/api/admin/community/venues/{venue_id}", "PATCH")
    update_volunteer = route_endpoint(api, "/api/admin/community/volunteers/{volunteer_id}", "PATCH")

    async def scenario():
        try:
            await update_org("org-one", FakeRequest(payload={"name": "Changed"}))
            assert False, "Unauthenticated organisation edit unexpectedly succeeded"
        except HTTPException as exc:
            assert exc.status_code == 403

        org = await update_org(
            "org-one",
            FakeRequest(
                admin_code="secret",
                payload={"name": "Org One Updated", "email": "HELLO@EXAMPLE.COM", "slug": "forbidden-change"},
            ),
        )
        assert org["name"] == "Org One Updated"
        assert org["email"] == "hello@example.com"
        assert org["slug"] == "org-one"

        try:
            await update_venue(
                "venue-one",
                FakeRequest(admin_code="secret", payload={"capacity": -1}),
            )
            assert False, "Negative capacity unexpectedly succeeded"
        except HTTPException as exc:
            assert exc.status_code == 400

        venue = await update_venue(
            "venue-one",
            FakeRequest(admin_code="secret", payload={"capacity": 50, "facilities": ["Kitchen", "Parking"]}),
        )
        assert venue["capacity"] == 50
        assert venue["facilities"] == ["Kitchen", "Parking"]

        try:
            await update_volunteer(
                "vol-one",
                FakeRequest(admin_code="secret", payload={"orgSlug": "missing-org"}),
            )
            assert False, "Unknown organisation reassignment unexpectedly succeeded"
        except HTTPException as exc:
            assert exc.status_code == 400

        volunteer = await update_volunteer(
            "vol-one",
            FakeRequest(admin_code="secret", payload={"orgSlug": "org-two", "title": "New role"}),
        )
        assert volunteer["orgSlug"] == "org-two"
        assert volunteer["title"] == "New role"

    asyncio.run(scenario())

    actions = [row["action"] for row in db.admin_audit.inserted]
    assert actions == ["org_quick_edited", "venue_quick_edited", "volunteer_quick_edited"]
