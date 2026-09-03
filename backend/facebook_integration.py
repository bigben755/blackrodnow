"""Server-side Facebook Page publishing for Blackrod Now events.

The Page access token is read only from environment variables. It is never
returned by an API endpoint or logged. The integration adds admin endpoints
and a lightweight watcher that publishes newly-approved events without
back-filling every historical event on deployment.
"""
from __future__ import annotations

import asyncio
import hmac
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo
from urllib.parse import urljoin, urlparse

import requests
from fastapi import HTTPException, Request
from pymongo import ReturnDocument

logger = logging.getLogger("blackrodnow.facebook")
LONDON = ZoneInfo("Europe/London")


def _env_true(name: str, default: str = "true") -> bool:
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_event_date(value: Any):
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except Exception:
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").date()
        except Exception:
            return None


def _is_current_event(event: Dict[str, Any]) -> bool:
    """True when an approved event is still current/upcoming in Blackrod."""
    if str(event.get("status") or "") != "approved":
        return False

    today = datetime.now(LONDON).date()
    candidates = [event.get("end"), event.get("start")]
    recurrence = event.get("recurrence") or {}
    if isinstance(recurrence, dict) and recurrence.get("until"):
        candidates.insert(0, recurrence.get("until"))

    dates = [d for d in (_parse_event_date(v) for v in candidates) if d is not None]
    return bool(dates) and max(dates) >= today


def _format_when(value: Any) -> tuple[str, str]:
    text = str(value or "").strip()
    if not text:
        return "", ""
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=LONDON)
        else:
            dt = dt.astimezone(LONDON)
        date_text = dt.strftime("%A %-d %B %Y")
        # Midnight is often how date-only events are stored; don't invent a time.
        time_text = "" if (dt.hour == 0 and dt.minute == 0) else dt.strftime("%-I:%M%p").lower()
        return date_text, time_text
    except Exception:
        d = _parse_event_date(text)
        return (d.strftime("%A %-d %B %Y") if d else text[:10], "")


def _event_url(public_url: str, event: Dict[str, Any]) -> str:
    return f"{public_url.rstrip('/')}/events/{event.get('id')}"


# Images that Blackrod Now uses automatically when an event has no genuine
# uploaded/custom artwork. These should not be treated as the event's own image
# for Facebook publishing.
_AUTOMATIC_EVENT_IMAGES = {
    "/familyevent.png",
    "/youth.png",
    "/sport.png",
    "/school.png",
    "/charity.png",
    "/business.png",
    "/communityevent.png",
    "/foodanddrink.png",
    "/music.png",
    "/volunteering.png",
    "/faith.png",
    "/heritage.png",
    "/healthandwellbeing.png",
}

_LEGACY_EVENT_IMAGE_PREFIX = (
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3"
)


def _event_preview_url(public_url: str, event: Dict[str, Any]) -> str:
    # Retained for compatibility/diagnostics.
    # Facebook publishing below now uses a real photo post rather than relying
    # on a scraped link preview.
    return f"{public_url.rstrip('/')}/api/events/{event.get('id')}/og"


def _event_poster_url(public_url: str, event: Dict[str, Any]) -> str:
    return f"{public_url.rstrip('/')}/api/events/{event.get('id')}/poster.png"


def _is_genuine_event_image(value: Any) -> bool:
    image = str(value or "").strip()

    if not image:
        return False

    if image in _AUTOMATIC_EVENT_IMAGES:
        return False

    if image.startswith(_LEGACY_EVENT_IMAGE_PREFIX):
        return False

    if image.lower().startswith(("data:", "blob:", "javascript:")):
        return False

    return True


def _absolute_public_image_url(public_url: str, value: Any) -> str:
    """Turn an event image value into a public URL Meta can fetch."""
    image = str(value or "").strip()

    if not image:
        return ""

    if image.startswith("//"):
        return f"https:{image}"

    parsed = urlparse(image)

    if parsed.scheme in {"http", "https"}:
        return image

    # Event uploads and local image paths are commonly stored as /path/to/image.
    # Resolve them against the live Blackrod Now public origin.
    return urljoin(
        f"{public_url.rstrip('/')}/",
        image.lstrip("/"),
    )


