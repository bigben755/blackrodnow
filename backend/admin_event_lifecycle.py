"""Authenticated admin lifecycle helpers for Blackrod Now.

The core server already contains legacy archive-past and restore routes, but the
new consolidated admin workspace also needs an authenticated single-event
archive action. This installer is loaded before ``app.include_router(api)`` so
it can harden the legacy routes without touching the large ``server.py``.
"""
from __future__ import annotations

import hmac
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import HTTPException, Request

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
    event: Dict[str, Any],
    summary: str,
    actor: str = "admin",
) -> None:
    await db.admin_audit.insert_one(
        {
            "id": _new_id(),
            "actor": actor,
            "action": action,
            "entity_type": "event",
            "entity_id": str(event.get("id") or ""),
            "summary": summary,
            "meta": {
                "org_slug": event.get("orgSlug"),
                "title": event.get("title"),
            },
            "created_at": _now_iso(),
        }
    )


def _find_route_endpoint(api, path_suffix: str, method: str):
    """Find a route even when APIRouter has the application's /api prefix."""
    wanted_method = method.upper()
    for route in api.routes:
        route_path = str(getattr(route, "path", "") or "")
        methods = set(getattr(route, "methods", set()) or set())
        if route_path.endswith(path_suffix) and wanted_method in methods:
            return getattr(route, "endpoint", None)
    return None


def _remove_route(api, path_suffix: str, method: str) -> None:
    """Remove a route by suffix so prefixed APIRouter paths are handled."""
    wanted_method = method.upper()
    api.routes[:] = [
        route
        for route in api.routes
        if not (
            str(getattr(route, "path", "") or "").endswith(path_suffix)
            and wanted_method in set(getattr(route, "methods", set()) or set())
        )
    ]


def install_admin_event_lifecycle(*, api, db, admin_code: str) -> None:
    """Install secure event lifecycle routes used by both admin UIs."""
    global _INSTALLED
    if _INSTALLED:
        return
    _INSTALLED = True

    # Capture the existing bulk archive implementation before replacing its
    # route with an authenticated wrapper. Keeping the original implementation
    # preserves its recurrence/date handling exactly.
    original_archive_past = _find_route_endpoint(
        api,
        "/admin/events/archive-past",
        "POST",
    )

    # The existing restore endpoint did not perform an admin check. Remove it
    # and register a secure equivalent below. The bulk archive route is also
    # wrapped because it previously had no explicit request authentication.
    _remove_route(api, "/admin/events/archive-past", "POST")
    _remove_route(api, "/admin/events/{event_id}/restore", "POST")

    async def _archive_one(event_id: str) -> Dict[str, Any]:
        event = await db.events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(404, "Event not found")
        if str(event.get("status") or "") == "archived":
            return {"ok": True, "event_id": event_id, "status": "archived", "already_archived": True}

        archived_at = _now_iso()
        await db.events.update_one(
            {"id": event_id},
            {
                "$set": {
                    "status": "archived",
                    "archived_at": archived_at,
                    "featured": False,
                }
            },
        )
        await _audit(
            db,
            action="event_archived",
            event=event,
            summary=f"Archived event: {event.get('title') or event_id}",
        )
        return {"ok": True, "event_id": event_id, "status": "archived", "archived_at": archived_at}

    async def _restore_one(event_id: str) -> Dict[str, Any]:
        event = await db.events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(404, "Event not found")
        if str(event.get("status") or "") != "archived":
            raise HTTPException(409, "Event is not archived")

        await db.events.update_one(
            {"id": event_id},
            {
                "$set": {"status": "approved"},
                "$unset": {"archived_at": ""},
            },
        )
        await _audit(
            db,
            action="event_restored",
            event=event,
            summary=f"Restored event: {event.get('title') or event_id}",
        )
        return {"ok": True, "event_id": event_id, "status": "approved"}

    @api.post("/admin/community/events/{event_id}/archive")
    async def admin_community_archive_event(event_id: str, request: Request):
        _require_admin(request, admin_code)
        return await _archive_one(event_id)

    @api.post("/admin/community/events/{event_id}/restore")
    async def admin_community_restore_event(event_id: str, request: Request):
        _require_admin(request, admin_code)
        return await _restore_one(event_id)

    @api.post("/admin/events/{event_id}/restore")
    async def secure_legacy_admin_restore_event(event_id: str, request: Request):
        _require_admin(request, admin_code)
        return await _restore_one(event_id)

    @api.post("/admin/events/archive-past")
    async def secure_legacy_admin_archive_past(request: Request):
        _require_admin(request, admin_code)
        if original_archive_past is None:
            raise HTTPException(503, "Archive-past operation is unavailable")
        return await original_archive_past()

    # Community actions has already installed the claim-verification endpoint by
    # the time this lifecycle installer runs. Replace its state-changing GET
    # link with a read-only confirmation page plus explicit POST decision.
    from claim_verification_safety import install_claim_verification_safety
    from admin_content_security import install_admin_content_security
    from admin_org_overview import install_admin_org_overview
    from admin_events_attention_fix import install_admin_events_attention_fix

    install_claim_verification_safety(
        api=api,
        db=db,
        admin_code=admin_code,
    )
    install_admin_content_security(
        api=api,
        db=db,
        admin_code=admin_code,
    )
    install_admin_org_overview(
        api=api,
        db=db,
        admin_code=admin_code,
    )
    install_admin_events_attention_fix(
        api=api,
        db=db,
        admin_code=admin_code,
    )
