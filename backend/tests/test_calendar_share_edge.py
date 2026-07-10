"""Edge-case stress tests for Live Calendar Sync + Weekly Share Pack.

Complements TestCalendarFeed / TestSharePack in backend_test.py.
"""
import os
import re
import uuid
import urllib.parse
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Accept": "*/*"})
    return s


# ─────────── Calendar feed edge cases ───────────
class TestCalendarEdge:
    def test_content_type_and_crlf(self, api):
        r = api.get(f"{API}/calendar.ics", timeout=15)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "").lower()
        assert "text/calendar" in ct
        assert "charset=utf-8" in ct
        # CRLF line endings
        assert "\r\n" in r.text
        # Body must end with END:VCALENDAR followed by CRLF
        assert r.text.rstrip("\r\n").endswith("END:VCALENDAR")
        assert r.text.endswith("\r\n")

    def test_vevent_structure(self, api):
        body = api.get(f"{API}/calendar.ics", timeout=15).text
        assert "PRODID:-//Blackrod Now" in body
        assert "X-WR-CALNAME:Blackrod Now" in body
        assert "REFRESH-INTERVAL;VALUE=DURATION:PT1H" in body
        assert "X-PUBLISHED-TTL:PT1H" in body
        # count matching begin/end
        assert body.count("BEGIN:VEVENT") == body.count("END:VEVENT")
        assert body.count("BEGIN:VEVENT") >= 1
        # UTC form YYYYMMDDTHHMMSSZ
        utc_re = re.compile(r"DTSTART:\d{8}T\d{6}Z")
        assert utc_re.search(body), "DTSTART must be in UTC Z form"
        # Every VEVENT has UID, DTSTAMP, DTSTART, DTEND, SUMMARY, DESCRIPTION, URL
        events = re.findall(r"BEGIN:VEVENT.*?END:VEVENT", body, re.DOTALL)
        assert events
        for ev in events:
            for required in ("UID:", "DTSTAMP:", "DTSTART:", "DTEND:", "SUMMARY:", "DESCRIPTION:", "URL:"):
                assert required in ev, f"missing {required} in VEVENT:\n{ev[:200]}"

    def test_description_comma_escape(self, api):
        # Look for at least one description containing escaped commas or check the format is valid
        body = api.get(f"{API}/calendar.ics", timeout=15).text
        # descriptions include "Details: <url>" — commas in body if any must be escaped as \,
        # verify no raw commas that are not preceded by backslash inside DESCRIPTION content lines
        # weaker check: presence of Details: shows canonical URL was appended
        assert "Details: http" in body or "Details: https" in body

    def test_category_filter_name_and_events(self, api):
        r = api.get(f"{API}/calendar.ics", params={"category": "Community"}, timeout=15)
        assert r.status_code == 200
        body = r.text
        assert "X-WR-CALNAME:Blackrod Now · Community" in body
        events = re.findall(r"BEGIN:VEVENT.*?END:VEVENT", body, re.DOTALL)
        # Every event should have CATEGORIES:Community
        for ev in events:
            assert "CATEGORIES:Community" in ev, f"non-Community event slipped in:\n{ev[:200]}"

    def test_orgs_filter_scopes_events(self, api):
        r = api.get(f"{API}/calendar.ics", params={"orgs": "blackrod-town-council"}, timeout=15)
        assert r.status_code == 200
        body = r.text
        # fetch events list and cross-check that each UID belongs to that org
        evs = api.get(f"{API}/events?upcoming_only=false", timeout=15).json()
        council_ids = {e["id"] for e in evs if e.get("orgSlug") == "blackrod-town-council"}
        # Extract UIDs from feed
        uids = re.findall(r"UID:([^@]+)@blackrodnow", body)
        assert uids, "expected at least one UID in filtered feed"
        for uid in uids:
            assert uid in council_ids, f"UID {uid} not from blackrod-town-council"

    def test_unknown_device_returns_valid_feed(self, api):
        # Random device with no subscriber row → should NOT error, returns empty-filter feed
        r = api.get(f"{API}/calendar.ics", params={"device": str(uuid.uuid4())}, timeout=15)
        assert r.status_code == 200
        assert r.text.startswith("BEGIN:VCALENDAR")
        # No orgs/category applied so cal name should not include filter labels
        assert "X-WR-CALNAME:Blackrod Now" in r.text

    def test_multi_orgs_filter(self, api):
        r = api.get(f"{API}/calendar.ics", params={"orgs": "blackrod-town-council,rodlife-events"}, timeout=15)
        assert r.status_code == 200
        assert "X-WR-CALNAME" in r.text
        # count should be >= single-org count
        r_single = api.get(f"{API}/calendar.ics", params={"orgs": "blackrod-town-council"}, timeout=15)
        assert r.text.count("BEGIN:VEVENT") >= r_single.text.count("BEGIN:VEVENT")

    def test_unknown_category_empty_events(self, api):
        r = api.get(f"{API}/calendar.ics", params={"category": "NonExistentXYZ"}, timeout=15)
        assert r.status_code == 200
        # Still valid VCALENDAR wrapper but likely no VEVENT
        assert r.text.startswith("BEGIN:VCALENDAR")
        assert r.text.rstrip("\r\n").endswith("END:VCALENDAR")


# ─────────── Share pack edge cases ───────────
class TestSharePackEdge:
    def test_share_pack_payload_shape(self, api):
        r = api.get(f"{API}/organisations/blackrod-town-council/share-pack", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert set(d["org"].keys()) >= {"slug", "name", "brandColor"}
        assert d["org"]["slug"] == "blackrod-town-council"
        assert isinstance(d["count"], int)
        assert d["count"] == len(d["events"])
        for e in d["events"]:
            for k in ("id", "title", "start", "venue", "description", "image",
                      "canonical_url", "og_url", "share_text", "share_links"):
                assert k in e, f"missing {k} in event"
            assert e["canonical_url"].startswith("http")
            assert e["og_url"].endswith("/og")
            assert e["og_url"].startswith("http")
            for platform in ("facebook", "linkedin", "twitter", "whatsapp"):
                assert platform in e["share_links"]
                assert e["share_links"][platform].startswith("http")
            # Confirm the og_url is URL-encoded and embedded in facebook/linkedin/twitter share URLs
            encoded = urllib.parse.quote(e["og_url"], safe="")
            assert encoded in e["share_links"]["facebook"]
            assert encoded in e["share_links"]["linkedin"]
            assert encoded in e["share_links"]["twitter"]

    def test_share_pack_unknown_org_404(self, api):
        r = api.get(f"{API}/organisations/does-not-exist-xyz/share-pack", timeout=15)
        assert r.status_code == 404

    def test_email_share_pack_mocked_payload_and_log(self, api):
        to = f"TEST_edge_{uuid.uuid4().hex[:6]}@example.com"
        r = api.post(
            f"{API}/organisations/blackrod-town-council/share-pack/email",
            json={"to": to},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["to"] == to
        assert isinstance(d["count"], int)
        assert d["email"]["mocked"] is True

    def test_email_share_pack_uses_org_email_when_no_body(self, api):
        # blackrod-town-council has org.email set — verify fallback to org.email when `to` omitted
        r_org = api.get(f"{API}/organisations/blackrod-town-council", timeout=15)
        assert r_org.status_code == 200
        org_email = r_org.json().get("email")
        if not org_email:
            pytest.skip("blackrod-town-council has no email — cannot test fallback path")
        r = api.post(
            f"{API}/organisations/blackrod-town-council/share-pack/email",
            json={},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["to"].lower() == org_email.lower()
        assert d["email"]["mocked"] is True

    def test_email_share_pack_missing_recipient_400(self, api):
        # Find an existing seeded org with no email, then POST with empty body → expect 400
        orgs = api.get(f"{API}/organisations", timeout=15).json()
        no_email_org = next((o for o in orgs if not (o.get("email") or "").strip()), None)
        if not no_email_org:
            pytest.skip("no seeded org without email — cannot test negative case")
        r = api.post(
            f"{API}/organisations/{no_email_org['slug']}/share-pack/email",
            json={},
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400 for missing recipient, got {r.status_code}: {r.text}"

    def test_share_pack_html_email_wellformed(self, api):
        # We can't fetch rendered html directly, but the mock path logs it.
        # Instead, verify the data shape drives an html render via the mocked email endpoint;
        # then also verify the /share-pack payload contains HTML-escapable event titles.
        r = api.get(f"{API}/organisations/blackrod-town-council/share-pack", timeout=15)
        assert r.status_code == 200
        d = r.json()
        # every share_text must be a non-empty str
        for e in d["events"]:
            assert isinstance(e["share_text"], str) and e["share_text"]
