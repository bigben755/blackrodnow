"""Authenticated admin quick-edit and live-check routes.

The original public venue/volunteer PATCH routes pre-date the consolidated
admin workspace and are intentionally left untouched because other site flows
may rely on them. The admin workspace uses the authenticated routes here.

The existing ``/admin/check`` endpoint performs a live AI/web verification but
did not itself enforce admin authentication. This installer wraps that endpoint
at bootstrap so the established checker implementation is retained while access
is restricted to site administrators.
"""
from __future__ import annotations

import hmac
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel

_INSTALLED = False


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


def _require_admin(request: Request, admin_code: str) -> Dict[str, Any]:
    supplied_code = str(request.headers.get("X-Admin-Code") or "").strip()
    if supplied_code and admin_code and hmac.compare_digest(supplied_code, admin_code):
        return {"role": "admin", "email": "legacy-admin"}

    authorization = str(request.headers.get("Authorization") or "").strip()
    if authorization.lower().startswith("bearer "):
        try:
            from auth import decode_token

            payload = decode_token(authorization[7:].strip())
            if str(payload.get("role") or "") == "admin":
                return payload
        except Exception:
            pass

    raise HTTPException(403, "Admin authentication required")


async def _audit(
    db,
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    summary: str,
    actor: str,
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    await db.admin_audit.insert_one(
        {
            "id": _new_id(),
            "actor": actor,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "summary": summary,
            "meta": meta or {},
            "created_at": _now_iso(),
        }
    )


def _find_route_endpoint(api, path_suffix: str, method: str):
    wanted = method.upper()
    for route in api.routes:
        path = str(getattr(route, "path", "") or "")
        methods = set(getattr(route, "methods", set()) or set())
        if path.endswith(path_suffix) and wanted in methods:
            return getattr(route, "endpoint", None)
    return None


def _remove_route(api, path_suffix: str, method: str) -> None:
    wanted = method.upper()
    api.routes[:] = [
        route
        for route in api.routes
        if not (
            str(getattr(route, "path", "") or "").endswith(path_suffix)
            and wanted in set(getattr(route, "methods", set()) or set())
        )
    ]


class AdminCheckReq(BaseModel):
    kind: Literal["event", "org"]
    id: str


ORG_FIELDS = {"name", "category", "short", "email", "phone", "website", "address"}
VENUE_FIELDS = {"name", "address", "facilities", "accessibility", "capacity", "booking", "image"}
VOLUNTEER_FIELDS = {"title", "orgSlug", "description", "age", "time", "skills"}


def _clean_patch(payload: Any, allowed: set[str]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(400, "A JSON object is required")
    return {key: value for key, value in payload.items() if key in allowed}


def _actor(admin: Dict[str, Any]) -> str:
    return str(admin.get("email") or admin.get("sub") or "admin")


def install_admin_content_security(*, api, db, admin_code: str) -> None:
    global _INSTALLED
    if _INSTALLED:
        return
    _INSTALLED = True

    # Capture and replace the established live checker with an authenticated
    # wrapper. Its existing web/LLM logic and persistence remain unchanged.
    original_check = _find_route_endpoint(api, "/admin/check", "POST")
    if original_check is not None:
        _remove_route(api, "/admin/check", "POST")

        @api.post("/admin/check")
        async def secure_admin_check(req: AdminCheckReq, request: Request):
            _require_admin(request, admin_code)
            return await original_check(req)

    @api.patch("/admin/community/organisations/{slug}")
    async def admin_quick_edit_organisation(slug: str, request: Request):
        admin = _require_admin(request, admin_code)
        existing = await db.orgs.find_one({"slug": slug}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Organisation not found")

        try:
            payload = await request.json()
        except Exception:
            payload = {}
        updates = _clean_patch(payload, ORG_FIELDS)
        if not updates:
            raise HTTPException(400, "No editable organisation fields supplied")
        if "name" in updates and not str(updates.get("name") or "").strip():
            raise HTTPException(400, "Organisation name is required")
        if "email" in updates:
            email = str(updates.get("email") or "").strip().lower()
            if email and "@" not in email:
                raise HTTPException(400, "Enter a valid email address")
            updates["email"] = email
        updates["updated_at"] = _now_iso()

        await db.orgs.update_one({"slug": slug}, {"$set": updates})
        updated = await db.orgs.find_one({"slug": slug}, {"_id": 0})
        await _audit(
            db,
            action="org_quick_edited",
            entity_type="org",
            entity_id=slug,
            summary=f"Organisation updated: {existing.get('name') or slug}",
            actor=_actor(admin),
            meta={"fields": sorted(key for key in updates if key != "updated_at")},
        )
        return updated

    @api.patch("/admin/community/venues/{venue_id}")
    async def admin_quick_edit_venue(venue_id: str, request: Request):
        admin = _require_admin(request, admin_code)
        existing = await db.venues.find_one({"id": venue_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Venue not found")

        try:
            payload = await request.json()
        except Exception:
            payload = {}
        updates = _clean_patch(payload, VENUE_FIELDS)
        if not updates:
            raise HTTPException(400, "No editable venue fields supplied")
        if "name" in updates and not str(updates.get("name") or "").strip():
            raise HTTPException(400, "Venue name is required")
        if "facilities" in updates and not isinstance(updates.get("facilities"), list):
            raise HTTPException(400, "Facilities must be a list")
        if "capacity" in updates:
            capacity = updates.get("capacity")
            if capacity in ("", None):
                updates["capacity"] = None
            else:
                try:
                    parsed = int(capacity)
                except (TypeError, ValueError):
                    raise HTTPException(400, "Capacity must be a whole number")
                if parsed < 0:
                    raise HTTPException(400, "Capacity cannot be negative")
                updates["capacity"] = parsed
        updates["updated_at"] = _now_iso()

        await db.venues.update_one({"id": venue_id}, {"$set": updates})
        updated = await db.venues.find_one({"id": venue_id}, {"_id": 0})
        await _audit(
            db,
            action="venue_quick_edited",
            entity_type="site",
            entity_id=venue_id,
            summary=f"Venue updated: {existing.get('name') or venue_id}",
            actor=_actor(admin),
            meta={"fields": sorted(key for key in updates if key != "updated_at")},
        )
        return updated

    @api.patch("/admin/community/volunteers/{volunteer_id}")
    async def admin_quick_edit_volunteer(volunteer_id: str, request: Request):
        admin = _require_admin(request, admin_code)
        existing = await db.volunteers.find_one({"id": volunteer_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Volunteer opportunity not found")

        try:
            payload = await request.json()
        except Exception:
            payload = {}
        updates = _clean_patch(payload, VOLUNTEER_FIELDS)
        if not updates:
            raise HTTPException(400, "No editable volunteer fields supplied")
        if "title" in updates and not str(updates.get("title") or "").strip():
            raise HTTPException(400, "Volunteer opportunity title is required")
        if "orgSlug" in updates:
            slug = str(updates.get("orgSlug") or "").strip()
            if not slug:
                raise HTTPException(400, "Choose an organisation")
            org = await db.orgs.find_one({"slug": slug}, {"_id": 0, "slug": 1})
            if not org:
                raise HTTPException(400, "Selected organisation does not exist")
            updates["orgSlug"] = slug
        updates["updated_at"] = _now_iso()

        await db.volunteers.update_one({"id": volunteer_id}, {"$set": updates})
        updated = await db.volunteers.find_one({"id": volunteer_id}, {"_id": 0})
        await _audit(
            db,
            action="volunteer_quick_edited",
            entity_type="site",
            entity_id=volunteer_id,
            summary=f"Volunteer opportunity updated: {existing.get('title') or volunteer_id}",
            actor=_actor(admin),
            meta={"fields": sorted(key for key in updates if key != "updated_at"), "org_slug": updated.get("orgSlug") if updated else None},
        )
        return updated
