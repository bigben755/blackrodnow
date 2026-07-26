"""JWT + bcrypt auth for Blackrod Now.

Two roles today:
- `admin`  — single site super-admin (seeded from ADMIN_EMAIL/ADMIN_PASSWORD env)
- `org`    — organisation account (email/password per org, keyed by orgSlug)

Tokens are Bearer JWTs sent in `Authorization: Bearer <jwt>`.
Legacy `X-Admin-Code` header remains supported alongside for graceful rollover
so we don't break the existing role-switcher UI on the first deploy.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import bcrypt
import jwt
from fastapi import HTTPException, Header, Request

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 12  # 12 hours (community site, not high-security)


def _secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        # Fall back to the admin launch code so the app still boots in dev; log a warning.
        secret = os.environ.get("ADMIN_LAUNCH_CODE", "dev-only-secret-please-set-jwt-secret")
    return secret


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(*, sub: str, role: str, extra: Optional[Dict[str, Any]] = None, minutes: int = ACCESS_TOKEN_MINUTES) -> str:
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": sub,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _bearer(request: Request, authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    # Also allow via ?token= query (useful for calendar-style URLs, not used yet).
    tok = request.query_params.get("access_token") if request else None
    return tok or None


def read_admin_from_request(
    request: Request,
    authorization: Optional[str],
) -> Optional[Dict[str, Any]]:
    """Return decoded admin JWT payload if present + valid, else None (not raising)."""
    token = _bearer(request, authorization)
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
) -> Optional[Dict[str, Any]]:
    token = _bearer(request, authorization)
    if not token:
        return None
    try:
        payload = decode_token(token)
    except HTTPException:
        return None
    if payload.get("role") not in ("org", "admin"):
        return None
    return payload