def _facebook_image_for_event(
    public_url: str,
    event: Dict[str, Any],
) -> tuple[str, str]:
    """Return (image_url, source) for a Facebook photo post.

    Genuine event artwork wins. If an event only has a category/default image,
    use the generated Blackrod Now event poster as the fallback.
    """
    raw_image = event.get("image")

    if _is_genuine_event_image(raw_image):
        image_url = _absolute_public_image_url(public_url, raw_image)

        if image_url:
            return image_url, "event"

    return _event_poster_url(public_url, event), "poster"


def _caption(event: Dict[str, Any], public_url: str) -> str:
    date_text, time_text = _format_when(event.get("start"))

    venue = str(event.get("venue") or "").strip()
    address = str(event.get("address") or "").strip()

    description = " ".join(
        str(event.get("description") or "").split()
    )

    if len(description) > 420:
        description = description[:417].rstrip() + "..."

    lines = [
        f"🎉 {str(event.get('title') or 'Blackrod event').strip()}"
    ]

    if date_text:
        lines.extend(
            [
                "",
                f"📅 {date_text}",
            ]
        )

    if time_text:
        lines.append(f"⏰ {time_text}")

    if venue:
        lines.append(f"📍 {venue}")
    elif address:
        lines.append(f"📍 {address}")

    if description:
        lines.extend(
            [
                "",
                description,
            ]
        )

    lines.extend(
        [
            "",
            f"👉 Full details: {_event_url(public_url, event)}",
            "",
            "What's New. What's On. What's Next.",
            "",
            "#BlackrodNow #WhatsOnBlackrod",
        ]
    )

    return "\n".join(lines)


def _post_url(post_id: str) -> str:
    first, sep, second = str(post_id or "").partition("_")

    if sep and first and second:
        return f"https://www.facebook.com/{first}/posts/{second}"

    return f"https://www.facebook.com/{post_id}" if post_id else ""


def _safe_meta_error(response: requests.Response) -> str:
    try:
        payload = response.json()

        err = payload.get("error") or {}

        message = str(
            err.get("message") or "Facebook rejected the request"
        ).strip()

        code = err.get("code")

        return (
            f"{message} (Meta code {code})"
            if code is not None
            else message
        )

    except Exception:
        return (
            f"Facebook request failed with HTTP "
            f"{response.status_code}"
        )


