"""Fast admin overview of organisation ownership, admins and recent activity.

This is deliberately separate from the main server module so the consolidated
admin workspace can show claimed/unclaimed organisations, admin coverage and
last genuine organisation-side activity without adding more code to server.py.
"""
from __future__ import annotations

import hmac
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


def _parse_time(value: Any) -> Optional[datetime]:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def _activity_label(action: str, summary: str = "") -> str:
    labels = {
        "org_login": "Organisation sign-in",
        "org_member_login": "Member sign-in",
        "org_password_changed": "Organisation password changed",
        "org_claim_submitted": "Claim submitted",
    }
    if action in labels:
        return labels[action]
    if summary:
        return summary[:120]
    return str(action or "Organisation activity").replace("_", " ").strip().title()


def _set_latest(
    latest: Dict[str, Dict[str, Any]],
    slug: str,
    when: Any,
    source: str,
) -> None:
    clean_slug = str(slug or "").strip()
    parsed = _parse_time(when)
    if not clean_slug or not parsed:
        return

    current = latest.get(clean_slug)
    if current and current["parsed"] >= parsed:
        return

    latest[clean_slug] = {
        "parsed": parsed,
        "at": str(when),
        "source": source,
    }


def install_admin_org_overview(*, api, db, admin_code: str) -> None:
    global _INSTALLED
    if _INSTALLED:
        return
    _INSTALLED = True

    @api.get("/admin/community/organisation-overview")
    async def admin_organisation_overview(request: Request):
        _require_admin(request, admin_code)

        org_rows = await db.orgs.find({}, {"_id": 0}).to_list(5000)
        member_rows = await db.org_members.find(
            {"status": "active"},
            {
                "_id": 0,
                "org_slug": 1,
                "email": 1,
                "role": 1,
                "last_login_at": 1,
            },
        ).to_list(10000)
        claim_rows = await db.org_edit_requests.find(
            {
                "request_type": "claim",
                "status": {"$in": ["approved", "pending"]},
            },
            {
                "_id": 0,
                "org_slug": 1,
                "status": 1,
                "contact_email": 1,
                "created_at": 1,
                "reviewed_at": 1,
            },
        ).to_list(10000)
        activity_rows = await db.admin_audit.find(
            {"actor": "org"},
            {
                "_id": 0,
                "action": 1,
                "entity_type": 1,
                "entity_id": 1,
                "summary": 1,
                "meta": 1,
                "created_at": 1,
            },
        ).sort("created_at", -1).to_list(20000)

        members_by_org: Dict[str, list[Dict[str, Any]]] = {}
        latest_activity: Dict[str, Dict[str, Any]] = {}
        for member in member_rows:
            slug = str(member.get("org_slug") or "").strip()
            if not slug:
                continue
            members_by_org.setdefault(slug, []).append(member)
            _set_latest(
                latest_activity,
                slug,
                member.get("last_login_at"),
                "Member sign-in",
            )

        approved_claims: Dict[str, Dict[str, Any]] = {}
        pending_claim_counts: Dict[str, int] = {}
        for claim in claim_rows:
            slug = str(claim.get("org_slug") or "").strip()
            if not slug:
                continue
            if claim.get("status") == "approved":
                previous = approved_claims.get(slug)
                claim_time = _parse_time(claim.get("reviewed_at") or claim.get("created_at"))
                previous_time = _parse_time(
                    (previous or {}).get("reviewed_at") or (previous or {}).get("created_at")
                )
                if previous is None or (claim_time and (previous_time is None or claim_time > previous_time)):
                    approved_claims[slug] = claim
            elif claim.get("status") == "pending":
                pending_claim_counts[slug] = pending_claim_counts.get(slug, 0) + 1

            # Claim submission is genuine organisation-side activity even before
            # the site administrator completes the approval step.
            _set_latest(
                latest_activity,
                slug,
                claim.get("created_at"),
                "Claim submitted",
            )

        for row in activity_rows:
            meta = row.get("meta") or {}
            slug = str(meta.get("org_slug") or "").strip()
            if not slug and row.get("entity_type") == "org":
                slug = str(row.get("entity_id") or "").strip()
            _set_latest(
                latest_activity,
                slug,
                row.get("created_at"),
                _activity_label(
                    str(row.get("action") or ""),
                    str(row.get("summary") or ""),
                ),
            )

        organisations = []
        claimed_count = 0
        with_admins_count = 0

        for org in org_rows:
            slug = str(org.get("slug") or "").strip()
            approved_claim = approved_claims.get(slug)
            claimed = bool(org.get("managed_by_org")) or approved_claim is not None
            if claimed:
                claimed_count += 1

            admin_people: list[Dict[str, str]] = []
            seen_emails = set()

            owner_email = str(org.get("owner_email") or "").strip().lower()
            if owner_email:
                seen_emails.add(owner_email)
                admin_people.append({"email": owner_email, "role": "owner", "source": "organisation"})

            for value in org.get("admin_emails") or []:
                email = str(value or "").strip().lower()
                if email and email not in seen_emails:
                    seen_emails.add(email)
                    admin_people.append({"email": email, "role": "admin", "source": "organisation"})

            active_members = members_by_org.get(slug, [])
            for member in active_members:
                role = str(member.get("role") or "editor").strip().lower()
                if role not in {"owner", "admin"}:
                    continue
                email = str(member.get("email") or "").strip().lower()
                if email and email not in seen_emails:
                    seen_emails.add(email)
                    admin_people.append({"email": email, "role": role, "source": "member"})

            has_admins = bool(admin_people)
            if has_admins:
                with_admins_count += 1

            activity = latest_activity.get(slug)
            organisations.append({
                "slug": slug,
                "name": org.get("name") or slug,
                "status": org.get("status") or "approved",
                "category": org.get("category") or "",
                "email": str(org.get("email") or "").strip().lower(),
                "claimed": claimed,
                "claimed_at": (
                    (approved_claim or {}).get("reviewed_at")
                    or (approved_claim or {}).get("created_at")
                    or org.get("managed_since")
                    or None
                ),
                "claim_contact_email": str((approved_claim or {}).get("contact_email") or "").strip().lower(),
                "pending_claims": pending_claim_counts.get(slug, 0),
                "has_admins": has_admins,
                "admin_count": len(admin_people),
                "admins": admin_people,
                "active_member_count": len(active_members),
                "last_activity_at": activity.get("at") if activity else None,
                "last_activity_source": activity.get("source") if activity else "",
            })

        organisations.sort(
            key=lambda row: (
                row.get("last_activity_at") or "",
                str(row.get("name") or "").lower(),
            ),
            reverse=True,
        )

        total = len(organisations)
        return {
            "counts": {
                "total": total,
                "claimed": claimed_count,
                "unclaimed": max(0, total - claimed_count),
                "with_admins": with_admins_count,
                "without_admins": max(0, total - with_admins_count),
            },
            "organisations": organisations,
        }
