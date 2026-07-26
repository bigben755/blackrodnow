"""Blackrod Now backend — MongoDB-persisted community platform."""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Response, Header, Query, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Literal, Any, Dict
from datetime import datetime, timezone, timedelta
from collections import Counter, defaultdict
from difflib import SequenceMatcher
import os
import re
import json
import uuid
import asyncio
import logging
import hashlib
import hmac
import secrets
import csv
import html
import base64
import zipfile
import xml.etree.ElementTree as ET
from functools import lru_cache
import requests
from io import BytesIO
from PIL import Image, ImageOps
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ─────────── Config ───────────
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
SENDER_NAME = os.environ.get("SENDER_NAME", "Blackrod Now")
ADMIN_SENDER_EMAILS = [
    s.strip() for s in os.environ.get("ADMIN_SENDER_EMAILS", SENDER_EMAIL).split(",") if s.strip()
]
WEB_WIZARD_TO_EMAIL = os.environ.get("WEB_WIZARD_TO_EMAIL", SENDER_EMAIL)
WEB_WIZARD_BCC_EMAIL = os.environ.get("WEB_WIZARD_BCC_EMAIL", "benwordsworth@aol.com")
APP_NAME = os.environ.get("APP_NAME", "blackrodnow")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://blackrodnow.local")
ADMIN_LAUNCH_CODE = os.environ.get("ADMIN_LAUNCH_CODE", "Blackr0dN0w!&")
ORG_DEFAULT_PASSWORD = os.environ.get("ORG_DEFAULT_PASSWORD", "Organisat10n!&")
ORG_AUTH_SECRET = os.environ.get("ORG_AUTH_SECRET", f"{APP_NAME}:{ADMIN_LAUNCH_CODE}")
ORG_AUTH_TOKEN_TTL_SECONDS = int(os.environ.get("ORG_AUTH_TOKEN_TTL_SECONDS", "43200"))

# ─────────── DB ───────────
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ─────────── App ───────────
app = FastAPI(title="Blackrod Now API")
api = APIRouter(prefix="/api")
logger = logging.getLogger("blackrodnow")


def new_id() -> str:
    return str(uuid.uuid4())


def new_token() -> str:
    return uuid.uuid4().hex


def _require_org_write_access(slug: str, org_auth: Optional[str] = None, admin_code: Optional[str] = None) -> str:
    """Auth guard stub. Real JWT/Google auth is on the P1 backlog; today the
    role switcher lives on the client and the backend simply accepts write
    requests. Returns the effective role ('admin' if admin_code present, else
    'org'). Route handlers use this both as a role-checker AND as a signal
    for what fields the caller is allowed to change (e.g. status)."""
    return "admin" if admin_code else "org"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
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


