"""Admin bulk 'Invite organisations' tool for Blackrod Now.

Lets an admin invite the supplied Blackrod org contacts to either CLAIM an
existing organisation profile or CREATE a new one. Provides an HTML + plain
text template editor, a per-recipient live preview, a test send and a batch
send. Contacts ship with the build (data/invite_contacts.json) so the feature
works in production. Sends + tracking are recorded server-side.
"""
from __future__ import annotations

import asyncio
import html as html_lib
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger("blackrodnow.orginvites")

DEFAULT_SUBJECT = "You're invited to join Blackrod Now"

DEFAULT_HTML = """<p>Hi {{name}},</p>
<p>You've been invited to join <strong>Blackrod Now</strong> &mdash; Blackrod's community hub for local news, events and organisations.</p>
<p>Claim your organisation, keep your details updated and share what's happening with the local community.</p>
{{org_block}}
<p style="margin-top:20px"><strong>What's New. What's On. What's Next.</strong></p>"""

DEFAULT_TEXT = """Hi {{name}},

You've been invited to join Blackrod Now - Blackrod's community hub for local news, events and organisations.

Claim your organisation, keep your details updated and share what's happening with the local community.

{{org_block}}

What's New. What's On. What's Next.

- Blackrod Now"""


class PreviewReq(BaseModel):
    subject: str = DEFAULT_SUBJECT
    html: str = DEFAULT_HTML
    text: str = DEFAULT_TEXT
    index: int = 0


class TestReq(BaseModel):
    subject: str = DEFAULT_SUBJECT
    html: str = DEFAULT_HTML
    text: str = DEFAULT_TEXT
    to: str


