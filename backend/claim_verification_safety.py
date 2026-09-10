"""Make organisation-claim verification email links safe to preview.

Email security scanners commonly prefetch links. The original claim-confirmation
endpoint changed state on GET, so a link scanner could theoretically approve or
reject a claim without a human clicking a confirmation button. This installer
replaces that GET handler with a read-only confirmation page and performs the
existing decision only after an explicit POST from that page.
"""
from __future__ import annotations

import hashlib
import hmac
import html
from datetime import datetime, timezone

from fastapi import HTTPException, Request, Response

_INSTALLED = False


def _claim_token_hash(token: str, secret: str) -> str:
    return hmac.new(
        str(secret or "blackrod-now").encode("utf-8"),
        str(token or "").encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


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


def _html_response(body: str, status_code: int = 200) -> Response:
    return Response(
        content=body,
        media_type="text/html",
        status_code=status_code,
        headers={
            "Cache-Control": "no-store, max-age=0",
            "Pragma": "no-cache",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
            "Referrer-Policy": "no-referrer",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        },
    )


def _page(*, heading: str, message: str, action_url: str = "", button: str = "", danger: bool = False) -> str:
    action = ""
    if action_url and button:
        background = "#b91c1c" if danger else "#0052ff"
        action = (
            f"<form method='post' action='{html.escape(action_url, quote=True)}' style='margin-top:24px'>"
            "<input type='hidden' name='confirmed' value='yes'>"
            f"<button type='submit' style='border:0;border-radius:999px;padding:12px 18px;background:{background};color:white;font-weight:700;cursor:pointer'>"
            f"{html.escape(button)}</button></form>"
        )
    return (
        "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<title>{html.escape(heading)} · Blackrod Now</title></head>"
        "<body style='font-family:Arial,sans-serif;background:#f8fafc;color:#111827;margin:0;padding:32px'>"
        "<main style='max-width:680px;margin:40px auto;background:white;border:1px solid #e5e7eb;border-radius:20px;padding:28px'>"
        "<div style='font-size:13px;font-weight:800;color:#0052ff;text-transform:uppercase;letter-spacing:.08em'>Blackrod Now</div>"
        f"<h1 style='margin:10px 0 12px'>{html.escape(heading)}</h1>"
        f"<p style='line-height:1.6'>{html.escape(message)}</p>{action}"
        "</main></body></html>"
    )


def install_claim_verification_safety(*, api, db, admin_code: str) -> None:
    global _INSTALLED
    if _INSTALLED:
        return

    path = "/claim-verifications/{token}/{decision}"
    original_decision = _find_route_endpoint(api, path, "GET")
    if original_decision is None:
        # Leave the installer retryable if bootstrap order changes or a test
        # creates the router in stages.
        return

    _remove_route(api, path, "GET")
    _INSTALLED = True

    @api.get(path)
    async def claim_verification_confirmation(token: str, decision: str, request: Request):
        clean_decision = str(decision or "").strip().lower()
        if clean_decision not in {"approve", "reject"}:
            raise HTTPException(404, "Invalid claim confirmation link")

        token_hash = _claim_token_hash(token, admin_code)
        check = await db.org_claim_relationship_checks.find_one(
            {"token_hash": token_hash},
            {"_id": 0},
        )
        if not check:
            return _html_response(
                _page(
                    heading="Link not recognised",
                    message="This confirmation link is invalid or has been replaced. Please contact Blackrod Now if you still need to respond.",
                ),
                404,
            )

        status = str(check.get("status") or "")
        if status != "pending":
            wording = {
                "approved": "This organisation claim has already been confirmed as authorised.",
                "rejected": "This organisation claim has already been rejected.",
                "expired": "This confirmation link has expired. Please ask Blackrod Now to send a fresh request.",
                "superseded": "This confirmation link has been replaced by a newer request.",
            }.get(status, "This confirmation link is no longer active.")
            return _html_response(_page(heading="Response already recorded", message=wording))

        try:
            expiry = datetime.fromisoformat(str(check.get("expires_at") or "").replace("Z", "+00:00"))
        except Exception:
            expiry = datetime.now(timezone.utc)
        if expiry <= datetime.now(timezone.utc):
            return _html_response(
                _page(
                    heading="Link expired",
                    message="This confirmation link has expired. Please ask Blackrod Now to send a fresh organisation confirmation request.",
                ),
                410,
            )

        org_name = str(check.get("org_name") or "the organisation")
        claimant_name = str(check.get("claimant_name") or "the claimant")
        claimant_email = str(check.get("claimant_email") or "")
        claimant = f"{claimant_name} ({claimant_email})" if claimant_email else claimant_name
        base_message = f"{claimant} has asked for permission to manage {org_name} on Blackrod Now."

        if clean_decision == "approve":
            heading = "Confirm authorised representative"
            message = base_message + " Please confirm only if you know that this person is authorised to represent the organisation."
            button = "Yes — confirm authorisation"
            danger = False
        else:
            heading = "Reject organisation claim"
            message = base_message + " Confirm below if this person should not be given management access."
            button = "Reject this claim"
            danger = True

        # Use a same-origin path rather than reconstructing the public host from
        # proxy headers. This is reliable behind the production reverse proxy.
        action_url = str(request.url.path)
        return _html_response(
            _page(
                heading=heading,
                message=message,
                action_url=action_url,
                button=button,
                danger=danger,
            )
        )

    @api.post(path)
    async def claim_verification_decision(token: str, decision: str, request: Request):
        clean_decision = str(decision or "").strip().lower()
        if clean_decision not in {"approve", "reject"}:
            raise HTTPException(404, "Invalid claim confirmation link")

        # Require the form marker as an additional guard against generic POST
        # probes. Normal browsers submit this field from the confirmation page.
        try:
            form = await request.form()
            confirmed = str(form.get("confirmed") or "").strip().lower()
        except Exception:
            confirmed = ""
        if confirmed != "yes":
            raise HTTPException(400, "Confirmation is required")

        return await original_decision(token, clean_decision)
