"""Blackrod Now backend — MongoDB-persisted community platform."""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Response, Header, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Literal, Any, Dict
from datetime import datetime, timezone
import os
import re
import json
import uuid
import asyncio
import logging
import requests
from io import BytesIO
from PIL import Image, ImageOps

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ─────────── Config ───────────
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
APP_NAME = os.environ.get("APP_NAME", "blackrodnow")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://blackrodnow.local")

# ─────────── DB ───────────
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ─────────── App ───────────
app = FastAPI(title="Blackrod Now API")
api = APIRouter(prefix="/api")
logger = logging.getLogger("blackrodnow")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ─────────── Optional integrations ───────────
_storage_key: Optional[str] = None
def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key or not EMERGENT_LLM_KEY:
        return _storage_key
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=15)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning("Storage init failed (uploads will fail gracefully): %s", e)
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not initialized")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not initialized")
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


def resend_send(to_email: str, subject: str, html: str) -> Dict[str, Any]:
    """Send via Resend. Returns dict with ok flag + provider id or mock note."""
    if not RESEND_API_KEY:
        logger.info("[MOCK EMAIL] to=%s subject=%s (RESEND_API_KEY not set)", to_email, subject)
        return {"ok": True, "mocked": True, "to": to_email, "subject": subject}
    try:
        import resend  # lazy
        resend.api_key = RESEND_API_KEY
        result = resend.Emails.send(
            {"from": SENDER_EMAIL, "to": [to_email], "subject": subject, "html": html}
        )
        return {"ok": True, "mocked": False, "id": result.get("id"), "to": to_email}
    except Exception as e:
        logger.exception("resend_send failed: %s", e)
        return {"ok": False, "mocked": False, "error": str(e), "to": to_email}


# ─────────── Models ───────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def new_token() -> str:
    return uuid.uuid4().hex


class Socials(BaseModel):
    facebook: Optional[str] = ""
    instagram: Optional[str] = ""
    tiktok: Optional[str] = ""
    linkedin: Optional[str] = ""


class Organisation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    slug: str
    name: str
    category: str
    tags: List[str] = []
    short: str = ""
    about: str = ""
    does: str = ""
    forWho: str = ""
    meeting: str = ""
    address: str = ""
    location: str = ""
    email: str = ""
    phone: str = ""
    website: str = ""
    socials: Socials = Field(default_factory=Socials)
    brandColor: str = "#0052FF"
    logo: str = "✨"
    cover: str = ""
    logo_path: Optional[str] = None
    logo_thumb_path: Optional[str] = None
    cover_path: Optional[str] = None
    upcoming: int = 0
    status: Literal["approved", "pending", "rejected"] = "approved"
    updated_at: str = Field(default_factory=now_iso)


class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    title: str
    orgSlug: str
    category: str
    start: str
    end: str
    venue: str = ""
    address: str = ""
    description: str = ""
    cost: str = ""
    age: str = ""
    accessibility: str = ""
    booking: str = ""
    contactEmail: str = ""
    contactPhone: str = ""
    image: str = ""
    featured: bool = False
    status: Literal["approved", "pending", "rejected"] = "pending"


class FeedPost(BaseModel):
    id: str = Field(default_factory=new_id)
    orgSlug: str
    type: str
    title: str
    body: str
    image: str = ""
    time: str = Field(default_factory=now_iso)


class Subscriber(BaseModel):
    id: str = Field(default_factory=new_id)
    email: EmailStr
    device_id: Optional[str] = None
    unsub_token: str = Field(default_factory=new_token)
    pref_token: str = Field(default_factory=new_token)
    followed_orgs: List[str] = []
    followed_categories: List[str] = []
    digest: bool = True
    unsubscribed: bool = False
    created_at: str = Field(default_factory=now_iso)


class Notification(BaseModel):
    id: str = Field(default_factory=new_id)
    org_slug: str
    title: str
    body: str
    read: bool = False
    created_at: str = Field(default_factory=now_iso)


class AdminMessage(BaseModel):
    id: str = Field(default_factory=new_id)
    from_org_slug: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    subject: str
    body: str
    read: bool = False
    created_at: str = Field(default_factory=now_iso)


class Document(BaseModel):
    id: str = Field(default_factory=new_id)
    org_slug: str
    name: str
    storage_path: str
    content_type: str
    size: int
    created_at: str = Field(default_factory=now_iso)
    deleted: bool = False


class Venue(BaseModel):
    id: str
    name: str
    address: str
    facilities: List[str] = []
    accessibility: str = ""
    capacity: int = 0
    booking: str = ""
    image: str = ""


class VolunteerOpp(BaseModel):
    id: str
    title: str
    orgSlug: str
    description: str
    age: str = ""
    time: str = ""
    skills: str = ""


class NewsletterEdition(BaseModel):
    id: str = Field(default_factory=new_id)
    subject: str
    body_html: str
    body_intro: str = ""
    scheduled_for: Optional[str] = None
    sent_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# ─────────── Helpers ───────────