def install_facebook_integration(
    *,
    app,
    api,
    db,
    public_url: str,
    admin_code: str,
) -> None:
    """Attach Facebook publishing admin routes and automatic approval watcher."""

    page_id = os.environ.get(
        "FACEBOOK_PAGE_ID",
        "1340129215839919",
    ).strip()

    access_token = os.environ.get(
        "FACEBOOK_PAGE_ACCESS_TOKEN",
        "",
    ).strip()

    graph_version = (
        os.environ.get(
            "FACEBOOK_GRAPH_API_VERSION",
            "v26.0",
        ).strip()
        or "v26.0"
    )

    auto_enabled = _env_true(
        "FACEBOOK_AUTO_PUBLISH_ENABLED",
        "true",
    )

    poll_seconds = max(
        10,
        int(
            os.environ.get(
                "FACEBOOK_AUTO_PUBLISH_POLL_SECONDS",
                "20",
            )
        ),
    )

    state: Dict[str, Any] = {
        "known_statuses": {},
        "task": None,
        "baseline_ready": False,
    }

    def require_admin(request: Request) -> None:
        supplied_code = str(
            request.headers.get("X-Admin-Code") or ""
        ).strip()

        if (
            supplied_code
            and hmac.compare_digest(
                supplied_code,
                admin_code,
            )
        ):
            return

        authorization = str(
            request.headers.get("Authorization") or ""
        ).strip()

        if authorization.lower().startswith("bearer "):
            try:
                from auth import decode_token

                payload = decode_token(
                    authorization[7:].strip()
                )

                if str(payload.get("role") or "") == "admin":
                    return

            except Exception:
                pass

        raise HTTPException(
            401,
            "Admin authentication required",
        )

    async def eligible_events() -> list[Dict[str, Any]]:
        docs = await db.events.find(
            {
                "status": "approved",
            },
            {
                "_id": 0,
            },
        ).to_list(length=None)

        rows = []

        for event in docs:
            if not _is_current_event(event):
                continue

            if event.get("facebook_post_id"):
                continue

            if (
                str(
                    event.get("facebook_post_status") or ""
                )
                == "publishing"
            ):
                continue

            rows.append(event)

        rows.sort(
            key=lambda e: str(e.get("start") or "")
        )

        return rows

    async def publish_event(
        event_id: str,
        *,
        source: str,
        caption_override: Optional[str] = None,
    ) -> Dict[str, Any]:

        if not access_token:
            return {
                "ok": False,
                "event_id": event_id,
                "status": "not_configured",
                "error": (
                    "FACEBOOK_PAGE_ACCESS_TOKEN is not "
                    "configured on the backend"
                ),
            }

        if not page_id:
            return {
                "ok": False,
                "event_id": event_id,
                "status": "not_configured",
                "error": (
                    "FACEBOOK_PAGE_ID is not "
                    "configured on the backend"
                ),
            }

        lock_query = {
            "id": event_id,
            "status": "approved",
            "$and": [
                {
                    "$or": [
                        {
                            "facebook_post_id": {
                                "$exists": False
                            }
                        },
                        {
                            "facebook_post_id": None
                        },
                        {
                            "facebook_post_id": ""
                        },
                    ]
                },
                {
                    "facebook_post_status": {
                        "$ne": "publishing"
                    }
                },
            ],
        }

        event = await db.events.find_one_and_update(
            lock_query,
            {
                "$set": {
                    "facebook_post_status": "publishing",
                    "facebook_publish_started_at": _now_iso(),
                    "facebook_post_error": None,
                }
            },
            return_document=ReturnDocument.AFTER,
        )

        if not event:
            current = await db.events.find_one(
                {
                    "id": event_id,
                },
                {
                    "_id": 0,
                },
            )

            if not current:
                return {
                    "ok": False,
                    "event_id": event_id,
                    "status": "not_found",
                    "error": "Event not found",
                }

            if current.get("facebook_post_id"):
                return {
                    "ok": True,
                    "event_id": event_id,
                    "status": "already_posted",
                    "post_id": current.get(
                        "facebook_post_id"
                    ),
                    "post_url": (
                        current.get("facebook_post_url")
                        or _post_url(
                            current.get(
                                "facebook_post_id"
                            )
                        )
                    ),
                }

            return {
                "ok": False,
                "event_id": event_id,
                "status": "not_publishable",
                "error": (
                    "Event is not approved or is "
                    "already being published"
                ),
            }

        event.pop("_id", None)

        if not _is_current_event(event):
            await db.events.update_one(
                {
                    "id": event_id,
                },
                {
                    "$set": {
                        "facebook_post_status":
                            "not_posted"
                    },
                    "$unset": {
                        "facebook_publish_started_at": ""
                    },
                },
            )

            return {
                "ok": False,
                "event_id": event_id,
                "status": "past_event",
                "error": (
                    "Past events are not "
                    "published to Facebook"
                ),
            }

        message = (
            str(caption_override or "").strip()
            or _caption(
                event,
                public_url,
            )
        )

        photo_endpoint = (
            f"https://graph.facebook.com/"
            f"{graph_version}/{page_id}/photos"
        )

        image_url, image_source = (
            _facebook_image_for_event(
                public_url,
                event,
            )
        )

        async def post_photo(url: str):
            return await asyncio.to_thread(
                requests.post,
                photo_endpoint,
                headers={
                    "Authorization": (
                        f"Bearer {access_token}"
                    )
                },
                data={
                    "url": url,
                    "caption": message,
                    "published": "true",
                },
                timeout=45,
            )

        try:
            response = await post_photo(
                image_url
            )

            # If Meta cannot fetch the genuine event
            # artwork — for example because a third-party
            # host blocks Facebook — retry once using
            # Blackrod Now's own generated poster.
            if (
                not response.ok
                and image_source == "event"
            ):
                first_error = _safe_meta_error(
                    response
                )

                fallback_url = _event_poster_url(
                    public_url,
                    event,
                )

                logger.warning(
                    (
                        "Facebook event image failed "
                        "event_id=%s image=%s; "
                        "retrying poster: %s"
                    ),
                    event_id,
                    image_url,
                    first_error,
                )

                response = await post_photo(
                    fallback_url
                )

                if response.ok:
                    image_url = fallback_url
                    image_source = "poster_fallback"

            if not response.ok:
                raise RuntimeError(
                    _safe_meta_error(response)
                )

            payload = response.json()

            # Published Page-photo responses may
            # provide both the Facebook photo id and
            # the corresponding timeline post id.
            # Prefer the timeline post id for our link.
            photo_id = str(
                payload.get("id") or ""
            ).strip()

            post_id = str(
                payload.get("post_id")
                or photo_id
            ).strip()

            if not post_id:
                raise RuntimeError(
                    "Facebook did not return a post ID"
                )

            posted_at = _now_iso()
            post_url = _post_url(post_id)

            await db.events.update_one(
                {
                    "id": event_id,
                },
                {
                    "$set": {
                        "facebook_post_id":
                            post_id,
                        "facebook_photo_id":
                            photo_id or None,
                        "facebook_post_url":
                            post_url,
                        "facebook_posted_at":
                            posted_at,
                        "facebook_post_status":
                            "posted",
                        "facebook_post_source":
                            source,
                        "facebook_image_url":
                            image_url,
                        "facebook_image_source":
                            image_source,
                        "facebook_last_caption":
                            message,
                        "facebook_post_error":
                            None,
                    },
                    "$unset": {
                        "facebook_publish_started_at": ""
                    },
                },
            )

            logger.info(
                (
                    "Facebook event published "
                    "event_id=%s source=%s "
                    "image_source=%s"
                ),
                event_id,
                source,
                image_source,
            )

            return {
                "ok": True,
                "event_id": event_id,
                "status": "posted",
                "post_id": post_id,
                "photo_id": photo_id or None,
                "post_url": post_url,
                "posted_at": posted_at,
                "image_url": image_url,
                "image_source": image_source,
            }

        except Exception as exc:
            error_text = str(exc)[:700]

            await db.events.update_one(
                {
                    "id": event_id,
                },
                {
                    "$set": {
                        "facebook_post_status":
                            "error",
                        "facebook_post_error":
                            error_text,
                        "facebook_last_attempt_at":
                            _now_iso(),
                    },
                    "$unset": {
                        "facebook_publish_started_at": ""
                    },
                },
            )

            logger.warning(
                (
                    "Facebook publish failed "
                    "event_id=%s: %s"
                ),
                event_id,
                error_text,
            )

            return {
                "ok": False,
                "event_id": event_id,
                "status": "error",
                "error": error_text,
            }

    async def poll_for_newly_approved_events() -> None:
        while True:
            try:
                docs = await db.events.find(
                    {},
                    {
                        "_id": 0,
                        "id": 1,
                        "status": 1,
                        "start": 1,
                        "end": 1,
                        "recurrence": 1,
                        "facebook_post_id": 1,
                    },
                ).to_list(length=None)

                current_statuses = {
                    str(d.get("id")): str(
                        d.get("status") or ""
                    )
                    for d in docs
                    if d.get("id")
                }

                if not state["baseline_ready"]:
                    # Deliberately baseline existing
                    # records: current historical events
                    # are published only when an admin
                    # selects them in the bulk panel.
                    state["known_statuses"] = (
                        current_statuses
                    )

                    state["baseline_ready"] = True

                elif auto_enabled and access_token:
                    to_publish = []

                    for doc in docs:
                        event_id = str(
                            doc.get("id") or ""
                        )

                        if (
                            not event_id
                            or doc.get(
                                "facebook_post_id"
                            )
                        ):
                            continue

                        previous = state[
                            "known_statuses"
                        ].get(event_id)

                        current = str(
                            doc.get("status") or ""
                        )

                        is_new = (
                            event_id
                            not in state[
                                "known_statuses"
                            ]
                        )

                        became_approved = (
                            previous
                            not in {
                                None,
                                "approved",
                            }
                            and current == "approved"
                        )

                        if (
                            current == "approved"
                            and (
                                is_new
                                or became_approved
                            )
                            and _is_current_event(doc)
                        ):
                            to_publish.append(
                                event_id
                            )

                    state["known_statuses"] = (
                        current_statuses
                    )

                    for event_id in to_publish:
                        await publish_event(
                            event_id,
                            source="auto",
                        )

                else:
                    state["known_statuses"] = (
                        current_statuses
                    )

            except asyncio.CancelledError:
                raise

            except Exception as exc:
                logger.warning(
                    (
                        "Facebook approval watcher "
                        "error: %s"
                    ),
                    str(exc)[:500],
                )

            await asyncio.sleep(
                poll_seconds
            )

    @api.get("/admin/facebook/status")
    async def facebook_status(request: Request):
        require_admin(request)

        eligible_count = len(
            await eligible_events()
        )

        posted_count = (
            await db.events.count_documents(
                {
                    "facebook_post_id": {
                        "$exists": True,
                        "$nin": [
                            None,
                            "",
                        ],
                    }
                }
            )
        )

        error_count = (
            await db.events.count_documents(
                {
                    "facebook_post_status":
                        "error"
                }
            )
        )

        return {
            "configured": bool(
                page_id
                and access_token
            ),
            "page_id": page_id,
            "graph_version":
                graph_version,
            "auto_publish_enabled":
                auto_enabled,
            "poll_seconds":
                poll_seconds,
            "eligible_count":
                eligible_count,
            "posted_count":
                posted_count,
            "error_count":
                error_count,
        }

    @api.get("/admin/facebook/events")
    async def facebook_events(request: Request):
        require_admin(request)

        eligible = await eligible_events()

        posted = (
            await db.events.find(
                {
                    "facebook_post_id": {
                        "$exists": True,
                        "$nin": [
                            None,
                            "",
                        ],
                    }
                },
                {
                    "_id": 0,
                    "id": 1,
                    "title": 1,
                    "start": 1,
                    "venue": 1,
                    "facebook_post_id": 1,
                    "facebook_post_url": 1,
                    "facebook_posted_at": 1,
                    "facebook_post_status": 1,
                    "facebook_post_source": 1,
                    "facebook_photo_id": 1,
                    "facebook_image_url": 1,
                    "facebook_image_source": 1,
                },
            )
            .sort(
                "facebook_posted_at",
                -1,
            )
            .to_list(length=25)
        )

        def row(
            event: Dict[str, Any]
        ) -> Dict[str, Any]:
            return {
                "id": event.get("id"),
                "title": event.get("title"),
                "start": event.get("start"),
                "venue": event.get("venue"),
                "facebook_post_status": (
                    event.get(
                        "facebook_post_status"
                    )
                    or "not_posted"
                ),
                "facebook_post_error":
                    event.get(
                        "facebook_post_error"
                    ),
                "facebook_preview":
                    _caption(
                        event,
                        public_url,
                    ),
            }

        return {
            "eligible": [
                row(event)
                for event in eligible
            ],
            "posted": posted,
        }

    @api.post(
        "/admin/facebook/events/{event_id}/publish"
    )
    async def facebook_publish_one(
        event_id: str,
        request: Request,
    ):
        require_admin(request)

        payload: Dict[str, Any] = {}

        try:
            payload = await request.json()
        except Exception:
            payload = {}

        return await publish_event(
            event_id,
            source="manual",
            caption_override=(
                str(
                    payload.get("caption") or ""
                ).strip()
                or None
            ),
        )

    @api.post(
        "/admin/facebook/publish-current"
    )
    async def facebook_publish_current(
        request: Request,
    ):
        require_admin(request)

        try:
            payload = await request.json()
        except Exception:
            payload = {}

        event_ids = [
            str(v).strip()
            for v in (
                payload.get("event_ids")
                or []
            )
            if str(v).strip()
        ]

        if not event_ids:
            raise HTTPException(
                400,
                "Select at least one event to publish",
            )

        if len(event_ids) > 50:
            raise HTTPException(
                400,
                (
                    "A maximum of 50 events "
                    "can be published at once"
                ),
            )

        eligible_by_id = {
            str(e.get("id")): e
            for e in await eligible_events()
        }

        results = []

        for event_id in event_ids:
            if event_id not in eligible_by_id:
                results.append(
                    {
                        "ok": False,
                        "event_id": event_id,
                        "status": "not_eligible",
                        "error": (
                            "Event is not eligible"
                        ),
                    }
                )

                continue

            results.append(
                await publish_event(
                    event_id,
                    source="bulk",
                )
            )

            await asyncio.sleep(0.25)

        return {
            "ok": all(
                item.get("ok")
                for item in results
            ),
            "published": sum(
                1
                for item in results
                if (
                    item.get("ok")
                    and item.get("status")
                    == "posted"
                )
            ),
            "results": results,
        }

    @app.on_event("startup")
    async def _facebook_integration_startup():
        if (
            state["task"] is None
            or state["task"].done()
        ):
            state["task"] = (
                asyncio.create_task(
                    poll_for_newly_approved_events()
                )
            )

        logger.info(
            (
                "Facebook publishing integration "
                "ready configured=%s auto=%s "
                "page_id=%s"
            ),
            bool(
                page_id
                and access_token
            ),
            auto_enabled,
            page_id,
        )

    @app.on_event("shutdown")
    async def _facebook_integration_shutdown():
        task = state.get("task")

        if task and not task.done():
            task.cancel()

            try:
                await task
            except asyncio.CancelledError:
                pass