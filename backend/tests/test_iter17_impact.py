"""Iteration 17 — Funder Impact Dashboard backend tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend/.env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

ADMIN_EMAIL = "admin@blackrodnow.co.uk"
ADMIN_PASSWORD = "BlackrodAdmin!2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Impact summary ---------------------------------------------------------

def test_impact_summary_unauth_403():
    r = requests.get(f"{BASE_URL}/api/admin/impact/summary?days=90", timeout=15)
    assert r.status_code == 403


def test_impact_summary_ok_shape(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/impact/summary?days=90", headers=admin_headers, timeout=20)
    assert r.status_code == 200
    data = r.json()
    for k in ("window_days", "generated_at", "grant", "headline", "reach", "geography", "top_orgs"):
        assert k in data, f"missing key: {k}"
    for k in ("unique_residents", "orgs_live", "events_live", "volunteer_conversions", "cost_per_resident"):
        assert k in data["headline"], f"headline missing: {k}"
    assert data["window_days"] == 90
    assert isinstance(data["geography"], list)
    assert isinstance(data["top_orgs"], list)


def test_grant_zero_cost_per_resident_zero(admin_headers):
    # set grant to 0
    r = requests.post(
        f"{BASE_URL}/api/admin/impact/grant-config",
        json={"grant_amount": 0, "grant_period_label": "reset"},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200
    assert float(r.json()["grant_amount"]) == 0.0

    s = requests.get(f"{BASE_URL}/api/admin/impact/summary?days=90", headers=admin_headers, timeout=20)
    assert s.status_code == 200
    assert s.json()["headline"]["cost_per_resident"] == 0


def test_grant_config_updates_cost_per_resident(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/admin/impact/grant-config",
        json={"grant_amount": 15000, "grant_period_label": "annual 2026"},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert float(body["grant_amount"]) == 15000.0
    assert body["grant_period_label"] == "annual 2026"

    s = requests.get(f"{BASE_URL}/api/admin/impact/summary?days=90", headers=admin_headers, timeout=20)
    assert s.status_code == 200
    data = s.json()
    ur = data["headline"]["unique_residents"]
    if ur > 0:
        expected = round(15000.0 / ur, 2)
        assert data["headline"]["cost_per_resident"] == expected


# --- Volunteer contact analytics --------------------------------------------

def test_volunteer_contact_analytics_increments(admin_headers):
    # baseline
    b = requests.get(f"{BASE_URL}/api/admin/impact/summary?days=90", headers=admin_headers, timeout=20).json()
    base_conv = b["headline"]["volunteer_conversions"]
    base_clicks = b["reach"]["volunteer_clicks"]

    # find a real org slug
    orgs = requests.get(f"{BASE_URL}/api/orgs", timeout=15).json()
    slug = orgs[0]["slug"] if isinstance(orgs, list) and orgs else "blackrod-messy-church"

    r = requests.post(
        f"{BASE_URL}/api/analytics/track",
        json={"kind": "volunteer_contact", "entity_id": "vol-test-iter17", "org_slug": slug},
        timeout=15,
    )
    assert r.status_code in (200, 201, 204), r.text

    a = requests.get(f"{BASE_URL}/api/admin/impact/summary?days=90", headers=admin_headers, timeout=20).json()
    assert a["headline"]["volunteer_conversions"] == base_conv + 1
    assert a["reach"]["volunteer_clicks"] == base_clicks + 1
    # SROI
    assert a["headline"]["volunteer_hours_estimated"] == a["headline"]["volunteer_conversions"] * 4
    assert a["headline"]["volunteer_value_estimated"] == a["headline"]["volunteer_hours_estimated"] * 15


# --- Geography --------------------------------------------------------------

def test_geography_contains_bl6(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/impact/summary?days=90", headers=admin_headers, timeout=20)
    geo = r.json()["geography"]
    codes = [g["postcode"] for g in geo]
    assert "BL6" in codes, f"BL6 missing, got {codes}"
    # outward-code only (no spaces / no full postcode)
    for g in geo:
        assert " " not in g["postcode"]
        assert len(g["postcode"]) <= 4


# --- PDF endpoint -----------------------------------------------------------

def test_impact_pdf_unauth_403():
    r = requests.get(f"{BASE_URL}/api/admin/impact/pdf?days=90&variant=full", timeout=20)
    assert r.status_code == 403


def test_impact_pdf_full_header_auth(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/impact/pdf?days=90&variant=full", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content[:8].startswith(b"%PDF-1.")


def test_impact_pdf_token_query_param(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/impact/pdf?days=90&variant=full&token={admin_token}", timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content[:8].startswith(b"%PDF-1.")


def test_impact_pdf_short_smaller_than_full(admin_headers):
    rf = requests.get(f"{BASE_URL}/api/admin/impact/pdf?days=90&variant=full", headers=admin_headers, timeout=30)
    rs = requests.get(f"{BASE_URL}/api/admin/impact/pdf?days=90&variant=short", headers=admin_headers, timeout=30)
    assert rf.status_code == 200 and rs.status_code == 200
    assert len(rs.content) < len(rf.content), f"short={len(rs.content)} full={len(rf.content)}"


# --- Teardown: reset grant to 0 (idempotent) --------------------------------

def test_zzz_reset_grant_to_zero(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/admin/impact/grant-config",
        json={"grant_amount": 0, "grant_period_label": "annual"},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200
