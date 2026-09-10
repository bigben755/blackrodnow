"""Community interaction and admin content-management routes for Blackrod Now.

This module is installed by the existing optional-integration bootstrap before
the main API router is attached to the FastAPI app. Keeping these features here
avoids adding more unrelated concerns to the already-large ``server.py`` while
still using the application's existing Mongo database and admin-authentication
conventions.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import html
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Literal, Optional

from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

_INSTALLED = False


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


def _require_admin(request: Request, admin_code: str) -> Dict[str, Any]:
    supplied_code = str(request.headers.get("X-Admin-Code") or "").strip()
    if supplied_code and hmac.compare_digest(supplied_code, admin_code):
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
    meta: Optional[Dict[str, Any]] = None,
    actor: str = "admin",
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


def _hash_org_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        200000,
    ).hex()


def _new_temporary_password(length: int = 14) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*"
    return "".join(secrets.choice(alphabet) for _ in range(max(12, length)))


def _mask_email(address: str) -> str:
    text = str(address or "").strip()
    if "@" not in text:
        return text
    local, domain = text.split("@", 1)
    if len(local) <= 2:
        masked = local[:1] + "*"
    else:
        masked = local[:2] + ("*" * max(1, len(local) - 2))
    return f"{masked}@{domain}"


async def _registered_org_email(db, org: Dict[str, Any]) -> str:
    """Resolve the best account/registered email for security messages.

    Account ownership data is preferred over the public-facing contact address.
    Older records may only have ``email``, so that remains the final fallback.
    """
    candidates = []

    owner = str(org.get("owner_email") or "").strip().lower()
    if owner:
        candidates.append(owner)

    for value in org.get("admin_emails") or []:
        email = str(value or "").strip().lower()
        if email:
            candidates.append(email)

    member = await db.org_members.find_one(
        {
            "org_slug": org.get("slug"),
            "status": "active",
            "role": {"$in": ["owner", "admin"]},
        },
        {"_id": 0, "email": 1},
        sort=[("role", 1), ("created_at", 1)],
    )
    if member and member.get("email"):
        candidates.append(str(member["email"]).strip().lower())

    public_email = str(org.get("email") or "").strip().lower()
    if public_email:
        candidates.append(public_email)

    seen = set()
    for candidate in candidates:
        if candidate and candidate not in seen:
            return candidate
        seen.add(candidate)
    return ""


def _send_password_reset_email(
    *,
    recipient: str,
    org_name: str,
    password: str,
    public_url: str,
) -> Dict[str, Any]:
    api_key = str(os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured")

    import resend

    resend.api_key = api_key
    sender_email = str(os.environ.get("SENDER_EMAIL") or "onboarding@resend.dev").strip()
    sender_name = str(os.environ.get("SENDER_NAME") or "Blackrod Now").strip()
    from_field = f'"{sender_name}" <{sender_email}>' if sender_name else sender_email
    dashboard_url = f"{public_url.rstrip('/')}/organisation-dashboard"

    body = (
        f"<p>Hello,</p>"
        f"<p>The password for <strong>{html.escape(org_name)}</strong> on Blackrod Now has been reset by the site administrator.</p>"
        f"<p><strong>New password:</strong> {html.escape(password)}</p>"
        f"<p>Sign in to your organisation dashboard here:<br>"
        f"<a href='{html.escape(dashboard_url)}'>{html.escape(dashboard_url)}</a></p>"
        f"<p>Please change this password after signing in.</p>"
        f"<p>If you did not expect this reset, reply to this email and let Blackrod Now know.</p>"
        f"<p>Kind regards,<br><strong>Blackrod Now</strong></p>"
    )

    result = resend.Emails.send(
        {
            "from": from_field,
            "to": [recipient],
            "subject": f"Blackrod Now password reset — {org_name}",
            "html": body,
        }
    )

    if isinstance(result, dict):
        provider_id = result.get("id")
    else:
        provider_id = getattr(result, "id", None)

    return {"ok": True, "id": provider_id}


def _claim_token_hash(token: str, secret: str) -> str:
    return hmac.new(
        str(secret or "blackrod-now").encode("utf-8"),
        str(token or "").encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _send_claim_relationship_email(
    *,
    recipient: str,
    org_name: str,
    claimant_name: str,
    claimant_email: str,
    token: str,
    public_url: str,
) -> Dict[str, Any]:
    api_key = str(os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured")

    import resend

    resend.api_key = api_key
    sender_email = str(os.environ.get("SENDER_EMAIL") or "onboarding@resend.dev").strip()
    sender_name = str(os.environ.get("SENDER_NAME") or "Blackrod Now").strip()
    from_field = f'"{sender_name}" <{sender_email}>' if sender_name else sender_email
    base = public_url.rstrip("/")
    approve_url = f"{base}/api/claim-verifications/{token}/approve"
    reject_url = f"{base}/api/claim-verifications/{token}/reject"

    safe_org = html.escape(org_name)
    safe_name = html.escape(claimant_name or "Someone")
    safe_email = html.escape(claimant_email)
    email_html = (
        f"<p>Hello,</p>"
        f"<p><strong>{safe_name}</strong> ({safe_email}) has asked Blackrod Now for permission to manage the "
        f"<strong>{safe_org}</strong> community profile.</p>"
        f"<p>We are contacting this address because it is already recorded as an official or established contact for the organisation.</p>"
        f"<p>If this person is authorised to manage the organisation's Blackrod Now page, please confirm below:</p>"
        f"<p><a href='{html.escape(approve_url)}' style='display:inline-block;padding:12px 18px;background:#0052FF;color:#fff;text-decoration:none;border-radius:999px;font-weight:700'>Confirm authorised representative</a></p>"
        f"<p>If you do not recognise or authorise the request, you can reject it here:</p>"
        f"<p><a href='{html.escape(reject_url)}'>Reject this claim request</a></p>"
        f"<p>This confirmation link expires after 72 hours. Confirming does not immediately publish changes; a Blackrod Now administrator still completes the final access review.</p>"
        f"<p>Kind regards,<br><strong>Blackrod Now</strong></p>"
    )

    result = resend.Emails.send({
        "from": from_field,
        "to": [recipient],
        "subject": f"Confirm who can manage {org_name} on Blackrod Now",
        "html": email_html,
    })
    provider_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
    return {"ok": True, "id": provider_id}


def _admin_sender_options() -> tuple[list[str], str, str]:
    default_email = str(os.environ.get("SENDER_EMAIL") or "onboarding@resend.dev").strip()
    sender_name = str(os.environ.get("SENDER_NAME") or "Blackrod Now").strip()
    configured = [
        item.strip()
        for item in str(os.environ.get("ADMIN_SENDER_EMAILS") or default_email).split(",")
        if item.strip()
    ]
    if default_email and default_email not in configured:
        configured.insert(0, default_email)
    return configured, default_email, sender_name


def _message_html(subject: str, body: str) -> str:
    safe_subject = html.escape(subject or "Blackrod Now")
    paragraphs = []
    for chunk in str(body or "").replace("\r\n", "\n").split("\n\n"):
        safe = html.escape(chunk.strip()).replace("\n", "<br>")
        if safe:
            paragraphs.append(f"<p>{safe}</p>")
    body_html = "".join(paragraphs) or "<p></p>"
    return (
        "<div style='font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#111827'>"
        "<div style='border-bottom:4px solid #0052FF;padding:18px 0'>"
        "<strong style='font-size:22px'>Blackrod Now</strong>"
        "</div>"
        f"<h2 style='margin-top:24px'>{safe_subject}</h2>"
        f"{body_html}"
        "<hr style='margin:28px 0;border:0;border-top:1px solid #e5e7eb'>"
        "<p style='font-size:12px;color:#6b7280'>What's New. What's On. What's Next.</p>"
        "</div>"
    )


def _send_admin_message_email(
    *,
    recipient: str,
    subject: str,
    body: str,
    from_email: str,
    from_name: str,
    reply_to: str = "",
    attachments: Optional[list[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    api_key = str(os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured")

    import resend

    resend.api_key = api_key
    payload: Dict[str, Any] = {
        "from": f'"{from_name}" <{from_email}>' if from_name else from_email,
        "to": [recipient],
        "subject": subject,
        "html": _message_html(subject, body),
    }
    if reply_to:
        payload["reply_to"] = reply_to
    if attachments:
        payload["attachments"] = [
            {
                "filename": item["filename"],
                "content": item["content"],
                "content_type": item.get("content_type") or "application/octet-stream",
            }
            for item in attachments
        ]
    result = resend.Emails.send(payload)
    provider_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
    return {"ok": True, "id": provider_id}


class FeedLikeReq(BaseModel):
    device_id: str = Field(min_length=3, max_length=200)
    action: Literal["add", "remove"] = "add"


class VolunteerContactReq(BaseModel):
    name: str = Field(default="", max_length=120)
    email: EmailStr
    message: str = Field(min_length=5, max_length=3000)


class ClaimReviewReq(BaseModel):
    status: Literal["approved", "rejected"]
    reviewer_notes: str = ""


def _find_route_endpoint(api, path_suffix: str, method: str):
    """Return the endpoint function for a route already registered on APIRouter."""
    wanted_method = method.upper()
    for route in api.routes:
        route_path = str(getattr(route, "path", "") or "")
        methods = set(getattr(route, "methods", set()) or set())
        if route_path.endswith(path_suffix) and wanted_method in methods:
            return getattr(route, "endpoint", None)
    return None


def _remove_route(api, path_suffix: str, method: str) -> None:
    """Remove an existing APIRouter route before the router is included.

    The normal password-reset endpoint already exists in server.py. We replace
    that single route here so existing frontend code keeps the same URL while
    gaining reliable email delivery and rollback-on-email-failure behaviour.
    """
    wanted_method = method.upper()
    retained = []
    for route in api.routes:
        route_path = str(getattr(route, "path", "") or "")
        methods = set(getattr(route, "methods", set()) or set())
        if route_path.endswith(path_suffix) and wanted_method in methods:
            continue
        retained.append(route)
    api.routes[:] = retained


def install_community_actions(*, app, api, db, public_url: str, admin_code: str) -> None:
    global _INSTALLED
    if _INSTALLED:
        return
    _INSTALLED = True

    @app.on_event("startup")
    async def _community_actions_startup() -> None:
        try:
            await db.feed_likes.create_index(
                [("post_id", 1), ("device_id", 1)],
                unique=True,
            )
            await db.feed_likes.create_index("post_id")
            await db.volunteer_enquiries.create_index([("created_at", -1)])
            await db.volunteer_enquiries.create_index([("request_ip", 1), ("created_at", -1)])
            await db.org_claim_relationship_checks.create_index("request_id")
            await db.org_claim_relationship_checks.create_index("token_hash", unique=True, sparse=True)
            await db.org_claim_relationship_checks.create_index([("status", 1), ("created_at", -1)])
        except Exception:
            # Index creation should never stop the main application starting.
            pass

    @api.get("/feed/like-states/{device_id}")
    async def feed_like_states(device_id: str):
        clean_device = str(device_id or "").strip()
        if not clean_device:
            raise HTTPException(400, "Device ID is required")

        pipeline = [
            {"$group": {"_id": "$post_id", "likes": {"$sum": 1}}},
        ]
        count_rows = await db.feed_likes.aggregate(pipeline).to_list(2000)
        liked_rows = await db.feed_likes.find(
            {"device_id": clean_device},
            {"_id": 0, "post_id": 1},
        ).to_list(2000)

        liked_ids = {str(row.get("post_id")) for row in liked_rows if row.get("post_id")}
        states: Dict[str, Dict[str, Any]] = {}
        for row in count_rows:
            post_id = str(row.get("_id") or "")
            if not post_id:
                continue
            states[post_id] = {
                "liked": post_id in liked_ids,
                "likes": int(row.get("likes") or 0),
            }

        for post_id in liked_ids:
            states.setdefault(post_id, {"liked": True, "likes": 1})

        return {"device_id": clean_device, "states": states}

    @api.post("/feed/{post_id}/like")
    async def toggle_feed_like(post_id: str, req: FeedLikeReq):
        post = await db.feed.find_one({"id": post_id}, {"_id": 0, "id": 1})
        if not post:
            raise HTTPException(404, "Update not found")

        key = {"post_id": post_id, "device_id": req.device_id.strip()}
        if req.action == "add":
            await db.feed_likes.update_one(
                key,
                {
                    "$setOnInsert": {
                        "id": _new_id(),
                        "post_id": post_id,
                        "device_id": req.device_id.strip(),
                        "created_at": _now_iso(),
                    }
                },
                upsert=True,
            )
        else:
            await db.feed_likes.delete_one(key)

        likes = await db.feed_likes.count_documents({"post_id": post_id})
        liked = await db.feed_likes.count_documents(key) > 0
        return {"post_id": post_id, "liked": liked, "likes": likes}

    @api.post("/volunteers/{volunteer_id}/contact")
    async def contact_volunteer_opportunity(
        volunteer_id: str,
        req: VolunteerContactReq,
        request: Request,
    ):
        opportunity = await db.volunteers.find_one({"id": volunteer_id}, {"_id": 0})
        if not opportunity:
            raise HTTPException(404, "Volunteer opportunity not found")

        org = await db.orgs.find_one({"slug": opportunity.get("orgSlug")}, {"_id": 0})
        if not org:
            raise HTTPException(404, "Organisation not found")

        # This endpoint is the fallback used when the organisation has not
        # supplied a public contact email. If one now exists, tell the browser
        # so it can use it instead of creating a dashboard notification.
        public_email = str(org.get("email") or "").strip()
        if public_email:
            return {"ok": True, "mode": "email", "email": public_email}

        ip = ""
        if request.headers.get("x-forwarded-for"):
            ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        elif request.client:
            ip = request.client.host or ""

        since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        rate_query: Dict[str, Any] = {"created_at": {"$gte": since}}
        if ip:
            rate_query["request_ip"] = ip
        else:
            rate_query["email"] = str(req.email).strip().lower()
        recent = await db.volunteer_enquiries.count_documents(rate_query)
        if recent >= 10:
            raise HTTPException(429, "Too many enquiries. Please try again later")

        enquiry_id = _new_id()
        created_at = _now_iso()
        name = req.name.strip() or "Blackrod Now visitor"
        reply_email = str(req.email).strip().lower()
        message = req.message.strip()

        enquiry = {
            "id": enquiry_id,
            "volunteer_id": volunteer_id,
            "volunteer_title": opportunity.get("title") or "Volunteer opportunity",
            "org_slug": opportunity.get("orgSlug") or "",
            "org_name": org.get("name") or opportunity.get("orgSlug") or "Organisation",
            "name": name,
            "email": reply_email,
            "message": message,
            "request_ip": ip,
            "created_at": created_at,
        }
        await db.volunteer_enquiries.insert_one(enquiry)

        notification = {
            "id": _new_id(),
            "org_slug": opportunity.get("orgSlug") or "",
            "title": f"Volunteer enquiry: {opportunity.get('title') or 'Opportunity'}",
            "body": (
                f"{name} is interested in your volunteer listing “{opportunity.get('title') or 'Volunteer opportunity'}”.\n\n"
                f"Reply email: {reply_email}\n\n"
                f"Message:\n{message}"
            ),
            "read": False,
            "created_at": created_at,
            "source": "public_volunteer_enquiry",
            "enquiry_id": enquiry_id,
        }
        await db.notifications.insert_one(notification)

        return {"ok": True, "mode": "dashboard", "notification_id": notification["id"]}

    @api.delete("/admin/venues/{venue_id}")
    async def admin_delete_venue(venue_id: str, request: Request):
        admin = _require_admin(request, admin_code)
        venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
        if not venue:
            raise HTTPException(404, "Venue not found")

        await db.venues.delete_one({"id": venue_id})
        await _audit(
            db,
            action="venue_deleted",
            entity_type="site",
            entity_id=venue_id,
            summary=f"Venue deleted: {venue.get('name') or venue_id}",
            meta={"kind": "venue"},
            actor=str(admin.get("email") or admin.get("sub") or "admin"),
        )
        return {"ok": True, "id": venue_id}

    @api.delete("/admin/volunteers/{volunteer_id}")
    async def admin_delete_volunteer(volunteer_id: str, request: Request):
        admin = _require_admin(request, admin_code)
        opportunity = await db.volunteers.find_one({"id": volunteer_id}, {"_id": 0})
        if not opportunity:
            raise HTTPException(404, "Volunteer opportunity not found")

        await db.volunteers.delete_one({"id": volunteer_id})
        await _audit(
            db,
            action="volunteer_listing_deleted",
            entity_type="site",
            entity_id=volunteer_id,
            summary=f"Volunteer listing deleted: {opportunity.get('title') or volunteer_id}",
            meta={"kind": "volunteer", "org_slug": opportunity.get("orgSlug")},
            actor=str(admin.get("email") or admin.get("sub") or "admin"),
        )
        return {"ok": True, "id": volunteer_id}

    @api.delete("/admin/community/organisations/{slug}")
    async def admin_delete_organisation_cascade(slug: str, request: Request):
        admin = _require_admin(request, admin_code)
        org = await db.orgs.find_one({"slug": slug}, {"_id": 0})
        if not org:
            raise HTTPException(404, "Organisation not found")

        feed_rows = await db.feed.find(
            {"orgSlug": slug},
            {"_id": 0, "id": 1},
        ).to_list(5000)
        feed_ids = [str(row.get("id")) for row in feed_rows if row.get("id")]

        counts = {
            "events": await db.events.count_documents({"orgSlug": slug}),
            "feed_posts": len(feed_ids),
            "volunteers": await db.volunteers.count_documents({"orgSlug": slug}),
            "notifications": await db.notifications.count_documents({"org_slug": slug}),
            "documents": await db.documents.count_documents({"org_slug": slug}),
        }

        await db.events.delete_many({"orgSlug": slug})
        await db.feed.delete_many({"orgSlug": slug})
        await db.volunteers.delete_many({"orgSlug": slug})
        await db.notifications.delete_many({"org_slug": slug})
        await db.documents.delete_many({"org_slug": slug})
        await db.org_passwords.delete_many({"slug": slug})
        await db.org_members.delete_many({"org_slug": slug})
        await db.org_member_invites.delete_many({"org_slug": slug})
        await db.org_claim_invites.delete_many({"org_slug": slug})
        await db.org_edit_requests.delete_many({"org_slug": slug})
        await db.volunteer_enquiries.delete_many({"org_slug": slug})

        if feed_ids:
            await db.feed_likes.delete_many({"post_id": {"$in": feed_ids}})

        await db.follows.update_many({}, {"$pull": {"orgs": slug}})
        await db.subscribers.update_many({}, {"$pull": {"followed_orgs": slug}})
        await db.orgs.delete_one({"slug": slug})

        await _audit(
            db,
            action="org_deleted_cascade",
            entity_type="org",
            entity_id=slug,
            summary=f"Organisation and linked content deleted: {org.get('name') or slug}",
            meta=counts,
            actor=str(admin.get("email") or admin.get("sub") or "admin"),
        )
        return {"ok": True, "slug": slug, "deleted": counts}

    @api.get("/admin/community/org-contacts")
    async def admin_organisation_contacts(request: Request):
        _require_admin(request, admin_code)
        org_rows = await db.orgs.find(
            {"status": {"$ne": "rejected"}},
            {"_id": 0},
        ).sort("name", 1).to_list(5000)

        rows = []
        for org in org_rows:
            resolved = await _registered_org_email(db, org)
            source = "none"
            if resolved:
                if resolved == str(org.get("owner_email") or "").strip().lower():
                    source = "owner"
                elif resolved in [str(v or "").strip().lower() for v in (org.get("admin_emails") or [])]:
                    source = "admin"
                elif resolved == str(org.get("email") or "").strip().lower():
                    source = "public"
                else:
                    source = "member"
            rows.append({
                "slug": org.get("slug"),
                "name": org.get("name") or org.get("slug"),
                "email": resolved,
                "source": source,
                "public_email": str(org.get("email") or "").strip().lower(),
                "website": org.get("website") or "",
                "status": org.get("status") or "approved",
            })
        return {"organisations": rows}

    @api.post("/admin/community/messages/send")
    async def admin_community_send_message(request: Request):
        admin = _require_admin(request, admin_code)
        if not str(os.environ.get("RESEND_API_KEY") or "").strip():
            raise HTTPException(503, "Email delivery is not configured")

        content_type = str(request.headers.get("content-type") or "")
        values: Dict[str, Any] = {}
        attachments: list[Dict[str, Any]] = []
        if content_type.startswith("multipart/form-data"):
            form = await request.form()
            for key in ("to_mode", "org_slugs", "to_email", "subject", "body", "from_email", "from_name", "reply_to", "parent_message_id"):
                values[key] = str(form.get(key) or "").strip()
            for upload in [item for item in form.getlist("attachments") if getattr(item, "filename", None)]:
                raw = await upload.read()
                if len(raw) > 10 * 1024 * 1024:
                    raise HTTPException(413, f"Attachment too large (max 10 MB): {upload.filename or 'attachment'}")
                attachments.append({
                    "filename": upload.filename or "attachment",
                    "content_type": upload.content_type or "application/octet-stream",
                    "size": len(raw),
                    "content": base64.b64encode(raw).decode("ascii"),
                })
        else:
            try:
                values = dict(await request.json())
            except Exception:
                values = {}

        subject = str(values.get("subject") or "").strip()
        body = str(values.get("body") or "").strip()
        if not subject or not body:
            raise HTTPException(400, "Subject and message are required")

        senders, default_sender, default_name = _admin_sender_options()
        from_email = str(values.get("from_email") or default_sender).strip().lower()
        if from_email not in [item.lower() for item in senders]:
            raise HTTPException(400, "Choose an approved Blackrod Now sender address")
        from_name = str(values.get("from_name") or default_name).strip()
        reply_to = str(values.get("reply_to") or "").strip().lower()
        parent_message_id = str(values.get("parent_message_id") or "").strip()
        mode = str(values.get("to_mode") or "orgs").strip().lower()

        recipients: list[Dict[str, str]] = []
        if mode == "email":
            direct_email = str(values.get("to_email") or "").strip().lower()
            if not direct_email or "@" not in direct_email:
                raise HTTPException(400, "A valid recipient email is required")
            recipients.append({"slug": "", "name": direct_email, "email": direct_email})
        else:
            if mode == "all":
                org_docs = await db.orgs.find({"status": {"$ne": "rejected"}}, {"_id": 0}).to_list(5000)
            else:
                slugs = [part.strip() for part in str(values.get("org_slugs") or "").split(",") if part.strip()]
                if not slugs:
                    raise HTTPException(400, "Select at least one organisation")
                org_docs = await db.orgs.find({"slug": {"$in": slugs}}, {"_id": 0}).to_list(5000)

            seen = set()
            for org in org_docs:
                recipient = await _registered_org_email(db, org)
                if not recipient or recipient in seen:
                    continue
                seen.add(recipient)
                recipients.append({
                    "slug": str(org.get("slug") or ""),
                    "name": str(org.get("name") or org.get("slug") or recipient),
                    "email": recipient,
                })

        if not recipients:
            raise HTTPException(400, "None of the selected organisations has an email address")
        if len(recipients) > 500:
            raise HTTPException(400, "Too many recipients in one send")

        attachment_meta = [
            {"filename": item["filename"], "content_type": item["content_type"], "size": item["size"]}
            for item in attachments
        ]
        results = []
        sent = 0
        failed = 0
        for recipient in recipients:
            try:
                delivery = await asyncio.to_thread(
                    _send_admin_message_email,
                    recipient=recipient["email"],
                    subject=subject,
                    body=body,
                    from_email=from_email,
                    from_name=from_name,
                    reply_to=reply_to,
                    attachments=attachments,
                )
                sent += 1
                message_id = _new_id()
                await db.messages.insert_one({
                    "id": message_id,
                    "from_org_slug": None,
                    "from_email": from_email,
                    "from_name": from_name or "Admin",
                    "to_org_slug": recipient["slug"] or None,
                    "to_email": recipient["email"],
                    "subject": subject,
                    "body": body,
                    "in_reply_to": None,
                    "parent_message_id": parent_message_id or None,
                    "direction": "outbound_admin",
                    "read": True,
                    "archived": False,
                    "created_at": _now_iso(),
                    "metadata": {
                        "source": "admin_community_workspace",
                        "provider_id": delivery.get("id"),
                        "attachments": attachment_meta,
                    },
                })
                results.append({"ok": True, "email": recipient["email"], "slug": recipient["slug"], "id": delivery.get("id")})
            except Exception as exc:
                failed += 1
                results.append({"ok": False, "email": recipient["email"], "slug": recipient["slug"], "error": str(exc)[:300]})

        await _audit(
            db,
            action="admin_community_message_sent",
            entity_type="site",
            entity_id=parent_message_id or "communications",
            summary=f"Admin email sent to {sent} recipient{'s' if sent != 1 else ''}",
            meta={"sent": sent, "failed": failed, "mode": mode, "attachments": attachment_meta},
            actor=str(admin.get("email") or admin.get("sub") or "admin"),
        )
        return {"ok": failed == 0, "sent": sent, "failed": failed, "results": results, "attachments": attachment_meta}

    @api.get("/admin/community/messages/{message_id}/attachments")
    async def admin_message_attachments(message_id: str, request: Request):
        _require_admin(request, admin_code)
        message = await db.messages.find_one({"id": message_id}, {"_id": 0})
        if not message:
            raise HTTPException(404, "Message not found")

        metadata = message.get("metadata") or {}
        recorded = metadata.get("attachments") or message.get("attachments") or []
        api_key = str(os.environ.get("RESEND_API_KEY") or "").strip()
        if not api_key:
            return {"attachments": recorded, "live": False}

        direction = str(message.get("direction") or "")
        if direction == "outbound_admin":
            resend_id = str(metadata.get("provider_id") or "").strip()
            endpoint = f"https://api.resend.com/emails/{resend_id}/attachments" if resend_id else ""
        else:
            resend_id = str(metadata.get("resend_email_id") or metadata.get("event_id") or "").strip()
            endpoint = f"https://api.resend.com/emails/receiving/{resend_id}/attachments" if resend_id else ""

        if not endpoint:
            return {"attachments": recorded, "live": False}

        try:
            response = await asyncio.to_thread(
                __import__("requests").get,
                endpoint,
                headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            rows = payload.get("data") if isinstance(payload, dict) else []
            return {"attachments": rows or recorded, "live": bool(rows)}
        except Exception:
            # The inbox must remain readable even if Resend is unavailable.
            return {"attachments": recorded, "live": False}

    @api.get("/admin/claim-verifications")
    async def admin_claim_verification_status(request: Request):
        _require_admin(request, admin_code)
        rows = await db.org_claim_relationship_checks.find(
            {},
            {"_id": 0, "token_hash": 0},
        ).sort("created_at", -1).to_list(1000)
        latest: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            request_id = str(row.get("request_id") or "")
            if request_id and request_id not in latest:
                latest[request_id] = row
        return {"verifications": list(latest.values())}

    @api.post("/admin/claim-verifications/{request_id}/send")
    async def admin_send_claim_verification(request_id: str, request: Request):
        admin = _require_admin(request, admin_code)
        claim = await db.org_edit_requests.find_one(
            {"id": request_id, "request_type": "claim"},
            {"_id": 0},
        )
        if not claim:
            raise HTTPException(404, "Claim request not found")
        if claim.get("status") != "pending":
            raise HTTPException(400, "Only pending claims can be independently verified")

        org = await db.orgs.find_one({"slug": claim.get("org_slug")}, {"_id": 0})
        if not org:
            raise HTTPException(404, "Organisation not found")

        recipient = await _registered_org_email(db, org)
        if not recipient:
            raise HTTPException(400, "No established organisation email is available. Use manual verification instead.")
        if not str(os.environ.get("RESEND_API_KEY") or "").strip():
            raise HTTPException(503, "Email delivery is not configured")

        token = secrets.token_urlsafe(32)
        created_at = _now_iso()
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat()
        await db.org_claim_relationship_checks.update_many(
            {"request_id": request_id, "status": "pending"},
            {"$set": {"status": "superseded", "updated_at": created_at}},
        )
        doc = {
            "id": _new_id(),
            "request_id": request_id,
            "org_slug": claim.get("org_slug"),
            "org_name": claim.get("org_name") or org.get("name") or claim.get("org_slug"),
            "claimant_name": claim.get("contact_name") or "",
            "claimant_email": str(claim.get("contact_email") or "").strip().lower(),
            "recipient": recipient,
            "recipient_masked": _mask_email(recipient),
            "method": "established_org_email",
            "status": "pending",
            "token_hash": _claim_token_hash(token, admin_code),
            "created_at": created_at,
            "expires_at": expires_at,
            "created_by": str(admin.get("email") or admin.get("sub") or "admin"),
        }
        await db.org_claim_relationship_checks.insert_one(doc)

        try:
            delivery = await asyncio.to_thread(
                _send_claim_relationship_email,
                recipient=recipient,
                org_name=str(doc["org_name"]),
                claimant_name=str(doc["claimant_name"]),
                claimant_email=str(doc["claimant_email"]),
                token=token,
                public_url=public_url,
            )
        except Exception as exc:
            await db.org_claim_relationship_checks.update_one(
                {"id": doc["id"]},
                {"$set": {"status": "delivery_failed", "error": str(exc)[:500], "updated_at": _now_iso()}},
            )
            raise HTTPException(502, f"Verification email could not be sent: {str(exc)[:250]}")

        await db.org_claim_relationship_checks.update_one(
            {"id": doc["id"]},
            {"$set": {"provider_id": delivery.get("id"), "sent_at": _now_iso()}},
        )
        await _audit(
            db,
            action="org_claim_relationship_check_sent",
            entity_type="org",
            entity_id=str(claim.get("org_slug") or ""),
            summary=f"Independent organisation claim confirmation sent to {_mask_email(recipient)}",
            meta={"request_id": request_id},
            actor=str(admin.get("email") or admin.get("sub") or "admin"),
        )
        clean = dict(doc)
        clean.pop("_id", None)
        clean.pop("token_hash", None)
        clean["provider_id"] = delivery.get("id")
        clean["sent_at"] = _now_iso()
        return {"ok": True, "verification": clean}

    @api.post("/admin/claim-verifications/{request_id}/manual")
    async def admin_record_manual_claim_verification(request_id: str, request: Request):
        admin = _require_admin(request, admin_code)
        claim = await db.org_edit_requests.find_one(
            {"id": request_id, "request_type": "claim"},
            {"_id": 0},
        )
        if not claim:
            raise HTTPException(404, "Claim request not found")
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        reason = str((payload or {}).get("reason") or "").strip()
        method = str((payload or {}).get("method") or "manual").strip()
        if len(reason) < 10:
            raise HTTPException(400, "Record how the organisation relationship was verified")

        now = _now_iso()
        doc = {
            "id": _new_id(),
            "request_id": request_id,
            "org_slug": claim.get("org_slug"),
            "org_name": claim.get("org_name") or claim.get("org_slug"),
            "claimant_name": claim.get("contact_name") or "",
            "claimant_email": str(claim.get("contact_email") or "").strip().lower(),
            "recipient": "",
            "recipient_masked": "",
            "method": method or "manual",
            "status": "approved",
            "manual_reason": reason,
            "created_at": now,
            "responded_at": now,
            "created_by": str(admin.get("email") or admin.get("sub") or "admin"),
        }
        await db.org_claim_relationship_checks.insert_one(doc)
        await db.org_edit_requests.update_one(
            {"id": request_id},
            {"$set": {"relationship_verified_at": now, "relationship_verification_method": method, "relationship_verification_note": reason}},
        )
        await _audit(
            db,
            action="org_claim_relationship_verified_manual",
            entity_type="org",
            entity_id=str(claim.get("org_slug") or ""),
            summary="Organisation claim relationship manually verified",
            meta={"request_id": request_id, "method": method, "reason": reason},
            actor=str(admin.get("email") or admin.get("sub") or "admin"),
        )
        return {"ok": True, "verification": doc}

    @api.get("/claim-verifications/{token}/{decision}")
    async def public_claim_verification_response(token: str, decision: str):
        decision = str(decision or "").strip().lower()
        if decision not in {"approve", "reject"}:
            raise HTTPException(404, "Invalid claim confirmation link")
        token_hash = _claim_token_hash(token, admin_code)
        check = await db.org_claim_relationship_checks.find_one(
            {"token_hash": token_hash},
            {"_id": 0},
        )
        if not check:
            return Response(
                content="<html><body style='font-family:Arial,sans-serif;padding:40px'><h1>Link not recognised</h1><p>This confirmation link is invalid or has been replaced.</p></body></html>",
                media_type="text/html",
                status_code=404,
            )
        if check.get("status") not in {"pending"}:
            message = "This organisation claim has already been confirmed." if check.get("status") == "approved" else "This organisation claim link has already been used."
            return Response(
                content=f"<html><body style='font-family:Arial,sans-serif;padding:40px'><h1>Blackrod Now</h1><p>{html.escape(message)}</p></body></html>",
                media_type="text/html",
            )
        try:
            expiry = datetime.fromisoformat(str(check.get("expires_at") or "").replace("Z", "+00:00"))
        except Exception:
            expiry = datetime.now(timezone.utc) - timedelta(seconds=1)
        if expiry < datetime.now(timezone.utc):
            await db.org_claim_relationship_checks.update_one(
                {"id": check.get("id")},
                {"$set": {"status": "expired", "updated_at": _now_iso()}},
            )
            return Response(
                content="<html><body style='font-family:Arial,sans-serif;padding:40px'><h1>Link expired</h1><p>Please ask Blackrod Now to send a fresh organisation confirmation request.</p></body></html>",
                media_type="text/html",
                status_code=410,
            )

        new_status = "approved" if decision == "approve" else "rejected"
        now = _now_iso()
        await db.org_claim_relationship_checks.update_one(
            {"id": check.get("id")},
            {"$set": {"status": new_status, "responded_at": now, "updated_at": now}},
        )
        if new_status == "approved":
            await db.org_edit_requests.update_one(
                {"id": check.get("request_id")},
                {"$set": {
                    "relationship_verified_at": now,
                    "relationship_verification_method": "established_org_email",
                    "relationship_verification_note": f"Confirmed by established organisation contact {_mask_email(str(check.get('recipient') or ''))}",
                }},
            )

        heading = "Authorisation confirmed" if new_status == "approved" else "Claim rejected"
        copy = (
            "Thank you. Blackrod Now has recorded that this person is authorised to represent the organisation. A site administrator will complete the final access review."
            if new_status == "approved"
            else "Thank you. Blackrod Now has recorded that this person is not authorised to manage the organisation profile. A site administrator will review the claim."
        )
        return Response(
            content=f"<html><body style='font-family:Arial,sans-serif;padding:40px;max-width:680px;margin:auto'><h1>{html.escape(heading)}</h1><p>{html.escape(copy)}</p><p>You can close this page.</p></body></html>",
            media_type="text/html",
        )

    # Enforce the second-stage organisation relationship check at the API layer,
    # not just in the new dashboard. This prevents the legacy/Advanced admin UI
    # from accidentally granting a profile claim before the claimant's authority
    # to represent the organisation has been independently verified.
    original_claim_review = _find_route_endpoint(
        api,
        "/admin/org-edit-requests/{request_id}/status",
        "POST",
    )
    if original_claim_review is not None:
        _remove_route(api, "/admin/org-edit-requests/{request_id}/status", "POST")

        @api.post("/admin/org-edit-requests/{request_id}/status")
        async def guarded_org_edit_request_review(
            request_id: str,
            req: ClaimReviewReq,
            request: Request,
        ):
            admin = _require_admin(request, admin_code)
            existing = await db.org_edit_requests.find_one(
                {"id": request_id},
                {"_id": 0},
            )
            if not existing:
                raise HTTPException(404, "Request not found")

            if req.status == "approved" and existing.get("request_type") == "claim":
                verified = bool(existing.get("relationship_verified_at"))
                if not verified:
                    approved_check = await db.org_claim_relationship_checks.find_one(
                        {"request_id": request_id, "status": "approved"},
                        {"_id": 0, "id": 1},
                        sort=[("responded_at", -1), ("created_at", -1)],
                    )
                    verified = bool(approved_check)

                if not verified:
                    raise HTTPException(
                        409,
                        "This claim cannot be approved until the claimant's authority to represent the organisation has been independently verified in Admin → Claims.",
                    )

            # Reuse the original server.py implementation so existing claim/edit
            # approval behaviour, credential emails and audit behaviour are preserved.
            result = await original_claim_review(request_id, req)

            if req.status == "approved" and existing.get("request_type") == "claim":
                now = _now_iso()
                await db.orgs.update_one(
                    {"slug": existing.get("org_slug")},
                    {
                        "$set": {
                            "managed_by_org": True,
                            "managed_since": now,
                            "managed_via_claim_request_id": request_id,
                        }
                    },
                )
                await _audit(
                    db,
                    action="org_claim_access_granted_verified",
                    entity_type="org",
                    entity_id=str(existing.get("org_slug") or ""),
                    summary="Verified organisation profile claim approved",
                    meta={
                        "request_id": request_id,
                        "claimant_email": str(existing.get("contact_email") or ""),
                    },
                    actor=str(admin.get("email") or admin.get("sub") or "admin"),
                )

            return result

    # Replace server.py's existing admin reset route while retaining the exact
    # same URL expected by api.adminResetOrgPassword().
    _remove_route(api, "/admin/organisations/{slug}/password/reset", "POST")

    @api.post("/admin/organisations/{slug}/password/reset")
    async def admin_reset_org_password_and_email(
        slug: str,
        body: Dict[str, str],
        request: Request,
    ):
        admin = _require_admin(request, admin_code)
        org = await db.orgs.find_one({"slug": slug}, {"_id": 0})
        if not org:
            raise HTTPException(404, "Organisation not found")

        recipient = await _registered_org_email(db, org)
        if not recipient:
            raise HTTPException(
                400,
                "No registered email is available for this organisation. Add an owner/admin email or organisation email first.",
            )

        if not str(os.environ.get("RESEND_API_KEY") or "").strip():
            raise HTTPException(
                503,
                "Email delivery is not configured, so the password was not changed.",
            )

        password = str(body.get("password") or "").strip() or _new_temporary_password()
        if len(password) < 8:
            raise HTTPException(400, "Password must be at least 8 characters")

        previous = await db.org_passwords.find_one({"slug": slug})
        salt = secrets.token_hex(16)
        password_doc = {
            "slug": slug,
            "password_salt": salt,
            "password_hash": _hash_org_password(password, salt),
            "updated_at": _now_iso(),
            "updated_by": "admin-reset-email",
        }

        await db.org_passwords.update_one(
            {"slug": slug},
            {"$set": password_doc},
            upsert=True,
        )

        try:
            delivery = await asyncio.to_thread(
                _send_password_reset_email,
                recipient=recipient,
                org_name=str(org.get("name") or slug),
                password=password,
                public_url=public_url,
            )
        except Exception as exc:
            # Do not leave the organisation locked out if the promised email
            # cannot be delivered. Restore the previous credential atomically
            # enough for this single-document workflow.
            if previous:
                restore = dict(previous)
                restore.pop("_id", None)
                await db.org_passwords.replace_one({"slug": slug}, restore, upsert=True)
            else:
                await db.org_passwords.delete_one({"slug": slug})
            raise HTTPException(
                502,
                f"The reset email could not be sent, so the previous password was restored: {str(exc)[:300]}",
            )

        await _audit(
            db,
            action="org_password_reset",
            entity_type="org",
            entity_id=slug,
            summary=f"Organisation password reset and emailed to {_mask_email(recipient)}",
            meta={"email_sent": True, "provider_id": delivery.get("id")},
            actor=str(admin.get("email") or admin.get("sub") or "admin"),
        )
        return {
            "ok": True,
            "slug": slug,
            "email_sent": True,
            "recipient": _mask_email(recipient),
        }