def resend_send(
    to_email: str,
    subject: str,
    html: str,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    bcc: Optional[List[str]] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Send via Resend. Returns dict with ok flag + provider id or mock note.

    Optional `from_email` overrides the default sender (must be a
    domain-verified address, e.g. an entry in ADMIN_SENDER_EMAILS).
    """
    if not RESEND_API_KEY:
        logger.info(
            "[MOCK EMAIL] to=%s bcc=%s attachments=%s subject=%s (RESEND_API_KEY not set)",
            to_email,
            bcc or [],
            [a.get("filename") for a in attachments or []],
            subject,
        )
        return {
            "ok": True,
            "mocked": True,
            "to": to_email,
            "bcc": bcc or [],
            "subject": subject,
            "attachments": [{"filename": a.get("filename"), "content_type": a.get("content_type"), "size": a.get("size")} for a in attachments or []],
        }
    try:
        import resend  # lazy
        resend.api_key = RESEND_API_KEY
        sender_addr = from_email or SENDER_EMAIL
        sender_name = from_name if from_name is not None else SENDER_NAME
        # RFC 5322 style: `"Blackrod Now" <blackrodnow@…>` — most clients show
        # the display name instead of the raw address.
        from_field = f'"{sender_name}" <{sender_addr}>' if sender_name else sender_addr
        payload: Dict[str, Any] = {"from": from_field, "to": [to_email], "subject": subject, "html": html}
        if bcc:
            payload["bcc"] = bcc
        if attachments:
            payload["attachments"] = [
                {
                    "filename": a["filename"],
                    "content": a["content"],
                    "content_type": a.get("content_type", "application/octet-stream"),
                }
                for a in attachments
            ]
        result = resend.Emails.send(payload)
        return {
            "ok": True,
            "mocked": False,
            "id": result.get("id"),
            "to": to_email,
            "bcc": bcc or [],
            "attachments": [{"filename": a.get("filename"), "content_type": a.get("content_type"), "size": a.get("size")} for a in attachments or []],
        }
    except Exception as e:
        logger.exception("resend_send failed: %s", e)
        return {
            "ok": False,
            "mocked": False,
            "error": str(e),
            "to": to_email,
            "bcc": bcc or [],
            "attachments": [{"filename": a.get("filename"), "content_type": a.get("content_type"), "size": a.get("size")} for a in attachments or []],
        }


# ─────────── Models ───────────
class AnalyticsEvent(BaseModel):
    id: str = Field(default_factory=new_id)
    kind: Literal[
        "org_view",
        "event_view",
        "share_click",
        "share_pack_email",
        "newsletter_send",
        "broadcast_send",
        "admin_email_send",
    ]
    entity_type: Optional[Literal["org", "event", "site"]] = None
    entity_id: Optional[str] = None
    org_slug: Optional[str] = None
    platform: Optional[str] = None
    device_id: Optional[str] = None
    count: int = 1
    created_at: str = Field(default_factory=now_iso)


class AnalyticsTrackReq(BaseModel):
    kind: Literal["org_view", "event_view", "share_click"]
    entity_type: Optional[Literal["org", "event"]] = None
    entity_id: Optional[str] = None
    org_slug: Optional[str] = None
    platform: Optional[str] = None
    device_id: Optional[str] = None


def _window_start(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _day_key(value: str) -> str:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        return value[:10]


async def _record_analytics_event(
    kind: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    org_slug: Optional[str] = None,
    platform: Optional[str] = None,
    count: int = 1,
    device_id: Optional[str] = None,
) -> None:
    await db.analytics_events.insert_one(
        AnalyticsEvent(
            kind=kind,
            entity_type=entity_type,
            entity_id=entity_id,
            org_slug=org_slug,
            platform=platform,
            count=max(1, int(count or 1)),
            device_id=device_id,
        ).model_dump()
    )


async def _follow_counters() -> Dict[str, Any]:
    device_follows = await db.follows.find({}, {"_id": 0, "orgs": 1, "categories": 1}).to_list(10000)
    subscriber_follows = await db.subscribers.find(
        {"unsubscribed": False}, {"_id": 0, "followed_orgs": 1, "followed_categories": 1}
    ).to_list(10000)

    org_followers = Counter()
    category_followers = Counter()
    device_org_followers = Counter()
    subscriber_org_followers = Counter()
    active_follow_devices = 0
    active_follow_subscribers = 0

    for doc in device_follows:
        orgs = {slug for slug in (doc.get("orgs") or []) if slug}
        categories = {name for name in (doc.get("categories") or []) if name}
        if orgs or categories:
            active_follow_devices += 1
        for slug in orgs:
            org_followers[slug] += 1
            device_org_followers[slug] += 1
        for name in categories:
            category_followers[name] += 1

    for doc in subscriber_follows:
        orgs = {slug for slug in (doc.get("followed_orgs") or []) if slug}
        categories = {name for name in (doc.get("followed_categories") or []) if name}
        if orgs or categories:
            active_follow_subscribers += 1
        for slug in orgs:
            org_followers[slug] += 1
            subscriber_org_followers[slug] += 1
        for name in categories:
            category_followers[name] += 1

    return {
        "org_followers": org_followers,
        "category_followers": category_followers,
        "device_org_followers": device_org_followers,
        "subscriber_org_followers": subscriber_org_followers,
        "active_follow_devices": active_follow_devices,
        "active_follow_subscribers": active_follow_subscribers,
        "org_follow_links": sum(org_followers.values()),
        "category_follow_links": sum(category_followers.values()),
    }


def _summarize_analytics_events(rows: List[Dict[str, Any]], event_lookup: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    page_views_by_org = Counter()
    event_views_by_org = Counter()
    share_clicks_by_org = Counter()
    event_views_by_event = Counter()
    shares_by_event = Counter()
    platform_counts = Counter()
    counts_by_kind = Counter()
    trend = defaultdict(lambda: {"org_views": 0, "event_views": 0, "shares": 0})

    for row in rows:
        kind = row.get("kind")
        count = int(row.get("count") or 1)
        org_slug = row.get("org_slug")
        entity_id = row.get("entity_id")
        day = _day_key(row.get("created_at") or now_iso())
        counts_by_kind[kind] += count

        if kind == "org_view":
            if org_slug:
                page_views_by_org[org_slug] += count
            trend[day]["org_views"] += count
        elif kind == "event_view":
            if entity_id:
                event_views_by_event[entity_id] += count
            if org_slug:
                event_views_by_org[org_slug] += count
            trend[day]["event_views"] += count
        elif kind == "share_click":
            if entity_id:
                shares_by_event[entity_id] += count
            if org_slug:
                share_clicks_by_org[org_slug] += count
            platform_counts[row.get("platform") or "unknown"] += count
            trend[day]["shares"] += count

    top_events = []
    ranked_event_ids = set(event_views_by_event.keys()) | set(shares_by_event.keys())
    for event_id in ranked_event_ids:
        event = event_lookup.get(event_id) or {}
        top_events.append(
            {
                "id": event_id,
                "title": event.get("title") or "Untitled event",
                "org_slug": event.get("orgSlug") or event.get("org_slug") or "",
                "start": event.get("start"),
                "views": event_views_by_event.get(event_id, 0),
                "shares": shares_by_event.get(event_id, 0),
                "score": event_views_by_event.get(event_id, 0) + shares_by_event.get(event_id, 0) * 2,
            }
        )
    top_events.sort(key=lambda item: (-item["score"], -item["views"], item["title"]))

    return {
        "counts_by_kind": counts_by_kind,
        "page_views_by_org": page_views_by_org,
        "event_views_by_org": event_views_by_org,
        "share_clicks_by_org": share_clicks_by_org,
        "event_views_by_event": event_views_by_event,
        "shares_by_event": shares_by_event,
        "platform_counts": platform_counts,
        "trend": [{"date": day, **trend[day]} for day in sorted(trend.keys())],
        "top_events": top_events,
    }


async def _build_site_analytics(days: int = 30) -> Dict[str, Any]:
    window_start = _window_start(days)
    approved_events = await db.events.find({"status": "approved"}, {"_id": 0}).to_list(5000)
    approved_orgs = await db.orgs.find({"status": {"$ne": "pending"}}, {"_id": 0}).to_list(3000)
    recent_events = await db.analytics_events.find({"created_at": {"$gte": window_start}}, {"_id": 0}).to_list(20000)
    follow_summary = await _follow_counters()
    digest_subscribers = await db.subscribers.count_documents({"unsubscribed": False, "digest": True})
    total_feed_posts = await db.feed.count_documents({})
    docs_total = await db.documents.count_documents({"deleted": {"$ne": True}})

    now = datetime.now(timezone.utc).isoformat()
    upcoming_events = [event for event in approved_events if (event.get("start") or "") >= now]
    upcoming_by_org = Counter(event.get("orgSlug") or "" for event in upcoming_events if event.get("orgSlug"))
    event_lookup = {event.get("id"): event for event in approved_events if event.get("id")}
    summary = _summarize_analytics_events(recent_events, event_lookup)

    top_orgs = []
    for org in approved_orgs:
        slug = org.get("slug") or ""
        top_orgs.append(
            {
                "slug": slug,
                "name": org.get("name") or slug,
                "page_views": summary["page_views_by_org"].get(slug, 0),
                "event_views": summary["event_views_by_org"].get(slug, 0),
                "share_clicks": summary["share_clicks_by_org"].get(slug, 0),
                "followers": follow_summary["org_followers"].get(slug, 0),
                "upcoming_events": upcoming_by_org.get(slug, 0),
                "score": summary["page_views_by_org"].get(slug, 0)
                + summary["event_views_by_org"].get(slug, 0)
                + summary["share_clicks_by_org"].get(slug, 0) * 2
                + follow_summary["org_followers"].get(slug, 0),
            }
        )
    top_orgs.sort(key=lambda item: (-item["score"], item["name"]))

    orgs_with_upcoming = sum(1 for count in upcoming_by_org.values() if count > 0)
    pending_content_total = await db.events.count_documents({"status": "pending"}) + await db.orgs.count_documents({"status": "pending"})
    approved_event_count = len(approved_events)
    total_views = summary["counts_by_kind"].get("event_view", 0)
    total_shares = summary["counts_by_kind"].get("share_click", 0)

    return {
        "window_days": days,
        "overview": {
            "approved_orgs": len(approved_orgs),
            "approved_events": approved_event_count,
            "upcoming_events": len(upcoming_events),
            "orgs_with_upcoming_events": orgs_with_upcoming,
            "digest_subscribers": digest_subscribers,
            "org_follow_links": follow_summary["org_follow_links"],
            "category_follow_links": follow_summary["category_follow_links"],
            "active_follow_devices": follow_summary["active_follow_devices"],
            "active_follow_subscribers": follow_summary["active_follow_subscribers"],
            "feed_posts": total_feed_posts,
            "documents": docs_total,
        },
        "engagement": {
            "org_views_30d": summary["counts_by_kind"].get("org_view", 0),
            "event_views_30d": total_views,
            "share_clicks_30d": total_shares,
            "share_pack_emails_30d": summary["counts_by_kind"].get("share_pack_email", 0),
            "newsletter_sends_30d": summary["counts_by_kind"].get("newsletter_send", 0),
            "broadcast_sends_30d": summary["counts_by_kind"].get("broadcast_send", 0),
            "admin_email_sends_30d": summary["counts_by_kind"].get("admin_email_send", 0),
        },
        "health": {
            "avg_event_views_30d": round(total_views / approved_event_count, 1) if approved_event_count else 0,
            "share_click_rate": round(total_shares / total_views, 2) if total_views else 0,
            "orgs_with_upcoming_rate": round(orgs_with_upcoming / len(approved_orgs), 2) if approved_orgs else 0,
            "pending_content_ratio": round(
                pending_content_total / max(1, approved_event_count + len(approved_orgs) + pending_content_total),
                2,
            ),
        },
        "share_platforms_30d": [
            {"platform": platform, "count": count}
            for platform, count in summary["platform_counts"].most_common()
        ],
        "top_orgs_30d": top_orgs[:5],
        "top_events_30d": summary["top_events"][:5],
        "trend_7d": summary["trend"][-7:],
    }


async def _build_org_analytics(slug: str, days: int = 30) -> Dict[str, Any]:
    org = await _find_org(slug)
    window_start = _window_start(days)
    org_events = await db.events.find({"orgSlug": slug}, {"_id": 0}).to_list(2000)
    org_event_ids = {event.get("id") for event in org_events if event.get("id")}
    recent_events = await db.analytics_events.find(
        {"created_at": {"$gte": window_start}, "$or": [{"org_slug": slug}, {"entity_id": {"$in": list(org_event_ids)}}]},
        {"_id": 0},
    ).to_list(10000)
    follow_summary = await _follow_counters()
    summary = _summarize_analytics_events(recent_events, {event.get("id"): event for event in org_events if event.get("id")})

    now = datetime.now(timezone.utc).isoformat()
    approved_events = [event for event in org_events if event.get("status") != "pending"]
    upcoming_events = [event for event in approved_events if (event.get("start") or "") >= now]
    pending_events = [event for event in org_events if event.get("status") == "pending"]
    featured_events = [event for event in approved_events if event.get("featured")]
    unread_notifications = await db.notifications.count_documents({"org_slug": slug, "read": False})
    docs_total = await db.documents.count_documents({"org_slug": slug, "deleted": {"$ne": True}})
    feed_posts = await db.feed.count_documents({"orgSlug": slug})

    top_events = []
    for event in org_events:
        event_id = event.get("id")
        if not event_id:
            continue
        top_events.append(
            {
                "id": event_id,
                "title": event.get("title") or "Untitled event",
                "start": event.get("start"),
                "status": event.get("status") or "approved",
                "views": summary["event_views_by_event"].get(event_id, 0),
                "shares": summary["shares_by_event"].get(event_id, 0),
                "featured": bool(event.get("featured")),
                "score": summary["event_views_by_event"].get(event_id, 0) + summary["shares_by_event"].get(event_id, 0) * 2,
            }
        )
    top_events.sort(key=lambda item: (-item["score"], -item["views"], item["title"]))

    return {
        "org_slug": slug,
        "org_name": org.get("name") or slug,
        "window_days": days,
        "overview": {
            "page_views_30d": summary["page_views_by_org"].get(slug, 0),
            "event_views_30d": summary["event_views_by_org"].get(slug, 0),
            "share_clicks_30d": summary["share_clicks_by_org"].get(slug, 0),
            "followers": follow_summary["org_followers"].get(slug, 0),
            "device_followers": follow_summary["device_org_followers"].get(slug, 0),
            "subscriber_followers": follow_summary["subscriber_org_followers"].get(slug, 0),
            "published_events": len(approved_events),
            "pending_events": len(pending_events),
            "upcoming_events": len(upcoming_events),
            "featured_events": len(featured_events),
            "feed_posts": feed_posts,
            "documents": docs_total,
            "notifications_unread": unread_notifications,
        },
        "share_platforms_30d": [
            {"platform": platform, "count": count}
            for platform, count in summary["platform_counts"].most_common()
        ],
        "top_events_30d": top_events[:5],
        "trend_7d": summary["trend"][-7:],
    }


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
    in_reply_to: Optional[str] = None  # notification id the org is replying to
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
    id: str = Field(default_factory=new_id)
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


class OrgClaimReq(BaseModel):
    contact_name: str = ""
    contact_email: EmailStr
    message: str = ""


class OrgSuggestReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
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
    tags: Optional[List[str]] = None
    contact_name: str = ""
    contact_email: Optional[EmailStr] = None
    message: str = ""


class OrgEditRequest(BaseModel):
    id: str = Field(default_factory=new_id)
    request_type: Literal["claim", "suggest_edit"]
    org_slug: str
    org_name: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    contact_name: str = ""
    contact_email: Optional[EmailStr] = None
    message: str = ""
    status: Literal["pending", "approved", "rejected"] = "pending"
    reviewer_notes: str = ""
    created_at: str = Field(default_factory=now_iso)
    reviewed_at: Optional[str] = None


class OrgPasswordDoc(BaseModel):
    slug: str
    password_salt: str
    password_hash: str
    updated_at: str = Field(default_factory=now_iso)
    updated_by: str = "org"


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
        "org_edit_requests_pending": await db.org_edit_requests.count_documents({"status": "pending"}),
        "subscribers": await db.subscribers.count_documents({"unsubscribed": False}),
        "messages_unread": await db.messages.count_documents({"read": False}),
        "analytics": await _build_site_analytics(),
    }


@api.post("/analytics/track")
async def track_analytics(req: AnalyticsTrackReq):
    await _record_analytics_event(
        req.kind,
        entity_type=req.entity_type,
        entity_id=req.entity_id,
        org_slug=req.org_slug,
        platform=req.platform,
        device_id=req.device_id,
    )
    return {"ok": True}


@api.get("/organisations/{slug}/analytics")
async def org_analytics(slug: str):
    return await _build_org_analytics(slug)


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
async def patch_organisation(
    slug: str,
    patch: OrgPatch,
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    _require_org_write_access(slug, org_auth, admin_code)
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


def _clean_org_patch(data: Dict[str, Any]) -> Dict[str, Any]:
    updates = {k: v for k, v in data.items() if v not in (None, "", [], {})}
    if "socials" in updates and isinstance(updates["socials"], dict):
        updates["socials"] = Socials(**updates["socials"])
    return updates


@api.post("/organisations/{slug}/claim")
async def claim_organisation(slug: str, req: OrgClaimReq):
    org = await _find_org(slug)
    edit_request = OrgEditRequest(
        request_type="claim",
        org_slug=org["slug"],
        org_name=org["name"],
        contact_name=req.contact_name.strip(),
        contact_email=req.contact_email,
        message=req.message.strip(),
    )
    await db.org_edit_requests.insert_one(edit_request.model_dump())
    return edit_request


@api.post("/organisations/{slug}/suggest-edits")
async def suggest_org_edits(slug: str, req: OrgSuggestReq):
    org = await _find_org(slug)
    payload = _clean_org_patch(req.model_dump(exclude_none=True))
    for key in ("contact_name", "contact_email", "message"):
        payload.pop(key, None)
    if not payload:
        raise HTTPException(400, "No suggested changes supplied")
    edit_request = OrgEditRequest(
        request_type="suggest_edit",
        org_slug=org["slug"],
        org_name=org["name"],
        payload=payload,
        contact_name=req.contact_name.strip(),
        contact_email=req.contact_email,
        message=req.message.strip(),
    )
    await db.org_edit_requests.insert_one(edit_request.model_dump())
    return edit_request


@api.get("/admin/org-edit-requests")
async def list_org_edit_requests(status: Optional[str] = None):
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    return await db.org_edit_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)


class OrgEditRequestReview(BaseModel):
    status: Literal["approved", "rejected"]
    reviewer_notes: str = ""


class OrgPasswordVerifyReq(BaseModel):
    password: str


class OrgPasswordChangeReq(BaseModel):
    new_password: str
    current_password: Optional[str] = None
    admin_code: Optional[str] = None


class OrgAccessLoginReq(BaseModel):
    password: Optional[str] = None
    admin_code: Optional[str] = None


@api.post("/admin/org-edit-requests/{request_id}/status")
async def review_org_edit_request(request_id: str, req: OrgEditRequestReview):
    existing = await db.org_edit_requests.find_one({"id": request_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Request not found")
    updates = {
        "status": req.status,
        "reviewer_notes": req.reviewer_notes,
        "reviewed_at": now_iso(),
    }
    await db.org_edit_requests.update_one({"id": request_id}, {"$set": updates})
    if req.status == "approved" and existing.get("request_type") == "suggest_edit" and existing.get("payload"):
        org_updates = dict(existing.get("payload") or {})
        if org_updates:
            org_updates["updated_at"] = now_iso()
            if "socials" in org_updates and isinstance(org_updates["socials"], dict):
                org_updates["socials"] = Socials(**org_updates["socials"])
            await db.orgs.update_one({"slug": existing["org_slug"]}, {"$set": org_updates})
    return await db.org_edit_requests.find_one({"id": request_id}, {"_id": 0})


def _hash_org_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        200000,
    ).hex()


def _new_org_password_doc(slug: str, password: str, updated_by: str) -> OrgPasswordDoc:
    salt = secrets.token_hex(16)
    return OrgPasswordDoc(
        slug=slug,
        password_salt=salt,
        password_hash=_hash_org_password(password, salt),
        updated_by=updated_by,
    )


def _password_matches(doc: Optional[Dict[str, Any]], password: str) -> bool:
    if not password:
        return False
    if not doc:
        return hmac.compare_digest(password, ORG_DEFAULT_PASSWORD)
    expected = doc.get("password_hash") or ""
    actual = _hash_org_password(password, doc.get("password_salt") or "")
    return hmac.compare_digest(actual, expected)


async def _get_org_password_doc(slug: str) -> Optional[Dict[str, Any]]:
    return await db.org_passwords.find_one({"slug": slug}, {"_id": 0})


async def _set_org_password(slug: str, new_password: str, updated_by: str) -> None:
    doc = _new_org_password_doc(slug, new_password, updated_by)
    await db.org_passwords.update_one(
        {"slug": slug},
        {"$set": doc.model_dump()},
        upsert=True,
    )


@api.post("/organisations/{slug}/password/verify")
async def verify_org_password(slug: str, req: OrgPasswordVerifyReq):
    await _find_org(slug)
    doc = await _get_org_password_doc(slug)
    ok = _password_matches(doc, (req.password or "").strip())
    return {"ok": ok}


@api.post("/organisations/{slug}/password/change")
async def change_org_password(slug: str, req: OrgPasswordChangeReq):
    await _find_org(slug)
    new_password = (req.new_password or "").strip()
    if len(new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")

    using_admin = False
    if req.admin_code:
        if not hmac.compare_digest((req.admin_code or "").strip(), ADMIN_LAUNCH_CODE):
            raise HTTPException(403, "Invalid admin code")
        using_admin = True
    else:
        current_password = (req.current_password or "").strip()
        doc = await _get_org_password_doc(slug)
        if not _password_matches(doc, current_password):
            raise HTTPException(403, "Current organisation password is incorrect")

    await _set_org_password(slug, new_password, updated_by=("admin" if using_admin else "org"))
    return {"ok": True}


@api.post("/admin/organisations/{slug}/password/reset")
async def reset_org_password(slug: str, body: Dict[str, str]):
    await _find_org(slug)
    admin_code = (body.get("admin_code") or "").strip()
    if not hmac.compare_digest(admin_code, ADMIN_LAUNCH_CODE):
        raise HTTPException(403, "Invalid admin code")
    password = (body.get("password") or ORG_DEFAULT_PASSWORD).strip()
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    await _set_org_password(slug, password, updated_by="admin-reset")
    return {"ok": True, "slug": slug}


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

    # Sensible image dimensions for Facebook/LinkedIn/Twitter cards. If the
    # image is one of our org logos we already know it's 512×512; otherwise
    # assume the standard event flyer ratio 1200×630.
    if img.endswith("/logo") or img.endswith("/logo.png"):
        img_w, img_h = 512, 512
    elif "/organisations/" in img and img.endswith("/cover"):
        img_w, img_h = 1600, 500
    else:
        img_w, img_h = 1200, 630

    body = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{title} — Blackrod Now</title>
<meta name="description" content="{desc}" />
<link rel="canonical" href="{canonical_esc}" />

<meta property="og:type" content="article" />
<meta property="og:site_name" content="{site_name}" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:url" content="{canonical_esc}" />
<meta property="og:image" content="{img_url}" />
<meta property="og:image:secure_url" content="{img_url}" />
<meta property="og:image:width" content="{img_w}" />
<meta property="og:image:height" content="{img_h}" />
<meta property="og:image:alt" content="{title}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{desc}" />
<meta name="twitter:image" content="{img_url}" />

<!-- IMPORTANT: no <meta http-equiv="refresh"> — Facebook's crawler follows
     meta-refresh and would then read the SPA's generic OG tags instead of
     these per-event tags. We rely on JS redirect for humans (crawlers do
     not execute JavaScript). -->
<script>window.location.replace({canonical_esc!r});</script>
<style>body{{font-family:system-ui,sans-serif;padding:2rem;color:#333;max-width:640px;margin:0 auto;text-align:center}}a{{color:#0052FF;text-decoration:none;font-weight:600}}</style>
</head>
<body>
<h1 style="font-size:20px">{title}</h1>
<p>Opening on Blackrod Now…</p>
<p><a href="{canonical_esc}">Continue &rarr;</a></p>
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
async def email_share_pack(
    slug: str,
    req: SharePackEmailReq,
    request: _Req,
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    _require_org_write_access(slug, org_auth, admin_code)
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
    await _record_analytics_event("share_pack_email", entity_type="org", org_slug=slug, count=1)
    return {"ok": True, "to": to, "count": pack["count"], "email": result}


@api.post("/events")
async def create_event(
    evt: Event,
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    authorized = True
    try:
        _require_org_write_access(evt.orgSlug, org_auth, admin_code)
    except HTTPException:
        authorized = False

    if not authorized:
        # Public submissions stay allowed, but always as pending and never featured.
        await _find_org(evt.orgSlug)
        evt.status = "pending"
        evt.featured = False

    if evt.status not in ("pending", "approved"):
        evt.status = "pending"
    await db.events.insert_one(evt.model_dump())
    return evt


class EventPatch(BaseModel):
    """Partial event update. Any subset of fields may be supplied."""
    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    orgSlug: Optional[str] = None
    category: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    venue: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[str] = None
    age: Optional[str] = None
    accessibility: Optional[str] = None
    booking: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    image: Optional[str] = None
    featured: Optional[bool] = None
    status: Optional[Literal["approved", "pending", "rejected"]] = None


@api.patch("/events/{event_id}")
async def update_event(
    event_id: str,
    patch: EventPatch,
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    existing = await db.events.find_one({"id": event_id})
    if not existing:
        raise HTTPException(404, "Event not found")
    auth_role = _require_org_write_access(existing.get("orgSlug") or "", org_auth, admin_code)
    updates = patch.model_dump(exclude_none=True)
    if not updates:
        return await get_event(event_id)
    if updates.get("orgSlug"):
        # Ensure the target org exists
        await _find_org(updates["orgSlug"])
        if auth_role != "admin" and updates["orgSlug"] != existing.get("orgSlug"):
            raise HTTPException(403, "Organisation admins cannot move events between organisations")
    await db.events.update_one({"id": event_id}, {"$set": updates})
    return await get_event(event_id)


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
async def create_feed_post(
    post: FeedPost,
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    _require_org_write_access(post.orgSlug, org_auth, admin_code)
    await db.feed.insert_one(post.model_dump())
    return post


# ─────────── Venues & Volunteers ───────────
@api.get("/venues")
async def list_venues():
    return await db.venues.find({}, {"_id": 0}).to_list(200)


class VenuePatch(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    facilities: Optional[List[str]] = None
    accessibility: Optional[str] = None
    capacity: Optional[int] = None
    booking: Optional[str] = None
    image: Optional[str] = None


@api.post("/venues")
async def create_venue(venue: Venue):
    existing = await db.venues.find_one({"name": {"$regex": f"^{re.escape(venue.name)}$", "$options": "i"}}, {"_id": 0})
    if existing:
        raise HTTPException(409, "Venue with this name already exists")
    await db.venues.insert_one(venue.model_dump())
    return venue


@api.patch("/venues/{venue_id}")
async def update_venue(venue_id: str, patch: VenuePatch):
    existing = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Venue not found")
    updates = patch.model_dump(exclude_none=True)
    if not updates:
        return existing
    await db.venues.update_one({"id": venue_id}, {"$set": updates})
    updated = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not updated:
        raise HTTPException(404, "Venue not found")
    return updated


@api.get("/volunteers")
async def list_volunteers():
    return await db.volunteers.find({}, {"_id": 0}).to_list(200)


@api.post("/volunteers")
async def create_volunteer(opp: VolunteerOpp):
    await _find_org(opp.orgSlug)
    await db.volunteers.insert_one(opp.model_dump())
    return opp


class VolunteerPatch(BaseModel):
    title: Optional[str] = None
    orgSlug: Optional[str] = None
    description: Optional[str] = None
    age: Optional[str] = None
    time: Optional[str] = None
    skills: Optional[str] = None


@api.patch("/volunteers/{vol_id}")
async def update_volunteer(vol_id: str, patch: VolunteerPatch):
    existing = await db.volunteers.find_one({"id": vol_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Volunteer opportunity not found")
    updates = patch.model_dump(exclude_none=True)
    if not updates:
        return existing
    if updates.get("orgSlug"):
        await _find_org(updates["orgSlug"])
    await db.volunteers.update_one({"id": vol_id}, {"$set": updates})
    updated = await db.volunteers.find_one({"id": vol_id}, {"_id": 0})
    if not updated:
        raise HTTPException(404, "Volunteer opportunity not found")
    return updated


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
    in_reply_to: Optional[str] = None


class WebWizardEnquiryReq(BaseModel):
    from_name: str
    from_email: EmailStr
    business: str = ""
    service: str
    budget: str = ""
    timeline: str = ""
    details: str


def _render_web_wizard_enquiry_html(req: WebWizardEnquiryReq) -> str:
    lines = [
        "<p><b>New Web Design Wizard enquiry</b></p>",
        f"<p><b>Name:</b> {html.escape(req.from_name)}</p>",
        f"<p><b>Email:</b> {html.escape(req.from_email)}</p>",
        f"<p><b>Business:</b> {html.escape(req.business or 'Not provided')}</p>",
        f"<p><b>Service needed:</b> {html.escape(req.service)}</p>",
        f"<p><b>Budget range:</b> {html.escape(req.budget or 'Not provided')}</p>",
        f"<p><b>Preferred timeline:</b> {html.escape(req.timeline or 'Not provided')}</p>",
        "<p><b>Project details:</b></p>",
        f"<p style='white-space:pre-wrap'>{html.escape(req.details)}</p>",
    ]
    return "".join(lines)


@api.post("/contact-admin")
async def contact_admin(req: ContactAdminReq):
    m = AdminMessage(**req.model_dump())
    await db.messages.insert_one(m.model_dump())
    return m


@api.post("/web-wizard/enquiry")
async def web_wizard_enquiry(req: WebWizardEnquiryReq):
    result = resend_send(
        to_email=WEB_WIZARD_TO_EMAIL,
        subject=f"Web Design Wizard enquiry: {req.service}",
        html=_render_web_wizard_enquiry_html(req),
        bcc=[WEB_WIZARD_BCC_EMAIL],
    )
    if not result.get("ok"):
        raise HTTPException(502, "Could not send enquiry email")
    return {"ok": True, "mocked": bool(result.get("mocked", False))}


@api.get("/notifications/{nid}/thread")
async def notification_thread(nid: str):
    """Return the admin notification + any org replies linked to it (oldest first)."""
    notif = await db.notifications.find_one({"id": nid}, {"_id": 0})
    if not notif:
        raise HTTPException(404, "Notification not found")
    replies = await db.messages.find({"in_reply_to": nid}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"notification": notif, "replies": replies}


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
MAX_BULK_PARSE_FILES = int(os.environ.get("MAX_BULK_PARSE_FILES", "8"))
BULK_PARSE_TOTAL_TIMEOUT_SECONDS = int(os.environ.get("BULK_PARSE_TOTAL_TIMEOUT_SECONDS", "80"))
BULK_PARSE_EXTRACTION_TIMEOUT_SECONDS = int(os.environ.get("BULK_PARSE_EXTRACTION_TIMEOUT_SECONDS", "20"))
BULK_PARSE_CLASSIFICATION_TIMEOUT_SECONDS = int(os.environ.get("BULK_PARSE_CLASSIFICATION_TIMEOUT_SECONDS", "30"))
BULK_PARSE_TIMEOUT_SAFETY_SECONDS = 5


@api.post("/organisations/{slug}/documents")
async def upload_document(
    slug: str,
    file: UploadFile = File(...),
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    _require_org_write_access(slug, org_auth, admin_code)
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
async def delete_document(
    slug: str,
    doc_id: str,
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    _require_org_write_access(slug, org_auth, admin_code)
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
async def upload_org_logo(
    slug: str,
    file: UploadFile = File(...),
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    _require_org_write_access(slug, org_auth, admin_code)
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
async def upload_org_cover(
    slug: str,
    file: UploadFile = File(...),
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    _require_org_write_access(slug, org_auth, admin_code)
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
async def delete_org_logo(
    slug: str,
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    _require_org_write_access(slug, org_auth, admin_code)
    await _find_org(slug)
    await db.orgs.update_one(
        {"slug": slug},
        {"$set": {"logo_path": None, "logo_thumb_path": None, "updated_at": now_iso()}},
    )
    return {"ok": True}


@api.delete("/organisations/{slug}/cover")
async def delete_org_cover(
    slug: str,
    org_auth: Optional[str] = Header(None, alias="X-Org-Auth"),
    admin_code: Optional[str] = Header(None, alias="X-Admin-Code"),
):
    _require_org_write_access(slug, org_auth, admin_code)
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
    suggested_type: Literal["event", "volunteer", "organisation", "venue", "update"]
    title: str
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    category: str = "Community"
    description: str
    social_caption: str = ""
    notification_text: str = ""
    action: Literal["new_event", "update_event", "new_volunteer", "update_volunteer", "new_organisation", "update_organisation", "new_venue", "update_venue", "unclear"] = "unclear"
    matched_org_slug: Optional[str] = None
    matched_org_name: Optional[str] = None
    matched_event_id: Optional[str] = None
    matched_event_title: Optional[str] = None
    matched_volunteer_id: Optional[str] = None
    matched_volunteer_title: Optional[str] = None
    matched_venue_id: Optional[str] = None
    matched_venue_name: Optional[str] = None
    confidence: Optional[float] = None
    entity_confidence: Optional[float] = None
    raw_date_text: Optional[str] = None
    raw_time_text: Optional[str] = None
    date_confidence: Optional[float] = None
    time_confidence: Optional[float] = None


class ParsedDocument(BaseModel):
    filename: str
    source_type: str
    text_excerpt: str
    warnings: List[str] = []
    items: List[ParsedItem]


class BulkParseResponse(BaseModel):
    documents: List[ParsedDocument]
    mocked: bool = False


class ParseResponse(BaseModel):
    items: List[ParsedItem]
    mocked: bool = False


def _fallback_parse(text: str) -> ParsedItem:
    title = (text.strip().split("\n")[0][:80] or "Community update")
    date_m = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?\b", text, re.I)
    time_m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", text, re.I)
    is_event = bool(date_m or time_m)
    base = ParsedItem(
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
    return _normalize_parsed_item(base, text)


MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def _looks_iso_date(value: Optional[str]) -> bool:
    return bool(value and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value.strip()))


def _looks_hhmm(value: Optional[str]) -> bool:
    return bool(value and re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value.strip()))


def _format_hhmm(hour: int, minute: int, meridiem: Optional[str]) -> str:
    if meridiem:
        m = meridiem.lower()
        if m == "pm" and hour < 12:
            hour += 12
        if m == "am" and hour == 12:
            hour = 0
    return f"{hour:02d}:{minute:02d}"


def _extract_iso_date(text: str) -> tuple[Optional[str], Optional[str], Optional[float]]:
    now = datetime.now(timezone.utc)
    year_default = now.year

    # 14 June 2026 / Saturday 14 June
    m = re.search(
        r"\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*(\d{1,2})(?:st|nd|rd|th)?\s+"
        r"(january|february|march|april|may|june|july|august|september|october|november|december)"
        r"(?:\s+(\d{4}))?\b",
        text,
        re.I,
    )
    if m:
        day = int(m.group(1))
        month = MONTHS.get(m.group(2).lower())
        year = int(m.group(3)) if m.group(3) else year_default
        if month:
            try:
                return datetime(year, month, day, tzinfo=timezone.utc).strftime("%Y-%m-%d"), m.group(0), 0.9 if m.group(3) else 0.8
            except ValueError:
                pass

    # June 14 2026 / June 14
    m = re.search(
        r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+"
        r"(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b",
        text,
        re.I,
    )
    if m:
        month = MONTHS.get(m.group(1).lower())
        day = int(m.group(2))
        year = int(m.group(3)) if m.group(3) else year_default
        if month:
            try:
                return datetime(year, month, day, tzinfo=timezone.utc).strftime("%Y-%m-%d"), m.group(0), 0.85 if m.group(3) else 0.75
            except ValueError:
                pass

    # 14/06/2026 or 14-06-26 (UK day-first)
    m = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b", text)
    if m:
        day = int(m.group(1))
        month = int(m.group(2))
        year_raw = m.group(3)
        year = year_default if not year_raw else int(year_raw)
        if year < 100:
            year += 2000
        try:
            return datetime(year, month, day, tzinfo=timezone.utc).strftime("%Y-%m-%d"), m.group(0), 0.7 if year_raw else 0.6
        except ValueError:
            pass

    return None, None, None


def _extract_hhmm_times(text: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[float]]:
    # 11am-4pm / 11:30am to 1pm / 10:00-12:30
    m = re.search(
        r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*"
        r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b",
        text,
        re.I,
    )
    if m:
        # Avoid treating date-like numeric spans (e.g. 16-07-26) as time ranges.
        if not any([m.group(2), m.group(3), m.group(5), m.group(6)]):
            m = None
        else:
            h1 = int(m.group(1))
            mm1 = int(m.group(2) or "0")
            ampm1 = m.group(3)
            h2 = int(m.group(4))
            mm2 = int(m.group(5) or "0")
            ampm2 = m.group(6)
            if not ampm1 and ampm2:
                ampm1 = ampm2
            start = _format_hhmm(h1, mm1, ampm1)
            end = _format_hhmm(h2, mm2, ampm2)
            return start, end, m.group(0), 0.9 if (ampm1 or ampm2) else 0.8

    # 24h range: 10:00-12:30
    m = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|–|—|to)\s*([01]?\d|2[0-3]):([0-5]\d)\b", text)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}", f"{int(m.group(3)):02d}:{m.group(4)}", m.group(0), 0.8

    # Single 12h time
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", text, re.I)
    if m:
        h = int(m.group(1))
        mm = int(m.group(2) or "0")
        return _format_hhmm(h, mm, m.group(3)), None, m.group(0), 0.75

    # Single 24h time
    m = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", text)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}", None, m.group(0), 0.7

    return None, None, None, None


def _normalize_parsed_item(item: ParsedItem, source_text: str) -> ParsedItem:
    merged = "\n".join([item.title or "", item.description or "", source_text or ""]).strip()
    updates: dict[str, Any] = {}

    if item.confidence is not None and item.entity_confidence is None:
        updates["entity_confidence"] = item.confidence

    if not _looks_iso_date(item.date):
        extracted_date, raw_date_text, date_conf = _extract_iso_date(merged)
        if extracted_date:
            updates["date"] = extracted_date
            updates["raw_date_text"] = raw_date_text
            updates["date_confidence"] = date_conf
    elif item.date and item.date_confidence is None:
        updates["date_confidence"] = 0.95
        updates["raw_date_text"] = item.date

    if not _looks_hhmm(item.start_time) or (item.end_time and not _looks_hhmm(item.end_time)):
        start_time, end_time, raw_time_text, time_conf = _extract_hhmm_times(merged)
        if start_time and not _looks_hhmm(item.start_time):
            updates["start_time"] = start_time
        if end_time and not _looks_hhmm(item.end_time):
            updates["end_time"] = end_time
        if (start_time or end_time) and time_conf is not None:
            updates["time_confidence"] = time_conf
            updates["raw_time_text"] = raw_time_text
    elif item.start_time and item.time_confidence is None:
        updates["time_confidence"] = 0.95
        if item.end_time:
            updates["raw_time_text"] = f"{item.start_time}-{item.end_time}"
        else:
            updates["raw_time_text"] = item.start_time

    if updates:
        return item.model_copy(update=updates)
    return item


def _clean_text_excerpt(text: str, limit: int = 240) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()[:limit]


def _extract_docx_text(data: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            xml_bytes = archive.read("word/document.xml")
        root = ET.fromstring(xml_bytes)
        namespaces = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs: list[str] = []
        for para in root.findall(".//w:p", namespaces):
            texts = [node.text for node in para.findall('.//w:t', namespaces) if node.text]
            line = "".join(texts).strip()
            if line:
                paragraphs.append(line)
        return "\n".join(paragraphs).strip(), warnings
    except Exception as exc:
        warnings.append(f"DOCX extract failed: {exc}")
        return "", warnings


def _extract_pdf_text(data: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data))
        chunks: list[str] = []
        qr_values: list[str] = []
        for page in reader.pages:
            try:
                chunk = page.extract_text() or ""
            except Exception:
                chunk = ""
            if chunk.strip():
                chunks.append(chunk.strip())
            # Also attempt QR decode from embedded raster images in the page.
            try:
                images = getattr(page, "images", []) or []
                for image in images:
                    image_bytes = getattr(image, "data", None)
                    if not image_bytes:
                        continue
                    values, _ = _decode_qr_values_from_image(image_bytes)
                    qr_values.extend(values)
            except Exception:
                pass

        if qr_values:
            qr_values = list(dict.fromkeys(v.strip() for v in qr_values if v and v.strip()))
            chunks.append("\n".join([f"QR code link: {v}" for v in qr_values]))
            warnings.append(f"Detected {len(qr_values)} QR code link{'s' if len(qr_values) != 1 else ''} in PDF: {' | '.join(qr_values)}")
        text = "\n\n".join(chunks).strip()
        if not text:
            warnings.append("No readable text found in PDF")
        return text, warnings
    except Exception as exc:
        warnings.append(f"PDF extract failed: {exc}")
        return "", warnings


def _extract_xlsx_text(data: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    try:
        from openpyxl import load_workbook

        workbook = load_workbook(BytesIO(data), read_only=True, data_only=True)
        lines: list[str] = []
        for sheet in workbook.worksheets:
            for row in sheet.iter_rows(values_only=True):
                cells = [str(cell).strip() for cell in row if cell is not None and str(cell).strip()]
                if cells:
                    lines.append(" | ".join(cells))
        text = "\n".join(lines).strip()
        if not text:
            warnings.append("No readable text found in spreadsheet")
        return text, warnings
    except Exception as exc:
        warnings.append(f"Spreadsheet extract failed: {exc}")
        return "", warnings


@lru_cache(maxsize=1)
def _get_ocr_engine():
    from rapidocr_onnxruntime import RapidOCR

    return RapidOCR()


def _extract_image_text(data: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    try:
        with Image.open(BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in {"RGB", "L"}:
                img = img.convert("RGB")
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            ocr = _get_ocr_engine()
            result, _ = ocr(buffer.getvalue())
    except Exception as exc:
        warnings.append(f"Image OCR failed: {exc}")
        return "", warnings

    lines: list[str] = []
    for item in result or []:
        if len(item) >= 2 and item[1]:
            text = str(item[1]).strip()
            if text:
                lines.append(text)

    qr_values, qr_warnings = _decode_qr_values_from_image(data)
    if qr_values:
        deduped = list(dict.fromkeys(v.strip() for v in qr_values if v and v.strip()))
        lines.extend([f"QR code link: {v}" for v in deduped])
        warnings.append(f"Detected {len(deduped)} QR code link{'s' if len(deduped) != 1 else ''} in image: {' | '.join(deduped)}")
    warnings.extend(qr_warnings)

    text = "\n".join(lines).strip()
    if not text:
        warnings.append("No readable text found in image")
    return text, warnings


def _decode_qr_values_from_image(data: bytes) -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    try:
        import cv2
        import numpy as np
    except Exception:
        # QR decode is optional; OCR-only path still works.
        return [], warnings

    try:
        arr = np.frombuffer(data, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            return [], warnings

        detector = cv2.QRCodeDetector()
        values: list[str] = []

        try:
            multi = detector.detectAndDecodeMulti(image)
            decoded_info: list[str] = []
            if isinstance(multi, tuple):
                if len(multi) == 4:
                    _, decoded_info, _, _ = multi
                elif len(multi) == 3:
                    decoded_info, _, _ = multi
            for value in decoded_info or []:
                if isinstance(value, str) and value.strip():
                    values.append(value.strip())
        except Exception:
            pass

        if not values:
            try:
                single, _, _ = detector.detectAndDecode(image)
                if isinstance(single, str) and single.strip():
                    values.append(single.strip())
            except Exception:
                pass

        return list(dict.fromkeys(values)), warnings
    except Exception as exc:
        warnings.append(f"QR decode failed: {exc}")
        return [], warnings


def _extract_document_text(filename: str, content_type: str, data: bytes) -> tuple[str, str, list[str]]:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    warnings: list[str] = []
    if ext in {"txt", "md", "rtf", "csv"} or content_type.startswith("text/"):
        try:
            if ext == "csv":
                sample = data.decode("utf-8", errors="ignore")
                rows = []
                for row in csv.reader(sample.splitlines()):
                    row = [cell.strip() for cell in row if cell and cell.strip()]
                    if row:
                        rows.append(" | ".join(row))
                return "\n".join(rows).strip(), "csv", warnings
            return data.decode("utf-8", errors="ignore").strip(), "text", warnings
        except Exception as exc:
            warnings.append(f"Text decode failed: {exc}")
            return "", "text", warnings
    if ext == "docx":
        text, extra = _extract_docx_text(data)
        return text, "docx", warnings + extra
    if ext == "pdf":
        text, extra = _extract_pdf_text(data)
        return text, "pdf", warnings + extra
    if ext == "xlsx":
        text, extra = _extract_xlsx_text(data)
        return text, "xlsx", warnings + extra
    if ext in {"png", "jpg", "jpeg", "webp", "bmp", "gif", "tif", "tiff"} or content_type.startswith("image/"):
        text, extra = _extract_image_text(data)
        return text, "image", warnings + extra
    warnings.append(f"Unsupported auto-parse format: .{ext or 'bin'}")
    return "", ext or "bin", warnings


def _extract_html_text(html_text: str) -> tuple[str, list[str]]:
    warnings: list[str] = []
    try:
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html_text, re.I | re.S)
        og_title_match = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.I)
        og_desc_match = re.search(r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.I)
        desc_match = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.I)
        text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html_text)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        text = html.unescape(text)
        chunks = [
            (og_title_match.group(1) if og_title_match else "").strip(),
            (title_match.group(1) if title_match else "").strip(),
            (og_desc_match.group(1) if og_desc_match else "").strip(),
            (desc_match.group(1) if desc_match else "").strip(),
            re.sub(r"\s+", " ", text).strip(),
        ]
        cleaned = "\n".join([chunk for chunk in chunks if chunk]).strip()
        if not cleaned:
            warnings.append("No readable text found in web page")
        return cleaned, warnings
    except Exception as exc:
        warnings.append(f"Web page extract failed: {exc}")
        return "", warnings


def _extract_url_text(url: str) -> tuple[str, str, list[str]]:
    warnings: list[str] = []
    try:
        response = requests.get(
            url,
            timeout=20,
            headers={"User-Agent": "BlackrodNowBot/1.0 (+https://blackrodnow.local)"},
            allow_redirects=True,
        )
        response.raise_for_status()
    except Exception as exc:
        warnings.append(f"URL fetch failed: {exc}")
        return "", "url", warnings

    content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    final_url = response.url or url
    path = urlparse(final_url).path
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""

    if content_type == "text/html" or ext in {"", "html", "htm", "php", "asp", "aspx"}:
        text, extra = _extract_html_text(response.text)
        return text, "url", warnings + extra

    filename = path.rsplit("/", 1)[-1] or "link"
    if "." not in filename:
        filename = f"{filename or 'link'}.bin"
    text, source_type, extra = _extract_document_text(filename, content_type or "application/octet-stream", response.content)
    return text, source_type, warnings + extra


def _best_match(query: str, choices: list[dict], key: str) -> tuple[Optional[dict], float]:
    query_norm = query.lower().strip()
    best_item: Optional[dict] = None
    best_score = 0.0
    for item in choices:
        candidate = (item.get(key) or "").lower().strip()
        if not candidate:
            continue
        score = SequenceMatcher(None, query_norm, candidate).ratio()
        if candidate in query_norm or query_norm in candidate:
            score = max(score, 0.92)
        if score > best_score:
            best_item = item
            best_score = score
    return best_item, best_score


def _fallback_document_classify(filename: str, text: str, orgs: list[dict], events: list[dict], volunteers: list[dict], venues: list[dict]) -> list[ParsedItem]:
    base = _fallback_parse(text)
    lower = f"{filename}\n{text}".lower()
    has_event_signal = bool(re.search(r"\b(event|fair|match|meet|open day|session|workshop|talk|concert|race|fundraiser|fund raising)\b", lower)) or bool(re.search(r"\b\d{1,2}(:\d{2})?\s*(am|pm)\b", lower))
    has_volunteer_signal = bool(re.search(r"\b(volunteer|volunteering|helper|helpers needed|join our team|steward|coach wanted|mentor|befriender|trustee|committee member)\b", lower))
    has_org_signal = bool(re.search(r"\b(organisation|organization|club|group|society|association|committee|charity|church|school)\b", lower))
    has_venue_signal = bool(re.search(r"\b(venue|hall|community centre|community center|sports centre|sports center|facility|facilities|room hire|booking office|address)\b", lower))
    matched_org, org_score = _best_match(base.title, orgs, "name")
    matched_event, event_score = _best_match(base.title, events, "title")
    matched_volunteer, volunteer_score = _best_match(base.title, volunteers, "title")
    matched_venue, venue_score = _best_match(base.title, venues, "name")
    if matched_venue and venue_score >= max(org_score, event_score, volunteer_score) and venue_score >= 0.65:
        payload = base.model_dump()
        payload.update({
            "suggested_type": "venue",
            "action": "update_venue" if has_venue_signal else "new_venue",
            "matched_venue_id": matched_venue.get("id"),
            "matched_venue_name": matched_venue.get("name"),
            "confidence": round(venue_score, 2),
            "entity_confidence": round(venue_score, 2),
        })
        return [ParsedItem(**payload)]

    if matched_volunteer and volunteer_score >= max(org_score, event_score) and volunteer_score >= 0.65:
        payload = base.model_dump()
        payload.update({
            "suggested_type": "volunteer",
            "action": "update_volunteer" if has_volunteer_signal else "new_volunteer",
            "matched_volunteer_id": matched_volunteer.get("id"),
            "matched_volunteer_title": matched_volunteer.get("title"),
            "matched_org_slug": matched_volunteer.get("orgSlug"),
            "confidence": round(volunteer_score, 2),
            "entity_confidence": round(volunteer_score, 2),
        })
        return [ParsedItem(**payload)]
    if matched_event and event_score >= org_score and event_score >= 0.65:
        payload = base.model_dump()
        payload.update({
            "suggested_type": "event",
            "action": "update_event" if has_event_signal else "new_event",
            "matched_event_id": matched_event.get("id"),
            "matched_event_title": matched_event.get("title"),
            "confidence": round(event_score, 2),
            "entity_confidence": round(event_score, 2),
        })
        return [ParsedItem(**payload)]
    if matched_org and org_score >= 0.65:
        payload = base.model_dump()
        payload.update({
            "suggested_type": "organisation",
            "action": "update_organisation" if has_org_signal else "new_organisation",
            "matched_org_slug": matched_org.get("slug"),
            "matched_org_name": matched_org.get("name"),
            "confidence": round(org_score, 2),
            "entity_confidence": round(org_score, 2),
        })
        return [ParsedItem(**payload)]
    if has_volunteer_signal:
        payload = base.model_dump()
        payload.update({"suggested_type": "volunteer", "action": "new_volunteer", "confidence": 0.55, "entity_confidence": 0.55})
        return [ParsedItem(**payload)]
    if has_event_signal:
        payload = base.model_dump()
        payload.update({"suggested_type": "event", "action": "new_event", "confidence": 0.55, "entity_confidence": 0.55})
        return [ParsedItem(**payload)]
    if has_org_signal:
        payload = base.model_dump()
        payload.update({"suggested_type": "organisation", "action": "new_organisation", "confidence": 0.55, "entity_confidence": 0.55})
        return [ParsedItem(**payload)]
    if has_venue_signal:
        payload = base.model_dump()
        payload.update({"suggested_type": "venue", "action": "new_venue", "confidence": 0.55, "entity_confidence": 0.55})
        return [ParsedItem(**payload)]
    return [base]


async def _parse_text_to_response(text: str, hint: Optional[str] = None) -> ParseResponse:
    if not text or not text.strip():
        raise HTTPException(400, "Text required")
    if not EMERGENT_LLM_KEY:
        return ParseResponse(items=[_fallback_parse(text)], mocked=True)
    system = (
        "You are a friendly community editor for Blackrod Now (Blackrod, Bolton, UK). "
        "Read the pasted text and return a JSON object with a single key `items` — an ARRAY of one or more "
        "structured suggestions. If the paste describes multiple events (e.g. a newsletter or multi-item flyer), "
        "return one item per event. Each item must have keys: "
        "suggested_type ('event', 'volunteer', 'organisation', 'venue' or 'update'), title, date (or null), start_time (or null), end_time (or null), "
        "location (or null), category (one of: Family, Youth, Sport, School, Charity, Business, Community, Music, "
        "Food & Drink, Volunteering, Faith, Heritage, Health & Wellbeing), "
        "description (1-3 sentences), social_caption (2-3 emojis, 2-4 hashtags), notification_text (max 90 chars). "
        "Also include action, matched_org_slug, matched_org_name, matched_event_id, matched_event_title, matched_volunteer_id, matched_volunteer_title, matched_venue_id, matched_venue_name and confidence when you can identify the target. "
        "If possible include raw_date_text, raw_time_text, date_confidence, time_confidence and entity_confidence. "
        "Use action values new_event, update_event, new_volunteer, update_volunteer, new_organisation, update_organisation, new_venue, update_venue or unclear. "
        "Warm, modern, youth-friendly tone. Return ONLY the JSON object — no markdown, no prose."
    )
    if hint:
        system += (
            "\n\nContext for matching: "
            + hint
            + "\nIf the document is clearly an existing organisation update, event update, volunteering update or venue update, prefer update_organisation, update_event, update_volunteer or update_venue and fill in the matching slug/id."
        )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"parse-{new_id()}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        raw = await chat.send_message(UserMessage(text=f"Raw paste:\n\n{text}"))
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", cleaned, re.S)
            if not m:
                return ParseResponse(items=[_fallback_parse(text)])
            data = json.loads(m.group(0))
        items_raw = data.get("items") if isinstance(data, dict) and "items" in data else [data]
        items = []
        for it in items_raw:
            try:
                parsed_item = ParsedItem(**{**{"description": ""}, **it})
                items.append(_normalize_parsed_item(parsed_item, text))
            except Exception:
                continue
        if not items:
            items = [_fallback_parse(text)]
        return ParseResponse(items=items)
    except Exception as e:
        logger.exception("AI parse failed: %s", e)
        return ParseResponse(items=[_fallback_parse(text)])


async def _admin_parse_documents(
    files: Optional[List[UploadFile]] = None,
    source_org_slug: Optional[str] = None,
    urls_json: Optional[str] = None,
    texts_json: Optional[str] = None,
) -> BulkParseResponse:
    file_list = list(files or [])

    def _decode_sources(raw: Optional[str]) -> list[str]:
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, str):
                parsed = [parsed]
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            pass
        return [part.strip() for part in re.split(r"\n{2,}|\r\n{2,}|\n", raw) if part.strip()]

    url_list = _decode_sources(urls_json)
    text_list = _decode_sources(texts_json)
    if len(file_list) + len(url_list) + len(text_list) > MAX_BULK_PARSE_FILES:
        raise HTTPException(400, f"Upload at most {MAX_BULK_PARSE_FILES} total sources per bulk parse request")

    orgs = await db.orgs.find({}, {"_id": 0, "slug": 1, "name": 1}).sort("name", 1).to_list(200)
    events = await db.events.find({}, {"_id": 0, "id": 1, "title": 1}).sort("start", 1).to_list(200)
    volunteers = await db.volunteers.find({}, {"_id": 0, "id": 1, "title": 1, "orgSlug": 1}).sort("title", 1).to_list(300)
    venues = await db.venues.find({}, {"_id": 0, "id": 1, "name": 1, "address": 1}).sort("name", 1).to_list(300)
    source_org = None
    if source_org_slug:
        source_org = await _find_org(source_org_slug)
    documents: list[ParsedDocument] = []
    deadline = asyncio.get_running_loop().time() + BULK_PARSE_TOTAL_TIMEOUT_SECONDS

    def _bulk_timeout_document(filename: str, source_type: str, warnings: list[str]) -> ParsedDocument:
        return ParsedDocument(
            filename=filename,
            source_type=source_type,
            text_excerpt="",
            warnings=warnings,
            items=[_fallback_parse(filename)],
        )

    async def _finalize_source(filename: str, source_type: str, text: str, warnings: list[str]) -> ParsedDocument:
        if not text.strip():
            return ParsedDocument(
                filename=filename,
                source_type=source_type,
                text_excerpt="",
                warnings=warnings + ["No readable text extracted"],
                items=[_fallback_parse(filename)],
            )

        hint = "\n".join([
            f"Filename: {filename}",
            f"Source organisation: {source_org.get('slug')} | {source_org.get('name')}" if source_org else "",
            "Existing organisations:",
            *[f"ORG:{o['slug']}|{o['name']}" for o in orgs[:80]],
            "Existing events:",
            *[f"EVENT:{e['id']}|{e['title']}" for e in events[:120]],
            "Existing volunteering opportunities:",
            *[f"VOL:{v['id']}|{v['title']}|{v.get('orgSlug','')}" for v in volunteers[:160]],
            "Existing venues:",
            *[f"VENUE:{v['id']}|{v['name']}|{v.get('address','')}" for v in venues[:160]],
        ]).strip()
        classification_timeout = max(1, min(BULK_PARSE_CLASSIFICATION_TIMEOUT_SECONDS, int(max(1, deadline - asyncio.get_running_loop().time() - BULK_PARSE_TIMEOUT_SAFETY_SECONDS))))
        try:
            parsed = await asyncio.wait_for(_parse_text_to_response(text, hint=hint), timeout=classification_timeout)
        except asyncio.TimeoutError:
            return ParsedDocument(
                filename=filename,
                source_type=source_type,
                text_excerpt=_clean_text_excerpt(text),
                warnings=warnings + [f"Text classification timed out after {classification_timeout}s"],
                items=_fallback_document_classify(filename, text, orgs, events, volunteers, venues),
            )
        except Exception as exc:
            return ParsedDocument(
                filename=filename,
                source_type=source_type,
                text_excerpt=_clean_text_excerpt(text),
                warnings=warnings + [f"Text classification failed: {exc}"],
                items=[_fallback_parse(text)],
            )

        items = parsed.items or [_fallback_parse(text)]
        if parsed.mocked:
            items = _fallback_document_classify(filename, text, orgs, events, volunteers, venues)
        return ParsedDocument(
            filename=filename,
            source_type=source_type,
            text_excerpt=_clean_text_excerpt(text),
            warnings=warnings,
            items=items,
        )

    for index, file in enumerate(file_list):
        filename = file.filename or "file"
        remaining = deadline - asyncio.get_running_loop().time()
        if remaining <= BULK_PARSE_TIMEOUT_SAFETY_SECONDS:
            timeout_warning = [f"Bulk parse timed out after {BULK_PARSE_TOTAL_TIMEOUT_SECONDS}s"]
            for remaining_file in file_list[index:]:
                remaining_name = remaining_file.filename or "file"
                documents.append(_bulk_timeout_document(remaining_name, "timed_out", timeout_warning))
            break

        data = await file.read()
        if not data:
            documents.append(ParsedDocument(filename=filename, source_type="empty", text_excerpt="", warnings=["Empty file"], items=[_fallback_parse("")]))
            continue
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"File too large (max 10 MB): {filename}")
        extraction_timeout = max(1, min(BULK_PARSE_EXTRACTION_TIMEOUT_SECONDS, int(max(1, remaining - BULK_PARSE_TIMEOUT_SAFETY_SECONDS))))
        try:
            text, source_type, warnings = await asyncio.wait_for(
                asyncio.to_thread(_extract_document_text, filename, file.content_type or "application/octet-stream", data),
                timeout=extraction_timeout,
            )
        except asyncio.TimeoutError:
            documents.append(_bulk_timeout_document(filename, "timed_out", [f"Document extraction timed out after {extraction_timeout}s"]))
            continue
        except Exception as exc:
            documents.append(_bulk_timeout_document(filename, "timed_out", [f"Document extraction failed: {exc}"]))
            continue

        documents.append(await _finalize_source(filename, source_type, text, warnings))

    for index, url in enumerate(url_list):
        remaining = deadline - asyncio.get_running_loop().time()
        filename = urlparse(url).netloc or "link"
        if remaining <= BULK_PARSE_TIMEOUT_SAFETY_SECONDS:
            timeout_warning = [f"Bulk parse timed out after {BULK_PARSE_TOTAL_TIMEOUT_SECONDS}s"]
            for remaining_url in url_list[index:]:
                remaining_name = urlparse(remaining_url).netloc or "link"
                documents.append(_bulk_timeout_document(remaining_name, "timed_out", timeout_warning))
            break

        extraction_timeout = max(1, min(BULK_PARSE_EXTRACTION_TIMEOUT_SECONDS, int(max(1, remaining - BULK_PARSE_TIMEOUT_SAFETY_SECONDS))))
        try:
            text, source_type, warnings = await asyncio.wait_for(
                asyncio.to_thread(_extract_url_text, url),
                timeout=extraction_timeout,
            )
        except asyncio.TimeoutError:
            documents.append(_bulk_timeout_document(filename, "url", [f"URL fetch timed out after {extraction_timeout}s"]))
            continue
        except Exception as exc:
            documents.append(_bulk_timeout_document(filename, "url", [f"URL fetch failed: {exc}"]))
            continue

        documents.append(await _finalize_source(filename, source_type or "url", text, warnings))

    for index, text_source in enumerate(text_list):
        remaining = deadline - asyncio.get_running_loop().time()
        filename = f"pasted-text-{index + 1}.txt"
        if remaining <= BULK_PARSE_TIMEOUT_SAFETY_SECONDS:
            timeout_warning = [f"Bulk parse timed out after {BULK_PARSE_TOTAL_TIMEOUT_SECONDS}s"]
            for remaining_offset, _ in enumerate(text_list[index:], start=index):
                remaining_name = f"pasted-text-{remaining_offset + 1}.txt"
                documents.append(_bulk_timeout_document(remaining_name, "timed_out", timeout_warning))
            break

        documents.append(await _finalize_source(filename, "text", text_source, []))
    return BulkParseResponse(documents=documents, mocked=not EMERGENT_LLM_KEY)


@api.post("/parse-content", response_model=ParseResponse)
async def parse_content(req: ParseRequest):
    return await _parse_text_to_response(req.text, hint=req.hint)


@api.post("/admin/documents/parse", response_model=BulkParseResponse)
async def admin_parse_documents(
    files: Optional[List[UploadFile]] = File(None),
    source_org_slug: Optional[str] = Form(None),
    urls_json: Optional[str] = Form(None),
    texts_json: Optional[str] = Form(None),
):
    return await _admin_parse_documents(files, source_org_slug=source_org_slug, urls_json=urls_json, texts_json=texts_json)


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
    await _record_analytics_event("newsletter_send", entity_type="site", count=sent)
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
    await _record_analytics_event("broadcast_send", entity_type="site", count=sent)
    return {"ok": True, "sent": sent, "failed": failed, "mocked": not RESEND_API_KEY}


# ─────────── Admin free-form email compose ───────────
import re as _re


EMAIL_RE = _re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class AdminEmailReq(BaseModel):
    """Free-form email compose. Recipients accepted as a list or a
    comma/newline-separated string. `from_email` is validated against
    ADMIN_SENDER_EMAILS whitelist. `body` is treated as plain text with
    minimal auto-formatting (newlines → paragraphs, URLs auto-linked)."""
    to: str  # comma/newline-separated
    subject: str
    body: str
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[str] = None


def _coerce_admin_email_req(data: Dict[str, Any]) -> AdminEmailReq:
    return AdminEmailReq(
        to=data.get("to", ""),
        subject=data.get("subject", ""),
        body=data.get("body", ""),
        from_email=data.get("from_email") or None,
        from_name=data.get("from_name") or None,
        reply_to=data.get("reply_to") or None,
    )


async def _read_admin_email_request(request: Request) -> tuple[AdminEmailReq, list[dict[str, Any]]]:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        req = _coerce_admin_email_req({key: form.get(key) for key in ("to", "subject", "body", "from_email", "from_name", "reply_to")})
        attachments: list[dict[str, Any]] = []
        for upload in [item for item in form.getlist("attachments") if getattr(item, "filename", None)]:
            data = await upload.read()
            if len(data) > 10 * 1024 * 1024:
                raise HTTPException(413, f"Attachment too large (max 10 MB): {upload.filename or 'attachment'}")
            attachments.append(
                {
                    "filename": upload.filename or "attachment",
                    "content_type": upload.content_type or "application/octet-stream",
                    "size": len(data),
                    "content": base64.b64encode(data).decode("ascii"),
                }
            )
        return req, attachments

    payload = await request.json()
    req = _coerce_admin_email_req(payload or {})
    attachments: list[dict[str, Any]] = []
    for item in (payload or {}).get("attachments", []) if isinstance(payload, dict) else []:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not content:
            continue
        if isinstance(content, str):
            try:
                raw = base64.b64decode(content)
            except Exception:
                raw = content.encode("utf-8")
        else:
            raw = bytes(content)
        attachments.append(
            {
                "filename": item.get("filename") or item.get("name") or "attachment",
                "content_type": item.get("content_type") or item.get("type") or "application/octet-stream",
                "size": len(raw),
                "content": base64.b64encode(raw).decode("ascii"),
            }
        )
    return req, attachments


def _parse_recipients(raw: str) -> tuple[list[str], list[str]]:
    seen: set[str] = set()
    valid: list[str] = []
    invalid: list[str] = []
    for chunk in _re.split(r"[,;\n]+", raw or ""):
        addr = chunk.strip()
        if not addr:
            continue
        low = addr.lower()
        if low in seen:
            continue
        seen.add(low)
        (valid if EMAIL_RE.match(addr) else invalid).append(addr)
    return valid, invalid


def _auto_link(text: str) -> str:
    """Escape HTML, convert URLs to <a> links, preserve newlines/paragraphs."""
    escaped = _html_lib.escape(text or "")
    # Don't include common sentence-ending punctuation in the linked URL —
    # e.g. `visit https://blackrodnow.com.` should link "https://blackrodnow.com"
    # and leave the trailing period as prose.
    url_re = _re.compile(r"(https?://[^\s<]+?)([.,;:!?)\]]*)(?=\s|$|<)")
    linked = url_re.sub(r'<a href="\1" style="color:#0052FF">\1</a>\2', escaped)
    # split into paragraphs on blank line, single newlines become <br>
    paragraphs = [p.strip() for p in _re.split(r"\n\s*\n", linked) if p.strip()]
    return "\n".join(f"<p>{p.replace(chr(10), '<br />')}</p>" for p in paragraphs) or "<p></p>"


def _render_admin_email_html(subject: str, body_text: str, from_email: str) -> str:
    body_html = _auto_link(body_text)
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#F9FAFB;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111827">
<table role="presentation" cellspacing="0" cellpadding="0" width="100%" bgcolor="#F9FAFB">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" width="600" style="max-width:600px;padding:32px 24px">
  <tr><td style="padding-bottom:16px">
    <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#0052FF;font-weight:800">Blackrod Now</div>
    <h1 style="font-size:24px;line-height:1.25;color:#111827;margin:8px 0 0 0">{_html_lib.escape(subject)}</h1>
  </td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#111827;padding-bottom:24px">
    {body_html}
  </td></tr>
  <tr><td style="border-top:1px solid #E5E7EB;padding-top:16px;color:#9CA3AF;font-size:12px">
    Sent by Blackrod Now via <a href="mailto:{_html_lib.escape(from_email)}" style="color:#9CA3AF">{_html_lib.escape(from_email)}</a>. This is a one-off message from the Blackrod Now admin team.
  </td></tr>
</table>
</td></tr>
</table>
</body></html>"""


@api.get("/admin/email/senders")
async def admin_email_senders():
    """Return the whitelisted sender addresses for the admin compose UI."""
    return {"senders": ADMIN_SENDER_EMAILS, "default": SENDER_EMAIL}


@api.post("/admin/email/preview")
async def admin_email_preview(request: Request):
    req, attachments = await _read_admin_email_request(request)
    from_addr = (req.from_email or SENDER_EMAIL).strip().lower()
    if from_addr not in [s.lower() for s in ADMIN_SENDER_EMAILS]:
        raise HTTPException(400, f"Sender must be one of: {', '.join(ADMIN_SENDER_EMAILS)}")
    valid, invalid = _parse_recipients(req.to)
    html = _render_admin_email_html(req.subject, req.body, from_addr)
    return {
        "html": html,
        "subject": req.subject,
        "from": f'"{req.from_name or SENDER_NAME}" <{from_addr}>',
        "recipients": valid,
        "invalid_recipients": invalid,
        "count": len(valid),
        "attachments": [{"filename": a["filename"], "content_type": a["content_type"], "size": a["size"]} for a in attachments],
        "attachment_count": len(attachments),
    }


@api.post("/admin/email/send")
async def admin_email_send(request: Request):
    req, attachments = await _read_admin_email_request(request)
    from_addr = (req.from_email or SENDER_EMAIL).strip().lower()
    if from_addr not in [s.lower() for s in ADMIN_SENDER_EMAILS]:
        raise HTTPException(400, f"Sender must be one of: {', '.join(ADMIN_SENDER_EMAILS)}")
    valid, invalid = _parse_recipients(req.to)
    if not valid:
        raise HTTPException(400, "No valid recipients")
    if not req.subject.strip():
        raise HTTPException(400, "Subject is required")
    if not req.body.strip():
        raise HTTPException(400, "Body is required")

    html = _render_admin_email_html(req.subject, req.body, from_addr)
    sent, failed, results = 0, 0, []
    for addr in valid:
        r = await asyncio.to_thread(
            resend_send, addr, req.subject, html, from_addr, req.from_name or SENDER_NAME, None, attachments
        )
        if r.get("ok"):
            sent += 1
        else:
            failed += 1
        results.append({"to": addr, **{k: r.get(k) for k in ("ok", "id", "error", "mocked", "attachments")}})
    await _record_analytics_event("admin_email_send", entity_type="site", count=sent)
    return {
        "ok": failed == 0,
        "sent": sent,
        "failed": failed,
        "invalid_recipients": invalid,
        "results": results,
        "mocked": not RESEND_API_KEY,
        "attachments": [{"filename": a["filename"], "content_type": a["content_type"], "size": a["size"]} for a in attachments],
    }


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
        await db.org_passwords.create_index("slug", unique=True)
        await db.notifications.create_index([("org_slug", 1), ("created_at", -1)])
        await db.follows.create_index("device_id", unique=True)
        await db.analytics_events.create_index([("created_at", -1)])
        await db.analytics_events.create_index([("kind", 1), ("created_at", -1)])
        await db.analytics_events.create_index([("org_slug", 1), ("created_at", -1)])
        await db.analytics_events.create_index([("entity_id", 1), ("created_at", -1)])
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