async def _find_org(slug: str) -> dict:
    org = await db.orgs.find_one({"slug": slug}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Organisation not found")
    return org


def _strip_id(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ─────────── Root ───────────
@api.get("/")
async def root():
    return {"message": "Blackrod Now API", "ok": True}


@api.get("/admin/stats")
async def admin_stats():
    return {
        "events_total": await db.events.count_documents({}),
        "events_pending": await db.events.count_documents({"status": "pending"}),
        "orgs_total": await db.orgs.count_documents({}),
        "orgs_pending": await db.orgs.count_documents({"status": "pending"}),
        "subscribers": await db.subscribers.count_documents({"unsubscribed": False}),
        "messages_unread": await db.messages.count_documents({"read": False}),
    }


# ─────────── Seed (frontend bootstraps once from mockData) ───────────
class SeedPayload(BaseModel):
    organisations: List[Dict[str, Any]] = []
    events: List[Dict[str, Any]] = []
    feed_posts: List[Dict[str, Any]] = []
    venues: List[Dict[str, Any]] = []
    volunteers: List[Dict[str, Any]] = []


@api.get("/admin/seeded")
async def is_seeded():
    return {"seeded": (await db.orgs.count_documents({})) > 0}


@api.post("/admin/seed")
async def seed_from_payload(payload: SeedPayload, force: bool = False):
    if not force and (await db.orgs.count_documents({})) > 0:
        return {"status": "already-seeded"}
    if force:
        await asyncio.gather(
            db.orgs.delete_many({}),
            db.events.delete_many({}),
            db.feed.delete_many({}),
            db.venues.delete_many({}),
            db.volunteers.delete_many({}),
        )
    if payload.organisations:
        await db.orgs.insert_many([{**o, "status": o.get("status", "approved")} for o in payload.organisations])
    if payload.events:
        await db.events.insert_many([{**e, "status": e.get("status", "approved")} for e in payload.events])
    if payload.feed_posts:
        await db.feed.insert_many(list(payload.feed_posts))
    if payload.venues:
        await db.venues.insert_many(list(payload.venues))
    if payload.volunteers:
        await db.volunteers.insert_many(list(payload.volunteers))
    return {"status": "seeded", "orgs": len(payload.organisations), "events": len(payload.events)}


# ─────────── Organisations ───────────
@api.get("/organisations")
async def list_organisations(include_pending: bool = False):
    q = {} if include_pending else {"status": {"$ne": "pending"}}
    return await db.orgs.find(q, {"_id": 0}).to_list(1000)


@api.get("/organisations/{slug}")
async def get_organisation(slug: str):
    return await _find_org(slug)


@api.post("/organisations")
async def submit_organisation(org: Organisation):
    org.status = "pending"
    doc = org.model_dump()
    doc["updated_at"] = now_iso()
    await db.orgs.insert_one(dict(doc))
    return _strip_id(doc)


class OrgPatch(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    short: Optional[str] = None
    about: Optional[str] = None
    does: Optional[str] = None
    forWho: Optional[str] = None
    meeting: Optional[str] = None
    address: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    socials: Optional[Socials] = None
    brandColor: Optional[str] = None
    logo: Optional[str] = None
    cover: Optional[str] = None
    logo_path: Optional[str] = None
    logo_thumb_path: Optional[str] = None
    cover_path: Optional[str] = None


@api.patch("/organisations/{slug}")
async def patch_organisation(slug: str, patch: OrgPatch):
    updates = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if not updates:
        return await _find_org(slug)
    updates["updated_at"] = now_iso()
    res = await db.orgs.update_one({"slug": slug}, {"$set": updates})
    if not res.matched_count:
        raise HTTPException(404, "Organisation not found")
    return await _find_org(slug)


@api.post("/admin/organisations/{slug}/status")
async def admin_org_status(slug: str, body: Dict[str, str]):
    await db.orgs.update_one({"slug": slug}, {"$set": {"status": body.get("status", "approved")}})
    return await _find_org(slug)


@api.delete("/admin/organisations/{slug}")
async def admin_delete_org(slug: str):
    await db.orgs.delete_one({"slug": slug})
    return {"ok": True}


# ─────────── Events ───────────
@api.get("/events")
async def list_events(upcoming_only: bool = False, include_pending: bool = False):
    q: Dict[str, Any] = {} if include_pending else {"status": {"$ne": "pending"}}
    events = await db.events.find(q, {"_id": 0}).to_list(2000)
    if upcoming_only:
        nowi = now_iso()
        events = [e for e in events if (e.get("end") or e.get("start")) >= nowi]
    return events


@api.get("/events/{event_id}")
async def get_event(event_id: str):
    e = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Event not found")
    return e


# ─────────── Event OG page (rich Facebook/LinkedIn/WhatsApp previews) ───────────
# Returns a tiny HTML page with per-event Open Graph tags for social crawlers,
# plus a meta-refresh + JS redirect so real humans land on the canonical
# React event page. Crawlers ignore the redirect; humans never linger here.
import html as _html_lib
from fastapi import Request as _Req
from fastapi.responses import HTMLResponse as _HTMLResp


def _abs_base_url(req: _Req) -> str:
    proto = req.headers.get("x-forwarded-proto") or req.url.scheme or "https"
    host = req.headers.get("x-forwarded-host") or req.headers.get("host") or req.url.netloc
    return f"{proto}://{host}"


@api.get("/events/{event_id}/og", response_class=_HTMLResp)
async def event_og_page(event_id: str, request: _Req):
    e = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Event not found")

    org = await db.orgs.find_one({"slug": e.get("orgSlug")}, {"_id": 0}) or {}
    base = _abs_base_url(request)
    canonical = f"{base}/events/{event_id}"

    # Resolve a good preview image (event image → org cover → org logo → site logo)
    img = e.get("image") or ""
    if not img and org.get("cover_path"):
        img = f"{base}/api/organisations/{org['slug']}/cover"
    if not img and org.get("logo_path"):
        img = f"{base}/api/organisations/{org['slug']}/logo"
    if not img:
        img = f"{base}/logo.png"

    # Format a human date line for the description prefix
    try:
        start_iso = e.get("start") or ""
        dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00")) if start_iso else None
        when = dt.strftime("%a %d %b %Y · %H:%M") if dt else ""
    except Exception:
        when = ""

    raw_title = e.get("title") or "Blackrod Event"
    raw_desc_parts = [p for p in [when, e.get("venue"), e.get("description")] if p]
    raw_desc = " · ".join(raw_desc_parts[:2])
    if e.get("description"):
        raw_desc = (raw_desc + " — " + e["description"]) if raw_desc else e["description"]
    raw_desc = raw_desc[:280]
    # Trim to nearest word boundary for prettier previews.
    if len(raw_desc) == 280 and " " in raw_desc:
        raw_desc = raw_desc.rsplit(" ", 1)[0].rstrip(",.:;-—") + "…"

    esc = _html_lib.escape
    title = esc(raw_title)
    desc = esc(raw_desc)
    site_name = "Blackrod Now"
    img_url = esc(img)
    canonical_esc = esc(canonical)

    body = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{title} — Blackrod Now</title>
<meta name="description" content="{desc}" />
<link rel="canonical" href="{canonical_esc}" />

<meta property="og:type" content="event" />
<meta property="og:site_name" content="{site_name}" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:url" content="{canonical_esc}" />
<meta property="og:image" content="{img_url}" />
<meta property="og:image:alt" content="{title}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{desc}" />
<meta name="twitter:image" content="{img_url}" />

<meta http-equiv="refresh" content="0; url={canonical_esc}" />
<script>window.location.replace({canonical_esc!r});</script>
<style>body{{font-family:system-ui,sans-serif;padding:2rem;color:#333;max-width:640px;margin:0 auto}}a{{color:#0052FF}}</style>
</head>
<body>
<p>Redirecting to <a href="{canonical_esc}">{title}</a>…</p>
</body>
</html>"""

    return _HTMLResp(
        content=body,
        headers={"Cache-Control": "public, max-age=300"},
    )


# ─────────── Live calendar feed (.ics / webcal) ───────────
from fastapi.responses import PlainTextResponse as _PlainResp


def _ics_escape(txt: str) -> str:
    """Escape reserved iCalendar characters per RFC 5545."""
    if not txt:
        return ""
    return (
        txt.replace("\\", "\\\\")
        .replace(",", "\\,")
        .replace(";", "\\;")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def _ics_dt(iso: str) -> str:
    """Convert ISO datetime to iCal UTC form: 20260912T140000Z."""
    if not iso:
        return ""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    except Exception:
        return ""


def _ics_fold(line: str) -> str:
    """Fold long lines to 75 octets per RFC 5545."""
    if len(line.encode("utf-8")) <= 75:
        return line
    out = []
    while line:
        chunk = line[:73]
        out.append(chunk)
        line = line[73:]
        if line:
            line = " " + line  # leading space marks continuation
    return "\r\n".join(out)


@api.get("/calendar.ics", response_class=_PlainResp)
async def calendar_feed(
    request: _Req,
    device: Optional[str] = None,
    orgs: Optional[str] = None,
    category: Optional[str] = None,
    upcoming_only: bool = True,
):
    """Live iCalendar feed of Blackrod events.

    Filters (all optional, apply in order of precedence):
      • ?device=<uuid>   – events for orgs/categories the anonymous user follows
      • ?orgs=slug1,slug2
      • ?category=Community
      • ?upcoming_only=false to include past events (default true)
    """
    base = _abs_base_url(request)
    q: Dict[str, Any] = {"status": {"$ne": "pending"}}

    org_slugs: Optional[List[str]] = None
    cats: Optional[List[str]] = None

    if device:
        sub = await db.subscribers.find_one({"deviceId": device}) or {}
        follows = sub.get("follows") or {}
        org_slugs = follows.get("orgs") or None
        cats = follows.get("categories") or None
    if orgs:
        org_slugs = [s.strip() for s in orgs.split(",") if s.strip()]
    if category:
        cats = [category]

    if org_slugs and cats:
        q["$or"] = [{"orgSlug": {"$in": org_slugs}}, {"category": {"$in": cats}}]
    elif org_slugs:
        q["orgSlug"] = {"$in": org_slugs}
    elif cats:
        q["category"] = {"$in": cats}

    events = await db.events.find(q, {"_id": 0}).sort("start", 1).to_list(2000)
    if upcoming_only:
        nowi = now_iso()
        events = [e for e in events if (e.get("end") or e.get("start") or "") >= nowi]

    # Calendar name reflects the applied filter
    name_parts = ["Blackrod Now"]
    if org_slugs:
        name_parts.append(f"{len(org_slugs)} orgs")
    if cats:
        name_parts.append(cats[0] if len(cats) == 1 else f"{len(cats)} categories")
    if device and not org_slugs and not cats:
        name_parts.append("Personal")
    cal_name = " · ".join(name_parts)
    cal_desc = "Live-updating calendar feed from Blackrod Now"

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Blackrod Now//Events Feed//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_ics_escape(cal_name)}",
        f"NAME:{_ics_escape(cal_name)}",
        f"X-WR-CALDESC:{_ics_escape(cal_desc)}",
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
    ]

    dtstamp = _ics_dt(now_iso())
    for e in events:
        dtstart = _ics_dt(e.get("start") or "")
        dtend = _ics_dt(e.get("end") or e.get("start") or "")
        if not dtstart:
            continue
        canonical = f"{base}/events/{e.get('id')}"
        loc = ", ".join([p for p in [e.get("venue"), e.get("address")] if p])
        desc_parts = [e.get("description") or "", f"Details: {canonical}"]
        desc = "\n\n".join([p for p in desc_parts if p])
        lines += [
            "BEGIN:VEVENT",
            _ics_fold(f"UID:{e.get('id')}@blackrodnow"),
            f"DTSTAMP:{dtstamp}",
            f"DTSTART:{dtstart}",
            f"DTEND:{dtend}",
            _ics_fold(f"SUMMARY:{_ics_escape(e.get('title') or 'Blackrod event')}"),
            _ics_fold(f"DESCRIPTION:{_ics_escape(desc)}"),
        ]
        if loc:
            lines.append(_ics_fold(f"LOCATION:{_ics_escape(loc)}"))
        if e.get("category"):
            lines.append(_ics_fold(f"CATEGORIES:{_ics_escape(e['category'])}"))
        lines.append(f"URL:{canonical}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")

    body = "\r\n".join(lines) + "\r\n"
    return _PlainResp(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={"Cache-Control": "public, max-age=1800"},
    )


# ─────────── Org "share pack" (per-org email pack of upcoming events) ───────────
def _org_share_pack_data(org: Dict[str, Any], events: List[Dict[str, Any]], base: str, limit: int = 6) -> Dict[str, Any]:
    upcoming = [e for e in events if e.get("orgSlug") == org["slug"] and (e.get("end") or e.get("start") or "") >= now_iso()]
    upcoming.sort(key=lambda x: x.get("start", ""))
    upcoming = upcoming[:limit]
    items = []
    for e in upcoming:
        canonical = f"{base}/events/{e['id']}"
        og_url = f"{base}/api/events/{e['id']}/og"
        share_text = f"{e['title']} — {e.get('venue') or 'Blackrod'}"
        items.append({
            "id": e["id"],
            "title": e["title"],
            "start": e.get("start"),
            "venue": e.get("venue") or "",
            "description": (e.get("description") or "")[:220],
            "image": e.get("image") or "",
            "canonical_url": canonical,
            "og_url": og_url,
            "share_text": share_text,
            "share_links": {
                "facebook": f"https://www.facebook.com/sharer/sharer.php?u={requests.utils.quote(og_url, safe='')}",
                "linkedin": f"https://www.linkedin.com/sharing/share-offsite/?url={requests.utils.quote(og_url, safe='')}",
                "twitter": f"https://twitter.com/intent/tweet?text={requests.utils.quote(share_text, safe='')}&url={requests.utils.quote(og_url, safe='')}",
                "whatsapp": f"https://wa.me/?text={requests.utils.quote(share_text + ' ' + og_url, safe='')}",
            },
        })
    return {"org": {"slug": org["slug"], "name": org["name"], "brandColor": org.get("brandColor", "#0052FF")}, "events": items, "count": len(items)}


def _render_share_pack_html(pack: Dict[str, Any], base: str) -> str:
    org = pack["org"]
    brand = org.get("brandColor", "#0052FF")
    if not pack["events"]:
        return f"""<div style="font-family:system-ui,sans-serif;padding:24px;color:#333">
          <h1 style="color:{brand}">Hello {org['name']}</h1>
          <p>You have no upcoming events on Blackrod Now this week. Add one and we'll include it in your next share pack.</p>
          <p><a href="{base}/organisation-dashboard" style="color:{brand}">Open your dashboard →</a></p>
        </div>"""
    rows = []
    for e in pack["events"]:
        img = e["image"] or f"{base}/logo.png"
        try:
            dt = datetime.fromisoformat((e["start"] or "").replace("Z", "+00:00"))
            when = dt.strftime("%a %d %b · %H:%M")
        except Exception:
            when = ""
        rows.append(f"""
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin:0 0 24px 0;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden">
          <tr><td>
            <img src="{img}" alt="" width="600" style="width:100%;max-width:600px;display:block;object-fit:cover;height:220px" />
          </td></tr>
          <tr><td style="padding:16px 20px">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:{brand}">{when}</div>
            <div style="font-size:20px;font-weight:800;margin-top:4px;color:#111827">{_html_lib.escape(e['title'])}</div>
            <div style="font-size:14px;color:#6B7280;margin-top:4px">{_html_lib.escape(e['venue'])}</div>
            <p style="font-size:14px;color:#374151;line-height:1.5;margin:12px 0 16px 0">{_html_lib.escape(e['description'])}</p>
            <div>
              <a href="{e['share_links']['facebook']}" style="display:inline-block;padding:8px 14px;margin:0 6px 6px 0;background:#1877F2;color:#fff;border-radius:999px;font-size:12px;font-weight:700;text-decoration:none">Facebook</a>
              <a href="{e['share_links']['linkedin']}" style="display:inline-block;padding:8px 14px;margin:0 6px 6px 0;background:#0A66C2;color:#fff;border-radius:999px;font-size:12px;font-weight:700;text-decoration:none">LinkedIn</a>
              <a href="{e['share_links']['twitter']}" style="display:inline-block;padding:8px 14px;margin:0 6px 6px 0;background:#111;color:#fff;border-radius:999px;font-size:12px;font-weight:700;text-decoration:none">X</a>
              <a href="{e['share_links']['whatsapp']}" style="display:inline-block;padding:8px 14px;margin:0 6px 6px 0;background:#25D366;color:#fff;border-radius:999px;font-size:12px;font-weight:700;text-decoration:none">WhatsApp</a>
              <a href="{e['canonical_url']}" style="display:inline-block;padding:8px 14px;margin:0 6px 6px 0;background:#F3F4F6;color:#111;border-radius:999px;font-size:12px;font-weight:700;text-decoration:none">Event page</a>
            </div>
          </td></tr>
        </table>
        """)
    body = "\n".join(rows)
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#F9FAFB;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
<table role="presentation" cellspacing="0" cellpadding="0" width="100%" bgcolor="#F9FAFB">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" width="640" style="max-width:640px;padding:24px">
  <tr><td style="text-align:center;padding:12px 0 24px 0">
    <div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:{brand};font-weight:800">Blackrod Now · Share Pack</div>
    <h1 style="font-size:28px;color:#111827;margin:8px 0 4px 0">Your upcoming events</h1>
    <p style="font-size:15px;color:#6B7280;margin:0">Ready-to-share posts for {_html_lib.escape(org['name'])}. Tap a button below any event to share.</p>
  </td></tr>
  <tr><td>{body}</td></tr>
  <tr><td style="text-align:center;padding:24px 0;color:#9CA3AF;font-size:12px">
    Sent from Blackrod Now · <a href="{base}/organisation-dashboard" style="color:{brand}">Open dashboard</a>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>"""


@api.get("/organisations/{slug}/share-pack")
async def get_share_pack(slug: str, request: _Req):
    org = await _find_org(slug)
    all_events = await db.events.find({"status": {"$ne": "pending"}}, {"_id": 0}).to_list(2000)
    base = _abs_base_url(request)
    return _org_share_pack_data(org, all_events, base)


class SharePackEmailReq(BaseModel):
    to: Optional[str] = None  # override; else uses org.email


@api.post("/organisations/{slug}/share-pack/email")
async def email_share_pack(slug: str, req: SharePackEmailReq, request: _Req):
    org = await _find_org(slug)
    to = (req.to or org.get("email") or "").strip()
    if not to:
        raise HTTPException(400, "No recipient email — set an email on the org profile or pass `to`.")
    all_events = await db.events.find({"status": {"$ne": "pending"}}, {"_id": 0}).to_list(2000)
    base = _abs_base_url(request)
    pack = _org_share_pack_data(org, all_events, base)
    html = _render_share_pack_html(pack, base)
    subject = f"Your Blackrod Now share pack — {pack['count']} upcoming event{'s' if pack['count'] != 1 else ''}"
    result = await asyncio.to_thread(resend_send, to, subject, html)
    return {"ok": True, "to": to, "count": pack["count"], "email": result}


@api.post("/events")
async def create_event(evt: Event):
    if evt.status not in ("pending", "approved"):
        evt.status = "pending"
    await db.events.insert_one(evt.model_dump())
    return evt


@api.post("/admin/events/{event_id}/status")
async def admin_event_status(event_id: str, body: Dict[str, str]):
    await db.events.update_one({"id": event_id}, {"$set": {"status": body.get("status", "approved")}})
    return await get_event(event_id)


@api.post("/admin/events/{event_id}/feature")
async def admin_feature_event(event_id: str):
    e = await db.events.find_one({"id": event_id})
    if not e:
        raise HTTPException(404, "Event not found")
    await db.events.update_one({"id": event_id}, {"$set": {"featured": not e.get("featured", False)}})
    return await get_event(event_id)


@api.delete("/admin/events/{event_id}")
async def admin_delete_event(event_id: str):
    await db.events.delete_one({"id": event_id})
    return {"ok": True}


# ─────────── Feed ───────────
@api.get("/feed")
async def list_feed():
    return await db.feed.find({}, {"_id": 0}).sort("time", -1).to_list(500)


@api.post("/feed")
async def create_feed_post(post: FeedPost):
    await db.feed.insert_one(post.model_dump())
    return post


# ─────────── Venues & Volunteers ───────────
@api.get("/venues")
async def list_venues():
    return await db.venues.find({}, {"_id": 0}).to_list(200)


@api.get("/volunteers")
async def list_volunteers():
    return await db.volunteers.find({}, {"_id": 0}).to_list(200)


# ─────────── Subscribers ───────────
class SubscribeReq(BaseModel):
    email: EmailStr
    device_id: Optional[str] = None
    followed_orgs: Optional[List[str]] = None
    followed_categories: Optional[List[str]] = None


@api.post("/subscribe")
async def subscribe(req: SubscribeReq):
    existing = await db.subscribers.find_one({"email": req.email.lower()}, {"_id": 0})
    if existing:
        # merge follows + always reactivate (never insert a duplicate)
        followed_orgs = list(set((existing.get("followed_orgs") or []) + (req.followed_orgs or [])))
        followed_categories = list(set((existing.get("followed_categories") or []) + (req.followed_categories or [])))
        await db.subscribers.update_one(
            {"email": req.email.lower()},
            {"$set": {
                "followed_orgs": followed_orgs,
                "followed_categories": followed_categories,
                "unsubscribed": False,
                "digest": True,
            }},
        )
        return {
            "ok": True,
            "already_subscribed": True,
            "reactivated": bool(existing.get("unsubscribed")),
            "unsub_token": existing["unsub_token"],
            "pref_token": existing["pref_token"],
        }
    sub = Subscriber(
        email=req.email.lower(),
        device_id=req.device_id,
        followed_orgs=req.followed_orgs or [],
        followed_categories=req.followed_categories or [],
    )
    await db.subscribers.insert_one(sub.model_dump())
    # welcome email
    unsub_link = f"{PUBLIC_URL}/unsubscribe/{sub.unsub_token}"
    pref_link = f"{PUBLIC_URL}/preferences/{sub.pref_token}"
    html = _render_welcome(sub.email, unsub_link, pref_link)
    asyncio.create_task(asyncio.to_thread(resend_send, sub.email, "Welcome to Blackrod Now 👋", html))
    return {"ok": True, "already_subscribed": False, "unsub_token": sub.unsub_token, "pref_token": sub.pref_token}


@api.post("/unsubscribe/{token}")
async def unsubscribe(token: str):
    res = await db.subscribers.update_one({"unsub_token": token}, {"$set": {"unsubscribed": True}})
    if not res.matched_count:
        raise HTTPException(404, "Unknown unsubscribe token")
    return {"ok": True}


@api.get("/preferences/{token}")
async def get_preferences(token: str):
    sub = await db.subscribers.find_one({"pref_token": token}, {"_id": 0})
    if not sub:
        raise HTTPException(404, "Unknown preferences token")
    return sub


class PrefPatch(BaseModel):
    followed_orgs: Optional[List[str]] = None
    followed_categories: Optional[List[str]] = None
    digest: Optional[bool] = None


@api.patch("/preferences/{token}")
async def patch_preferences(token: str, patch: PrefPatch):
    updates = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if not updates:
        return await get_preferences(token)
    await db.subscribers.update_one({"pref_token": token}, {"$set": updates})
    return await get_preferences(token)


# ─────────── Device follows (anonymous, no email) ───────────
class FollowReq(BaseModel):
    device_id: str
    kind: Literal["org", "category"]
    value: str
    action: Literal["add", "remove"]


@api.get("/follows/{device_id}")
async def get_follows(device_id: str):
    doc = await db.follows.find_one({"device_id": device_id}, {"_id": 0})
    return doc or {"device_id": device_id, "orgs": [], "categories": []}


@api.post("/follows")
async def toggle_follow(req: FollowReq):
    key = "orgs" if req.kind == "org" else "categories"
    op = "$addToSet" if req.action == "add" else "$pull"
    await db.follows.update_one({"device_id": req.device_id}, {op: {key: req.value}}, upsert=True)
    return await get_follows(req.device_id)


# ─────────── Notifications (admin → org) ───────────
class AdminNotifyReq(BaseModel):
    org_slug: str
    title: str
    body: str


@api.post("/admin/notifications")
async def admin_send_notification(req: AdminNotifyReq):
    n = Notification(org_slug=req.org_slug, title=req.title, body=req.body)
    await db.notifications.insert_one(n.model_dump())
    return n


@api.get("/organisations/{slug}/notifications")
async def get_org_notifications(slug: str):
    return await db.notifications.find({"org_slug": slug}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.patch("/notifications/{nid}/read")
async def mark_notification_read(nid: str):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}


# ─────────── Contact admin (org → super admin) ───────────
class ContactAdminReq(BaseModel):
    from_org_slug: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    subject: str
    body: str


@api.post("/contact-admin")
async def contact_admin(req: ContactAdminReq):
    m = AdminMessage(**req.model_dump())
    await db.messages.insert_one(m.model_dump())
    return m


@api.get("/admin/messages")
async def admin_get_messages():
    return await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.patch("/admin/messages/{mid}/read")
async def admin_mark_message_read(mid: str):
    await db.messages.update_one({"id": mid}, {"$set": {"read": True}})
    return {"ok": True}


# ─────────── Documents (per org) ───────────
ALLOWED_EXT = {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "webp", "txt", "csv"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@api.post("/organisations/{slug}/documents")
async def upload_document(slug: str, file: UploadFile = File(...)):
    await _find_org(slug)
    filename = file.filename or "file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported file type .{ext}")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 10 MB)")
    path = f"{APP_NAME}/orgs/{slug}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, file.content_type or "application/octet-stream")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {e}")
    d = Document(
        org_slug=slug,
        name=filename,
        storage_path=result["path"],
        content_type=file.content_type or "application/octet-stream",
        size=result.get("size", len(data)),
    )
    await db.documents.insert_one(d.model_dump())
    return d


@api.get("/organisations/{slug}/documents")
async def list_documents(slug: str):
    return await db.documents.find({"org_slug": slug, "deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.delete("/organisations/{slug}/documents/{doc_id}")
async def delete_document(slug: str, doc_id: str):
    await db.documents.update_one({"id": doc_id, "org_slug": slug}, {"$set": {"deleted": True}})
    return {"ok": True}


@api.get("/documents/{doc_id}/download")
async def download_document(doc_id: str):
    d = await db.documents.find_one({"id": doc_id, "deleted": False}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Document not found")
    try:
        data, ctype = get_object(d["storage_path"])
    except Exception as e:
        raise HTTPException(500, f"Download failed: {e}")
    return Response(
        content=data,
        media_type=d.get("content_type", ctype),
        headers={"Content-Disposition": f'attachment; filename="{d["name"]}"'},
    )


# ─────────── Organisation Logo & Cover images ───────────
IMAGE_EXT = {"png", "jpg", "jpeg", "webp"}
LOGO_AVATAR_SIZE = 512
LOGO_THUMB_SIZE = 128
COVER_WIDTH = 1600
COVER_HEIGHT = 500
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def _open_image(data: bytes) -> Image.Image:
    try:
        img = Image.open(BytesIO(data))
        img = ImageOps.exif_transpose(img)
    except Exception as e:
        raise HTTPException(400, f"Invalid image: {e}")
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA")
    return img


def _process_and_upload_logo(slug: str, data: bytes) -> tuple[str, str]:
    """Center-crop to 512x512 + 128x128 thumb. Returns (avatar_path, thumb_path)."""
    img = _open_image(data)
    avatar = ImageOps.fit(img, (LOGO_AVATAR_SIZE, LOGO_AVATAR_SIZE), Image.Resampling.LANCZOS)
    thumb = ImageOps.fit(img, (LOGO_THUMB_SIZE, LOGO_THUMB_SIZE), Image.Resampling.LANCZOS)

    def _to_png_bytes(im: Image.Image) -> bytes:
        buf = BytesIO()
        im.save(buf, format="PNG", optimize=True)
        return buf.getvalue()

    avatar_bytes = _to_png_bytes(avatar)
    thumb_bytes = _to_png_bytes(thumb)
    avatar_path = f"{APP_NAME}/orgs/{slug}/logo-{uuid.uuid4()}.png"
    thumb_path = f"{APP_NAME}/orgs/{slug}/logo-thumb-{uuid.uuid4()}.png"
    put_object(avatar_path, avatar_bytes, "image/png")
    put_object(thumb_path, thumb_bytes, "image/png")
    return avatar_path, thumb_path


def _process_and_upload_cover(slug: str, data: bytes) -> str:
    """Fit-crop to 1600x500 cover banner. Returns storage path."""
    img = _open_image(data)
    if img.mode == "RGBA":
        # Cover is a background — flatten to RGB for smaller JPEG
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")
    cover = ImageOps.fit(img, (COVER_WIDTH, COVER_HEIGHT), Image.Resampling.LANCZOS)
    buf = BytesIO()
    cover.save(buf, format="JPEG", quality=85, optimize=True, progressive=True)
    cover_path = f"{APP_NAME}/orgs/{slug}/cover-{uuid.uuid4()}.jpg"
    put_object(cover_path, buf.getvalue(), "image/jpeg")
    return cover_path


def _validate_image_upload(file: UploadFile, data: bytes) -> None:
    filename = file.filename or "image"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in IMAGE_EXT:
        raise HTTPException(400, "Only PNG, JPG or WebP allowed")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large (max 5 MB)")


@api.post("/organisations/{slug}/logo")
async def upload_org_logo(slug: str, file: UploadFile = File(...)):
    org = await _find_org(slug)
    data = await file.read()
    _validate_image_upload(file, data)
    try:
        avatar_path, thumb_path = _process_and_upload_logo(slug, data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {e}")
    # Best-effort cleanup of previous objects
    for old in (org.get("logo_path"), org.get("logo_thumb_path")):
        if old:
            try:
                requests.delete(f"{STORAGE_URL}/objects/{old}", headers={"X-Storage-Key": init_storage() or ""}, timeout=15)
            except Exception:
                pass
    await db.orgs.update_one(
        {"slug": slug},
        {"$set": {"logo_path": avatar_path, "logo_thumb_path": thumb_path, "updated_at": now_iso()}},
    )
    return {"ok": True, "logo_url": f"/api/organisations/{slug}/logo", "thumb_url": f"/api/organisations/{slug}/logo/thumb"}


@api.post("/organisations/{slug}/cover")
async def upload_org_cover(slug: str, file: UploadFile = File(...)):
    org = await _find_org(slug)
    data = await file.read()
    _validate_image_upload(file, data)
    try:
        cover_path = _process_and_upload_cover(slug, data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {e}")
    old = org.get("cover_path")
    if old:
        try:
            requests.delete(f"{STORAGE_URL}/objects/{old}", headers={"X-Storage-Key": init_storage() or ""}, timeout=15)
        except Exception:
            pass
    await db.orgs.update_one(
        {"slug": slug},
        {"$set": {"cover_path": cover_path, "updated_at": now_iso()}},
    )
    return {"ok": True, "cover_url": f"/api/organisations/{slug}/cover"}


@api.delete("/organisations/{slug}/logo")
async def delete_org_logo(slug: str):
    await _find_org(slug)
    await db.orgs.update_one(
        {"slug": slug},
        {"$set": {"logo_path": None, "logo_thumb_path": None, "updated_at": now_iso()}},
    )
    return {"ok": True}


@api.delete("/organisations/{slug}/cover")
async def delete_org_cover(slug: str):
    await _find_org(slug)
    await db.orgs.update_one(
        {"slug": slug},
        {"$set": {"cover_path": None, "updated_at": now_iso()}},
    )
    return {"ok": True}


def _serve_org_image(path: Optional[str], content_type_default: str = "image/png"):
    if not path:
        raise HTTPException(404, "Image not set")
    try:
        data, ctype = get_object(path)
    except Exception as e:
        raise HTTPException(500, f"Fetch failed: {e}")
    return Response(
        content=data,
        media_type=content_type_default if not ctype or ctype == "application/octet-stream" else ctype,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@api.get("/organisations/{slug}/logo")
async def get_org_logo(slug: str):
    org = await _find_org(slug)
    return _serve_org_image(org.get("logo_path"), "image/png")


@api.get("/organisations/{slug}/logo/thumb")
async def get_org_logo_thumb(slug: str):
    org = await _find_org(slug)
    return _serve_org_image(org.get("logo_thumb_path") or org.get("logo_path"), "image/png")


@api.get("/organisations/{slug}/cover")
async def get_org_cover(slug: str):
    org = await _find_org(slug)
    return _serve_org_image(org.get("cover_path"), "image/jpeg")


# ─────────── AI parse (multi-event) ───────────
class ParseRequest(BaseModel):
    text: str
    hint: Optional[str] = None


class ParsedItem(BaseModel):
    suggested_type: Literal["event", "update"]
    title: str
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    category: str = "Community"
    description: str
    social_caption: str = ""
    notification_text: str = ""


class ParseResponse(BaseModel):
    items: List[ParsedItem]
    mocked: bool = False


def _fallback_parse(text: str) -> ParsedItem:
    title = (text.strip().split("\n")[0][:80] or "Community update")
    date_m = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?\b", text, re.I)
    time_m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", text, re.I)
    is_event = bool(date_m or time_m)
    return ParsedItem(
        suggested_type="event" if is_event else "update",
        title=title,
        date=date_m.group(0) if date_m else None,
        start_time=time_m.group(0) if time_m else None,
        location=None,
        category="Community",
        description=text.strip()[:500],
        social_caption=f"📣 {title} — happening in Blackrod. More on Blackrod Now.",
        notification_text=f"New on Blackrod Now: {title}",
    )


@api.post("/parse-content", response_model=ParseResponse)
async def parse_content(req: ParseRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(400, "Text required")
    if not EMERGENT_LLM_KEY:
        return ParseResponse(items=[_fallback_parse(req.text)], mocked=True)
    system = (
        "You are a friendly community editor for Blackrod Now (Blackrod, Bolton, UK). "
        "Read the pasted text and return a JSON object with a single key `items` — an ARRAY of one or more "
        "structured suggestions. If the paste describes multiple events (e.g. a newsletter or multi-item flyer), "
        "return one item per event. Each item must have keys: "
        "suggested_type ('event' or 'update'), title, date (or null), start_time (or null), end_time (or null), "
        "location (or null), category (one of: Family, Youth, Sport, School, Charity, Business, Community, Music, "
        "Food & Drink, Volunteering, Faith, Heritage, Health & Wellbeing), "
        "description (1-3 sentences), social_caption (2-3 emojis, 2-4 hashtags), notification_text (max 90 chars). "
        "Warm, modern, youth-friendly tone. Return ONLY the JSON object — no markdown, no prose."
    )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"parse-{new_id()}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        raw = await chat.send_message(UserMessage(text=f"Raw paste:\n\n{req.text}"))
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", cleaned, re.S)
            if not m:
                return ParseResponse(items=[_fallback_parse(req.text)])
            data = json.loads(m.group(0))
        # Accept either {items: [...]} or a single object
        items_raw = data.get("items") if isinstance(data, dict) and "items" in data else [data]
        items = []
        for it in items_raw:
            try:
                items.append(ParsedItem(**{**{"description": ""}, **it}))
            except Exception:
                continue
        if not items:
            items = [_fallback_parse(req.text)]
        return ParseResponse(items=items)
    except Exception as e:
        logger.exception("AI parse failed: %s", e)
        return ParseResponse(items=[_fallback_parse(req.text)])


# ─────────── Newsletter & broadcast ───────────
def _render_welcome(email: str, unsub_link: str, pref_link: str) -> str:
    return f"""
<!DOCTYPE html><html><body style="font-family:Helvetica,Arial,sans-serif;background:#F4F5F7;padding:24px;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden">
    <tr><td style="padding:32px">
      <h1 style="margin:0;font-size:28px;color:#0F172A">Welcome to <span style="color:#0052FF">Blackrod Now</span> 👋</h1>
      <p style="margin:16px 0 0;font-size:15px;color:#475569">You're on the list! We'll send you a friendly Friday round-up of the best events, freebies and good causes across Blackrod.</p>
      <p style="margin:16px 0 0;font-size:15px;color:#475569">Want it more personalised? <a href="{pref_link}" style="color:#0052FF">Choose which organisations and categories</a> you care about.</p>
    </td></tr>
    <tr><td style="padding:16px 32px 32px;color:#94A3B8;font-size:12px;text-align:center;border-top:1px solid #E2E8F0">
      Blackrod Now · Blackrod, Bolton · <a href="{unsub_link}" style="color:#94A3B8">Unsubscribe</a>
    </td></tr>
  </table>
</body></html>
"""


def _render_digest(sub: dict, events: List[dict], updates: List[dict]) -> str:
    unsub = f"{PUBLIC_URL}/unsubscribe/{sub['unsub_token']}"
    pref = f"{PUBLIC_URL}/preferences/{sub['pref_token']}"
    def fmt_time(iso):
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%a %d %b · %H:%M")
        except Exception:
            return ""
    ev_rows = "".join(
        f"""<tr><td style="padding:12px 0;border-bottom:1px solid #E2E8F0">
        <div style="font-weight:700;color:#0F172A">{e.get('title','')}</div>
        <div style="color:#0052FF;font-size:13px">{fmt_time(e.get('start',''))}</div>
        <div style="color:#475569;font-size:13px">{e.get('venue','')}</div>
        </td></tr>"""
        for e in events[:8]
    ) or "<tr><td style='color:#94A3B8;padding:12px 0'>No events matching your preferences this week.</td></tr>"
    up_rows = "".join(
        f"<li style='margin:8px 0;color:#475569'><b style='color:#0F172A'>{u.get('title','')}</b> — {u.get('body','')[:120]}</li>"
        for u in updates[:5]
    )
    return f"""
<!DOCTYPE html><html><body style="font-family:Helvetica,Arial,sans-serif;background:#F4F5F7;padding:24px;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden">
    <tr><td style="padding:28px 28px 8px">
      <h1 style="margin:0;font-size:24px">Your Blackrod Now digest 📬</h1>
      <p style="color:#475569;margin:8px 0 0">Curated for you — following {len(sub.get('followed_orgs',[]))} orgs and {len(sub.get('followed_categories',[]))} categories.</p>
    </td></tr>
    <tr><td style="padding:8px 28px">
      <h2 style="margin:16px 0 4px;font-size:16px;color:#0F172A">What's on</h2>
      <table role="presentation" width="100%">{ev_rows}</table>
    </td></tr>
    {"<tr><td style='padding:8px 28px'><h2 style='margin:16px 0 4px;font-size:16px'>Local updates</h2><ul style='padding-left:16px'>" + up_rows + "</ul></td></tr>" if up_rows else ""}
    <tr><td style="padding:20px 28px 28px;color:#94A3B8;font-size:12px;text-align:center;border-top:1px solid #E2E8F0">
      <a href="{pref}" style="color:#0052FF">Edit preferences</a> · <a href="{unsub}" style="color:#94A3B8">Unsubscribe</a><br/>
      Blackrod Now · Made in Blackrod, Bolton
    </td></tr>
  </table>
</body></html>
"""


async def _events_for_sub(sub: dict) -> List[dict]:
    """Personalised upcoming events for a subscriber."""
    nowi = now_iso()
    q: Dict[str, Any] = {"status": "approved"}
    ors = []
    if sub.get("followed_orgs"):
        ors.append({"orgSlug": {"$in": sub["followed_orgs"]}})
    if sub.get("followed_categories"):
        ors.append({"category": {"$in": sub["followed_categories"]}})
    if ors:
        q["$or"] = ors
    events = await db.events.find(q, {"_id": 0}).to_list(200)
    events = [e for e in events if (e.get("end") or e.get("start", "")) >= nowi]
    events.sort(key=lambda e: e.get("start", ""))
    if not events:  # fallback: any upcoming
        events = await db.events.find({"status": "approved"}, {"_id": 0}).to_list(200)
        events = [e for e in events if (e.get("end") or e.get("start", "")) >= nowi]
        events.sort(key=lambda e: e.get("start", ""))
    return events


async def _updates_for_sub(sub: dict) -> List[dict]:
    q: Dict[str, Any] = {}
    if sub.get("followed_orgs"):
        q["orgSlug"] = {"$in": sub["followed_orgs"]}
    return await db.feed.find(q, {"_id": 0}).sort("time", -1).to_list(20)


@api.get("/admin/newsletter/preview")
async def newsletter_preview(email: Optional[str] = None):
    """Returns the personalised HTML for a subscriber (or a generic one)."""
    sub = None
    if email:
        sub = await db.subscribers.find_one({"email": email.lower(), "unsubscribed": False}, {"_id": 0})
    if not sub:
        # generic preview: no follows
        sub = {"email": "preview@example.com", "unsub_token": "PREVIEW", "pref_token": "PREVIEW", "followed_orgs": [], "followed_categories": []}
    events = await _events_for_sub(sub)
    updates = await _updates_for_sub(sub)
    return {"subject": "Your Blackrod Now digest 📬", "html": _render_digest(sub, events, updates), "sub": sub, "matched_events": len(events), "matched_updates": len(updates)}


class NewsletterEditReq(BaseModel):
    subject: str
    body_intro: Optional[str] = ""
    scheduled_for: Optional[str] = None


@api.post("/admin/newsletter/edition")
async def upsert_edition(req: NewsletterEditReq):
    ed = NewsletterEdition(subject=req.subject, body_intro=req.body_intro or "", scheduled_for=req.scheduled_for, body_html="")
    await db.newsletter.insert_one(ed.model_dump())
    return ed


@api.post("/admin/newsletter/send")
async def send_newsletter(req: NewsletterEditReq):
    subs = await db.subscribers.find({"unsubscribed": False, "digest": True}, {"_id": 0}).to_list(5000)
    sent, failed = 0, 0
    for sub in subs:
        events = await _events_for_sub(sub)
        updates = await _updates_for_sub(sub)
        html = _render_digest(sub, events, updates)
        result = await asyncio.to_thread(resend_send, sub["email"], req.subject, html)
        if result.get("ok"):
            sent += 1
        else:
            failed += 1
    await db.newsletter.insert_one(
        NewsletterEdition(subject=req.subject, body_intro=req.body_intro or "", sent_at=now_iso(), body_html="").model_dump()
    )
    return {"ok": True, "sent": sent, "failed": failed, "mocked": not RESEND_API_KEY}


class BroadcastReq(BaseModel):
    subject: str
    html: str


@api.post("/admin/broadcast")
async def broadcast(req: BroadcastReq):
    subs = await db.subscribers.find({"unsubscribed": False}, {"_id": 0}).to_list(5000)
    sent, failed = 0, 0
    for sub in subs:
        unsub = f"{PUBLIC_URL}/unsubscribe/{sub['unsub_token']}"
        html = req.html + f"<hr style='margin:20px 0;border:none;border-top:1px solid #E2E8F0'/><p style='color:#94A3B8;font-size:12px;text-align:center'>Blackrod Now · <a href='{unsub}' style='color:#94A3B8'>Unsubscribe</a></p>"
        result = await asyncio.to_thread(resend_send, sub["email"], req.subject, html)
        if result.get("ok"):
            sent += 1
        else:
            failed += 1
    return {"ok": True, "sent": sent, "failed": failed, "mocked": not RESEND_API_KEY}


# ─────────── Startup ───────────
@app.on_event("startup")
async def startup():
    init_storage()
    # useful indexes (idempotent)
    try:
        await db.orgs.create_index("slug", unique=True)
        await db.events.create_index("id", unique=True)
        await db.subscribers.create_index("email", unique=True)
        await db.subscribers.create_index("unsub_token", unique=True)
        await db.subscribers.create_index("pref_token", unique=True)
        await db.notifications.create_index([("org_slug", 1), ("created_at", -1)])
        await db.follows.create_index("device_id", unique=True)
    except Exception as e:
        logger.warning("Index setup: %s", e)


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
