import asyncio
import os
import sys

from fastapi import APIRouter, HTTPException

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import admin_org_overview


class FakeRequest:
    def __init__(self, admin_code=""):
        self.headers = {}
        if admin_code:
            self.headers["X-Admin-Code"] = admin_code


class FakeCursor:
    def __init__(self, rows):
        self.rows = [dict(row) for row in rows]

    def sort(self, key, direction):
        reverse = direction < 0
        self.rows.sort(key=lambda row: str(row.get(key) or ""), reverse=reverse)
        return self

    async def to_list(self, length):
        if length is None:
            return list(self.rows)
        return list(self.rows[:length])


class FakeCollection:
    def __init__(self, rows=None):
        self.rows = [dict(row) for row in (rows or [])]

    def find(self, query=None, projection=None):
        query = query or {}
        matched = []
        for row in self.rows:
            if not self._matches(row, query):
                continue
            clean = dict(row)
            if projection:
                include = [key for key, value in projection.items() if value and key != "_id"]
                if include:
                    clean = {key: clean.get(key) for key in include if key in clean}
                if projection.get("_id") == 0:
                    clean.pop("_id", None)
            matched.append(clean)
        return FakeCursor(matched)

    def _matches(self, row, query):
        for key, wanted in query.items():
            actual = row.get(key)
            if isinstance(wanted, dict) and "$in" in wanted:
                if actual not in wanted["$in"]:
                    return False
            elif actual != wanted:
                return False
        return True


class FakeDb:
    def __init__(self):
        self.orgs = FakeCollection([
            {
                "slug": "alpha",
                "name": "Alpha Group",
                "status": "approved",
                "owner_email": "owner@alpha.test",
                "admin_emails": [],
            },
            {
                "slug": "bravo",
                "name": "Bravo Club",
                "status": "approved",
                "owner_email": "",
                "admin_emails": [],
            },
            {
                "slug": "charlie",
                "name": "Charlie Society",
                "status": "approved",
                "owner_email": "",
                "admin_emails": [],
            },
        ])
        self.org_members = FakeCollection([
            {
                "org_slug": "bravo",
                "email": "admin@bravo.test",
                "role": "admin",
                "status": "active",
                "last_login_at": "2026-09-10T18:00:00+00:00",
            },
            {
                "org_slug": "charlie",
                "email": "editor@charlie.test",
                "role": "editor",
                "status": "active",
                "last_login_at": "2026-09-09T18:00:00+00:00",
            },
        ])
        self.org_edit_requests = FakeCollection([
            {
                "org_slug": "bravo",
                "request_type": "claim",
                "status": "approved",
                "contact_email": "claimant@bravo.test",
                "created_at": "2026-09-01T12:00:00+00:00",
                "reviewed_at": "2026-09-02T12:00:00+00:00",
            },
            {
                "org_slug": "charlie",
                "request_type": "claim",
                "status": "pending",
                "contact_email": "claimant@charlie.test",
                "created_at": "2026-09-10T10:00:00+00:00",
            },
        ])
        self.admin_audit = FakeCollection([
            {
                "actor": "org",
                "action": "org_login",
                "entity_type": "org",
                "entity_id": "alpha",
                "created_at": "2026-09-10T19:00:00+00:00",
                "summary": "Organisation signed in: Alpha Group",
                "meta": {},
            },
            {
                "actor": "admin",
                "action": "org_quick_edited",
                "entity_type": "org",
                "entity_id": "charlie",
                "created_at": "2026-09-10T20:00:00+00:00",
                "summary": "Admin edited Charlie Society",
                "meta": {},
            },
        ])


def route_endpoint(api, path, method):
    matches = [
        route.endpoint
        for route in api.routes
        if route.path == path and method.upper() in route.methods
    ]
    assert len(matches) == 1
    return matches[0]


def test_org_overview_counts_claims_admins_and_real_org_activity():
    admin_org_overview._INSTALLED = False
    api = APIRouter(prefix="/api")
    db = FakeDb()
    admin_org_overview.install_admin_org_overview(api=api, db=db, admin_code="secret")

    endpoint = route_endpoint(api, "/api/admin/community/organisation-overview", "GET")

    async def scenario():
        try:
            await endpoint(FakeRequest())
            assert False, "Unauthenticated organisation overview unexpectedly succeeded"
        except HTTPException as exc:
            assert exc.status_code == 403

        result = await endpoint(FakeRequest("secret"))
        assert result["counts"] == {
            "total": 3,
            "claimed": 1,
            "unclaimed": 2,
            "with_admins": 2,
            "without_admins": 1,
        }

        by_slug = {row["slug"]: row for row in result["organisations"]}
        assert by_slug["alpha"]["claimed"] is False
        assert by_slug["alpha"]["has_admins"] is True
        assert by_slug["alpha"]["last_activity_source"] == "Organisation sign-in"

        assert by_slug["bravo"]["claimed"] is True
        assert by_slug["bravo"]["has_admins"] is True
        assert by_slug["bravo"]["last_activity_source"] == "Member sign-in"

        assert by_slug["charlie"]["claimed"] is False
        assert by_slug["charlie"]["has_admins"] is False
        assert by_slug["charlie"]["pending_claims"] == 1
        assert by_slug["charlie"]["last_activity_source"] == "Claim submitted"

        # Routine site-admin edits are intentionally not treated as organisation
        # activity, so Charlie's later admin-side edit is ignored.
        assert by_slug["charlie"]["last_activity_at"] == "2026-09-10T10:00:00+00:00"

    asyncio.run(scenario())
