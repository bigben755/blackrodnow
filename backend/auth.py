"""JWT + bcrypt auth for Blackrod Now.

Supported roles:
- `admin`                 — site super-admin.
- `org`                   — shared organisation account, scoped by `org_slug`.
- `org_member`            — named organisation member, scoped by `org_slug`.
- `admin_impersonation`   — admin assistance session, scoped to one `org_slug`.

Tokens are Bearer JWTs. Admin JWTs are normally sent in `Authorization`.
Organisation-scoped JWTs are normally sent in `X-Org-Auth`.
Legacy `X-Admin-Code` support remains in the main backend during migration.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import bcrypt
import jwt
from fastapi import HTTPException, Request

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 12  # 12 hours


def _secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        # Development fallback only. Production should always set JWT_SECRET.
        secret = os.environ.get(
            "ADMIN_LAUNCH_CODE",
            "dev-only-secret-please-set-jwt-secret",
        )
    return secret


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(
    *,
    sub: str,
    role: str,
    extra: Optional[Dict[str, Any]] = None,
    minutes: int = ACCESS_TOKEN_MINUTES,
) -> str:
    now = datetime.now(timezone.utc)

    payload: Dict[str, Any] = {
        "sub": sub,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(
            (
                now
                + timedelta(minutes=minutes)
            ).timestamp()
        ),
    }

    if extra:
        payload.update(extra)

    return jwt.encode(
        payload,
        _secret(),
        algorithm=JWT_ALGORITHM,
    )


def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(
            token,
            _secret(),
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
        )


def _bearer(
    request: Request,
    authorization: Optional[str],
) -> Optional[str]:
    if (
        authorization
        and authorization.lower().startswith(
            "bearer "
        )
    ):
        return authorization[7:].strip()

    # Retained for endpoints that intentionally return direct downloadable URLs,
    # such as authenticated admin PDF links.
    token = None

    if request:
        token = (
            request.query_params.get(
                "access_token"
            )
            or request.query_params.get(
                "token"
            )
        )

    return token or None


def read_admin_from_request(
    request: Request,
    authorization: Optional[str],
) -> Optional[Dict[str, Any]]:
    """Return a valid site-admin JWT payload, otherwise None."""
    token = _bearer(
        request,
        authorization,
    )

    if not token:
        return None

    try:
        payload = decode_token(token)
    except HTTPException:
        return None

    if payload.get("role") != "admin":
        return None

    return payload


def read_org_from_request(
    request: Request,
    authorization: Optional[str],
    expected_org_slug: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Return a valid organisation-capable payload, otherwise None.

    `expected_org_slug` can be supplied by a route that needs to enforce
    organisation isolation. Site-admin tokens are not slug-restricted.
    Admin-assistance tokens are restricted to their encoded organisation.
    """
    token = _bearer(
        request,
        authorization,
    )

    if not token:
        return None

    try:
        payload = decode_token(token)
    except HTTPException:
        return None

    role = str(
        payload.get("role") or ""
    )

    if role not in {
        "org",
        "org_member",
        "admin",
        "admin_impersonation",
    }:
        return None

    if role in {
        "org",
        "org_member",
        "admin_impersonation",
    }:
        if (
            str(
                payload.get(
                    "member_status"
                )
                or "active"
            )
            != "active"
        ):
            return None

        if (
            expected_org_slug
            and str(
                payload.get(
                    "org_slug"
                )
                or ""
            )
            != str(
                expected_org_slug
            )
        ):
            return None

    return payload