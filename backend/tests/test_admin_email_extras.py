"""Extra tests focused on the admin compose endpoint:
- XSS/HTML-escape safety in preview
- both senders actually deliver via Resend (live)
- body-empty 400
- URL auto-linking + blank-line paragraph split
"""
import io
import os
import requests
import pytest

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://rodlife-events.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

SENDER_A = "blackrodnow@communityalliances.co.uk"
SENDER_B = "now@communityalliances.co.uk"


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


class TestAdminEmailComposeExtras:
    def test_senders_whitelist_has_both(self, api):
        r = api.get(f"{API}/admin/email/senders", timeout=15)
        assert r.status_code == 200
        d = r.json()
        low = [s.lower() for s in d["senders"]]
        assert SENDER_A in low
        assert SENDER_B in low
        assert d.get("default")

    def test_preview_escapes_script_tag(self, api):
        """XSS body must be HTML-escaped in the returned html string."""
        r = api.post(
            f"{API}/admin/email/preview",
            json={
                "to": "delivered@resend.dev",
                "subject": "<img src=x onerror=alert(2)>",
                "body": "hello <script>alert(1)</script> world",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        html = d["html"]
        # Raw script tag must NOT appear un-escaped in body
        assert "<script>alert(1)</script>" not in html
        # Raw <img ...> tag with onerror must NOT appear (subject was escaped)
        assert "<img src=x onerror=alert(2)>" not in html
        # Escaped variant SHOULD appear (body)
        assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
        # Subject also escaped
        assert "&lt;img src=x onerror=alert(2)&gt;" in html

    def test_preview_auto_links_url_and_paragraphs(self, api):
        r = api.post(
            f"{API}/admin/email/preview",
            json={
                "to": "a@b.co",
                "subject": "s",
                "body": "para1\n\npara2 https://example.com/x?y=1 tail",
            },
            timeout=15,
        )
        assert r.status_code == 200
        html = r.json()["html"]
        # Two paragraphs
        assert html.count("<p>") >= 2
        # Auto-link
        assert 'href="https://example.com/x?y=1"' in html

    def test_preview_dedup_and_invalid_split(self, api):
        r = api.post(
            f"{API}/admin/email/preview",
            json={
                "to": "A@B.co, a@b.co ; bad-email\nx@y.co,x@y.co",
                "subject": "s",
                "body": "b",
            },
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        # Case-insensitive dedup: only one of A@B.co / a@b.co survives
        low = [x.lower() for x in d["recipients"]]
        assert low.count("a@b.co") == 1
        assert low.count("x@y.co") == 1
        assert d["invalid_recipients"] == ["bad-email"]
        assert d["count"] == 2

    def test_preview_and_send_with_attachment(self, api):
        files = [
            ("attachments", ("agenda.txt", io.BytesIO(b"Agenda for the meeting"), "text/plain")),
        ]
        payload = {
            "to": "delivered@resend.dev",
            "subject": "TEST_attachment",
            "body": "Please see the attached agenda.",
        }
        r = api.post(f"{API}/admin/email/preview", data=payload, files=files, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["attachment_count"] == 1
        assert d["attachments"][0]["filename"] == "agenda.txt"

        r2 = api.post(f"{API}/admin/email/send", data=payload, files=files, timeout=30)
        assert r2.status_code == 200, r2.text
        sent = r2.json()
        assert sent["attachments"][0]["filename"] == "agenda.txt"
        assert sent["results"][0]["attachments"][0]["filename"] == "agenda.txt"

    def test_send_400_empty_body(self, api):
        r = api.post(
            f"{API}/admin/email/send",
            json={"to": "delivered@resend.dev", "subject": "s", "body": ""},
            timeout=15,
        )
        assert r.status_code == 400

    def test_send_400_bad_sender(self, api):
        r = api.post(
            f"{API}/admin/email/send",
            json={
                "to": "delivered@resend.dev",
                "subject": "s",
                "body": "b",
                "from_email": "attacker@evil.com",
            },
            timeout=15,
        )
        assert r.status_code == 400

    def test_send_from_sender_A(self, api):
        r = api.post(
            f"{API}/admin/email/send",
            json={
                "to": "delivered@resend.dev",
                "subject": "TEST_from_A",
                "body": "sent from A",
                "from_email": SENDER_A,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sent"] == 1
        assert d["failed"] == 0
        if not d.get("mocked"):
            assert d["results"][0].get("id"), "Resend id expected in live mode"

    def test_send_from_sender_B(self, api):
        r = api.post(
            f"{API}/admin/email/send",
            json={
                "to": "delivered@resend.dev",
                "subject": "TEST_from_B",
                "body": "sent from B",
                "from_email": SENDER_B,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sent"] == 1
        assert d["failed"] == 0
        if not d.get("mocked"):
            assert d["results"][0].get("id"), "Resend id expected in live mode"
