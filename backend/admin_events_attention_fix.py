"""Safe replacement for the legacy admin event-attention summary.

The original endpoint compares timezone-aware ``now`` values with event dates
that may be stored without a timezone offset. Python rejects aware/naive
comparisons, which produced a 500 for otherwise valid event data. This module
re-registers the same authenticated endpoint and normalises every parsed event
datetime to UTC before comparison.
"""
from __future__ import annotations

import hmac
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request

_INSTALLED = False


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


def _remove_route(api, path_suffix: str, method: str) -> None:
    wanted_method = method.upper()
    api.routes[:] = [
        route
        for route in api.routes
        if not (
            str(getattr(route, "path", "") or "").endswith(path_suffix)
            and wanted_method in set(getattr(route, "methods", set()) or set())
        )
    ]


def _event_dt(value: Any) -> Optional[datetime]:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except Exception:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        parsed = parsed.astimezone(timezone.utc)
    return parsed


def install_admin_events_attention_fix(*, api, db, admin_code: str) -> None:
    global _INSTALLED
    if _INSTALLED:
        return
    _INSTALLED = True

    _remove_route(api, "/admin/events/attention", "GET")

    @api.get("/admin/events/attention")
    async def admin_events_attention_fixed(request: Request):
        _require_admin(request, admin_code)
        rows = await db.events.find({}, {"_id": 0}).to_list(10000)
        now_dt = datetime.now(timezone.utc)

        def _normalized_title(value: str) -> str:
            return re.sub(r"[^a-z0-9]+", " ", (value or "").strip().lower()).strip()

        by_key = Counter()
        for event in rows:
            key = (_normalized_title(event.get("title") or ""), str(event.get("start") or "")[:10])
            if key[0] and key[1]:
                by_key[key] += 1

        possible_duplicate = sum(1 for count in by_key.values() if count > 1)
        missing_venue = sum(1 for event in rows if not str(event.get("venue") or "").strip())
        missing_image = sum(1 for event in rows if not str(event.get("image") or "").strip())
        missing_time = 0
        date_passed_published = 0
        status_counts = Counter((event.get("status") or "pending") for event in rows)

        for event in rows:
            start = _event_dt(event.get("start"))
            if not start or (start.hour == 0 and start.minute == 0 and start.second == 0):
                missing_time += 1

            end_value = _event_dt(event.get("end")) or start
            if (event.get("status") or "pending") == "approved" and end_value and end_value < now_dt:
                date_passed_published += 1

        upcoming = sum(
            1
            for event in rows
            if (_event_dt(event.get("end")) or _event_dt(event.get("start")) or now_dt) >= now_dt
        )
        past = max(0, len(rows) - upcoming)

        return {
            "counts": {
                "total": len(rows),
                "upcoming": upcoming,
                "past": past,
                "draft": status_counts.get("draft", 0),
                "pending": status_counts.get("pending", 0),
                "cancelled": status_counts.get("cancelled", 0),
                "approved": status_counts.get("approved", 0),
                "rejected": status_counts.get("rejected", 0),
            },
            "attention": {
                "missing_venue": missing_venue,
                "missing_time": missing_time,
                "missing_image": missing_image,
                "possible_duplicate": possible_duplicate,
                "date_passed_but_published": date_passed_published,
            },
        }