class SendReq(BaseModel):
    subject: str = DEFAULT_SUBJECT
    html: str = DEFAULT_HTML
    text: str = DEFAULT_TEXT
    indexes: Optional[List[int]] = None
    skip_already_sent: bool = True


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(s: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


def install_org_invites(
    *,
    app,
    api,
    db,
    public_url: str,
    admin_code: str,
    resend_send: Callable[..., Dict[str, Any]],
    email_signature: str = "",
    contacts_path: Optional[str] = None,
) -> None:
    base = public_url.rstrip("/")
    create_url = f"{base}/add-organisation"
    path = contacts_path or os.path.join(os.path.dirname(__file__), "data", "invite_contacts.json")

    try:
        with open(path, "r", encoding="utf-8") as fh:
            CONTACTS: List[Dict[str, Any]] = json.load(fh)
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not load invite contacts from %s: %s", path, exc)
        CONTACTS = []

    def require_admin(request: Request) -> None:
        supplied = str(request.headers.get("X-Admin-Code") or "").strip()
        if supplied and admin_code and supplied == admin_code:
            return
        authorization = str(request.headers.get("Authorization") or "").strip()
        if authorization.lower().startswith("bearer "):
            try:
                from auth import decode_token

                payload = decode_token(authorization[7:].strip())
                if str(payload.get("role") or "") == "admin":
                    return
            except Exception:
                pass
        raise HTTPException(401, "Admin authentication required")

    async def _org_lookup() -> Dict[str, Dict[str, Any]]:
        docs = await db.orgs.find({}, {"_id": 0, "slug": 1, "name": 1, "status": 1}).to_list(length=None)
        return {_norm(d.get("name")): d for d in docs if d.get("name")}

    def _match_org(org_name: str, by_norm: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        n = _norm(org_name)
        if not n:
            return None
        hit = by_norm.get(n)
        if hit:
            return hit
        for k, v in by_norm.items():
            if len(n) > 4 and (n in k or k in n):
                return v
        return None

    def _resolve_orgs(org_names: List[str], by_norm: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        resolved = []
        for name in org_names:
            hit = _match_org(name, by_norm)
            if hit:
                resolved.append({
                    "name": name,
                    "action": "claim",
                    "slug": hit.get("slug"),
                    "status": hit.get("status"),
                    "url": f"{base}/organisations/{hit.get('slug')}",
                })
            else:
                resolved.append({"name": name, "action": "create", "slug": None, "status": None, "url": create_url})
        return resolved

    def _org_block_html(orgs: List[Dict[str, Any]]) -> str:
        parts = []
        for o in orgs:
            label = f"Claim {html_lib.escape(o['name'])}" if o["action"] == "claim" else f"Add {html_lib.escape(o['name'])}"
            parts.append(
                f'<p style="margin:10px 0"><a href="{o["url"]}" '
                f'style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;'
                f'padding:10px 18px;border-radius:9999px;font-weight:600">{label} &rarr;</a></p>'
            )
        return "\n".join(parts)

    def _org_block_text(orgs: List[Dict[str, Any]]) -> str:
        lines = []
        for o in orgs:
            verb = "Claim" if o["action"] == "claim" else "Add"
            lines.append(f"{verb} {o['name']}: {o['url']}")
        return "\n".join(lines)

    def _render(template: str, *, name: str, orgs: List[Dict[str, Any]], is_html: bool) -> str:
        block = _org_block_html(orgs) if is_html else _org_block_text(orgs)
        org_names = ", ".join(o["name"] for o in orgs)
        first_name = (name or "there").split(" ")[0] or "there"
        out = template
        out = out.replace("{{name}}", html_lib.escape(name) if is_html else name)
        out = out.replace("{{first_name}}", html_lib.escape(first_name) if is_html else first_name)
        out = out.replace("{{org_block}}", block)
        out = out.replace("{{orgs}}", html_lib.escape(org_names) if is_html else org_names)
        return out

    async def _sent_map() -> Dict[str, Dict[str, Any]]:
        docs = await db.org_invite_sends.find({}, {"_id": 0}).to_list(length=None)
        return {str(d.get("email") or "").lower(): d for d in docs}

    async def _build_contacts() -> List[Dict[str, Any]]:
        by_norm = await _org_lookup()
        sent = await _sent_map()
        rows = []
        for idx, c in enumerate(CONTACTS):
            orgs = _resolve_orgs(c.get("orgs") or [], by_norm)
            s = sent.get(str(c.get("email") or "").lower())
            rows.append({
                "index": idx,
                "name": c.get("name"),
                "email": c.get("email"),
                "orgs": orgs,
                "sent_at": (s or {}).get("sent_at"),
                "last_status": (s or {}).get("status"),
            })
        return rows

    # ── request handlers ──
    def _wrap_html(body_html: str) -> str:
        return body_html + (email_signature or "")

    @api.get("/admin/org-invites/config")
    async def org_invites_config(request: Request):
        require_admin(request)
        contacts = await _build_contacts()
        matched = sum(1 for c in contacts for o in c["orgs"] if o["action"] == "claim")
        creates = sum(1 for c in contacts for o in c["orgs"] if o["action"] == "create")
        return {
            "default_subject": DEFAULT_SUBJECT,
            "default_html": DEFAULT_HTML,
            "default_text": DEFAULT_TEXT,
            "variables": ["{{name}}", "{{first_name}}", "{{orgs}}", "{{org_block}}"],
            "public_url": base,
            "create_url": create_url,
            "total": len(contacts),
            "claim_links": matched,
            "create_links": creates,
            "contacts": contacts,
        }

    @api.post("/admin/org-invites/preview")
    async def org_invites_preview(req: PreviewReq, request: Request):
        require_admin(request)
        if not CONTACTS:
            raise HTTPException(400, "No contacts loaded")
        idx = max(0, min(req.index, len(CONTACTS) - 1))
        by_norm = await _org_lookup()
        c = CONTACTS[idx]
        orgs = _resolve_orgs(c.get("orgs") or [], by_norm)
        return {
            "to": c.get("email"),
            "name": c.get("name"),
            "subject": _render(req.subject, name=c.get("name"), orgs=orgs, is_html=False),
            "html": _wrap_html(_render(req.html, name=c.get("name"), orgs=orgs, is_html=True)),
            "text": _render(req.text, name=c.get("name"), orgs=orgs, is_html=False),
            "orgs": orgs,
        }

    @api.post("/admin/org-invites/test")
    async def org_invites_test(req: TestReq, request: Request):
        require_admin(request)
        to = str(req.to or "").strip()
        if "@" not in to:
            raise HTTPException(400, "A valid test recipient email is required")
        by_norm = await _org_lookup()
        # Build one CLAIM example and one CREATE example so the test shows both.
        claim_example = {"name": "Sample Person", "orgs": _resolve_orgs(
            [next((c["orgs"][0] for c in CONTACTS if _resolve_orgs(c.get("orgs") or [], by_norm) and _resolve_orgs(c["orgs"], by_norm)[0]["action"] == "claim"), "Art Group")], by_norm)}
        create_example = {"name": "Sample Person", "orgs": _resolve_orgs(
            [next((o["name"] for c in CONTACTS for o in _resolve_orgs(c.get("orgs") or [], by_norm) if o["action"] == "create"), "Womens Institute")], by_norm)}
        results = []
        for tag, ex in (("claim", claim_example), ("create", create_example)):
            subject = f"[TEST {tag}] " + _render(req.subject, name=ex["name"], orgs=ex["orgs"], is_html=False)
            html = _wrap_html(_render(req.html, name=ex["name"], orgs=ex["orgs"], is_html=True))
            text = _render(req.text, name=ex["name"], orgs=ex["orgs"], is_html=False)
            res = await asyncio.to_thread(resend_send, to, subject, html, None, None, None, None, text)
            results.append({"example": tag, "ok": bool(res.get("ok")), "mocked": res.get("mocked"), "id": res.get("id"), "error": res.get("error")})
        return {"ok": all(r["ok"] for r in results), "to": to, "results": results}

    @api.post("/admin/org-invites/send")
    async def org_invites_send(req: SendReq, request: Request):
        require_admin(request)
        by_norm = await _org_lookup()
        sent = await _sent_map()
        indexes = req.indexes if req.indexes is not None else list(range(len(CONTACTS)))
        results = []
        for idx in indexes:
            if idx < 0 or idx >= len(CONTACTS):
                results.append({"index": idx, "ok": False, "status": "invalid_index"})
                continue
            c = CONTACTS[idx]
            email = str(c.get("email") or "").strip()
            if "@" not in email:
                results.append({"index": idx, "ok": False, "email": email, "status": "invalid_email"})
                continue
            if req.skip_already_sent and sent.get(email.lower()):
                results.append({"index": idx, "ok": True, "email": email, "status": "skipped_already_sent"})
                continue
            orgs = _resolve_orgs(c.get("orgs") or [], by_norm)
            subject = _render(req.subject, name=c.get("name"), orgs=orgs, is_html=False)
            html = _wrap_html(_render(req.html, name=c.get("name"), orgs=orgs, is_html=True))
            text = _render(req.text, name=c.get("name"), orgs=orgs, is_html=False)
            res = await asyncio.to_thread(resend_send, email, subject, html, None, None, None, None, text)
            ok = bool(res.get("ok"))
            record = {
                "email": email,
                "name": c.get("name"),
                "orgs": orgs,
                "sent_at": _now_iso(),
                "status": "sent" if ok else "error",
                "message_id": res.get("id"),
                "mocked": bool(res.get("mocked")),
                "error": res.get("error"),
            }
            await db.org_invite_sends.update_one({"email": email}, {"$set": record}, upsert=True)
            # Track claim invites for existing orgs so the admin claim-invite list reflects them.
            for o in orgs:
                if o["action"] == "claim" and o.get("slug"):
                    await db.org_claim_invites.update_one(
                        {"org_slug": o["slug"], "email": email.lower()},
                        {"$setOnInsert": {
                            "id": f"bulk-{o['slug']}-{email.lower()}",
                            "org_slug": o["slug"],
                            "org_name": o["name"],
                            "email": email.lower(),
                            "note": "Bulk invite campaign",
                            "status": "pending",
                            "created_at": _now_iso(),
                            "source": "bulk_invite",
                        }},
                        upsert=True,
                    )
            results.append({"index": idx, "ok": ok, "email": email, "status": record["status"], "mocked": record["mocked"], "error": res.get("error")})
            await asyncio.sleep(0.2)
        return {
            "ok": all(r.get("ok") for r in results),
            "sent": sum(1 for r in results if r.get("status") == "sent"),
            "skipped": sum(1 for r in results if r.get("status") == "skipped_already_sent"),
            "failed": sum(1 for r in results if not r.get("ok")),
            "results": results,
        }

    # Install the consolidated community/admin workspace routes before the main
    # APIRouter is attached to the FastAPI app. This keeps the 400k+ server.py
    # untouched and preserves the existing invite tool as-is.
    from community_actions import install_community_actions
    from admin_event_lifecycle import install_admin_event_lifecycle

    install_community_actions(
        app=app,
        api=api,
        db=db,
        public_url=public_url,
        admin_code=admin_code,
    )
    install_admin_event_lifecycle(
        api=api,
        db=db,
        admin_code=admin_code,
    )

    logger.info("Org invite tool ready: %d contacts loaded", len(CONTACTS))