"""Blackrod Now — Organisation logo + cover image upload tests.

Covers:
  - POST /api/organisations/{slug}/logo (PNG multipart) → 200 + updates paths
  - POST /api/organisations/{slug}/cover (JPG multipart) → 200 + updates path
  - GET .../logo (512x512 PNG), .../logo/thumb (128x128 PNG), .../cover (1600x500 JPEG)
  - Rejects GIF, invalid bytes, and files >5MB
  - DELETE endpoints clear paths
  - GET /organisations/{slug} reflects logo_path/logo_thumb_path/cover_path
  - WebP support and replace flow
"""
import io
import os
import uuid
import pytest
import requests
from PIL import Image

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
SLUG = "blackrod-town-council"


def _make_png_bytes(w: int = 800, h: int = 600, color=(255, 0, 0)) -> bytes:
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_jpg_bytes(w: int = 2000, h: int = 800, color=(0, 128, 255)) -> bytes:
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _make_webp_bytes(w: int = 900, h: int = 900, color=(0, 200, 100)) -> bytes:
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=90)
    return buf.getvalue()


def _make_gif_bytes(w: int = 200, h: int = 200) -> bytes:
    img = Image.new("P", (w, h), 0)
    buf = io.BytesIO()
    img.save(buf, format="GIF")
    return buf.getvalue()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def _cleanup_at_end(api):
    """After all tests, delete any uploaded logo/cover on the test org."""
    yield
    try:
        api.delete(f"{API}/organisations/{SLUG}/logo", timeout=15)
        api.delete(f"{API}/organisations/{SLUG}/cover", timeout=15)
    except Exception:
        pass


class TestOrgLogoUpload:
    def test_upload_logo_png(self, api):
        png = _make_png_bytes(800, 600)
        files = {"file": (f"TEST_logo_{uuid.uuid4().hex[:6]}.png", io.BytesIO(png), "image/png")}
        r = api.post(f"{API}/organisations/{SLUG}/logo", files=files, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["logo_url"].endswith(f"/api/organisations/{SLUG}/logo")
        assert d["thumb_url"].endswith(f"/api/organisations/{SLUG}/logo/thumb")

    def test_org_document_reflects_paths(self, api):
        r = api.get(f"{API}/organisations/{SLUG}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("logo_path"), f"logo_path missing: {d}"
        assert d.get("logo_thumb_path"), f"logo_thumb_path missing: {d}"
        # cover_path may be None here — set later or nullable
        assert "cover_path" in d

    def test_get_logo_is_512_png(self, api):
        r = api.get(f"{API}/organisations/{SLUG}/logo", timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")
        img = Image.open(io.BytesIO(r.content))
        assert img.size == (512, 512), f"expected 512x512, got {img.size}"
        assert img.format == "PNG"

    def test_get_logo_thumb_is_128_png(self, api):
        r = api.get(f"{API}/organisations/{SLUG}/logo/thumb", timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")
        img = Image.open(io.BytesIO(r.content))
        assert img.size == (128, 128), f"expected 128x128, got {img.size}"

    def test_replace_logo(self, api):
        """Uploading a second logo should replace the first — updated_at changes."""
        r_before = api.get(f"{API}/organisations/{SLUG}", timeout=15).json()
        old_path = r_before.get("logo_path")
        old_updated = r_before.get("updated_at")

        png = _make_png_bytes(400, 400, color=(0, 255, 0))
        files = {"file": ("TEST_logo_replace.png", io.BytesIO(png), "image/png")}
        r = api.post(f"{API}/organisations/{SLUG}/logo", files=files, timeout=60)
        assert r.status_code == 200

        r_after = api.get(f"{API}/organisations/{SLUG}", timeout=15).json()
        assert r_after.get("logo_path") != old_path, "logo_path should change on replace"
        assert r_after.get("updated_at") != old_updated

    def test_upload_webp_logo(self, api):
        webp = _make_webp_bytes(700, 700)
        files = {"file": ("TEST_logo.webp", io.BytesIO(webp), "image/webp")}
        r = api.post(f"{API}/organisations/{SLUG}/logo", files=files, timeout=60)
        assert r.status_code == 200, r.text
        # Verify size is still 512
        r2 = api.get(f"{API}/organisations/{SLUG}/logo", timeout=30)
        assert r2.status_code == 200
        img = Image.open(io.BytesIO(r2.content))
        assert img.size == (512, 512)


class TestOrgCoverUpload:
    def test_upload_cover_jpg(self, api):
        jpg = _make_jpg_bytes(2000, 800)
        files = {"file": (f"TEST_cover_{uuid.uuid4().hex[:6]}.jpg", io.BytesIO(jpg), "image/jpeg")}
        r = api.post(f"{API}/organisations/{SLUG}/cover", files=files, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["cover_url"].endswith(f"/api/organisations/{SLUG}/cover")

    def test_org_has_cover_path(self, api):
        r = api.get(f"{API}/organisations/{SLUG}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("cover_path"), r.text

    def test_get_cover_is_1600x500_jpeg(self, api):
        r = api.get(f"{API}/organisations/{SLUG}/cover", timeout=30)
        assert r.status_code == 200
        ctype = r.headers.get("content-type", "")
        assert ctype.startswith("image/jpeg") or ctype.startswith("image/jpg"), ctype
        img = Image.open(io.BytesIO(r.content))
        assert img.size == (1600, 500), f"expected 1600x500, got {img.size}"


class TestImageRejections:
    def test_reject_gif(self, api):
        gif = _make_gif_bytes()
        files = {"file": ("TEST_bad.gif", io.BytesIO(gif), "image/gif")}
        r = api.post(f"{API}/organisations/{SLUG}/logo", files=files, timeout=30)
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "").lower()
        assert "png" in detail or "webp" in detail or "allowed" in detail

    def test_reject_invalid_bytes(self, api):
        # PNG-named file with garbage inside
        files = {"file": ("TEST_garbage.png", io.BytesIO(b"not_an_image_" * 40), "image/png")}
        r = api.post(f"{API}/organisations/{SLUG}/logo", files=files, timeout=30)
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "").lower()
        assert "invalid" in detail

    def test_reject_too_large(self, api):
        # Make a PNG bigger than 5MB by using a huge random-noise buffer
        # Trick: build a large PNG file. Use big dimensions with random data.
        import os as _os
        w, h = 3000, 3000
        img = Image.frombytes("RGB", (w, h), _os.urandom(w * h * 3))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
        assert len(data) > 5 * 1024 * 1024, f"test payload only {len(data)} bytes"
        files = {"file": ("TEST_too_big.png", io.BytesIO(data), "image/png")}
        r = api.post(f"{API}/organisations/{SLUG}/logo", files=files, timeout=60)
        assert r.status_code == 413, r.text


class TestDeleteFlow:
    def test_delete_logo(self, api):
        # Ensure there is a logo first
        png = _make_png_bytes(300, 300)
        files = {"file": ("TEST_logo_predelete.png", io.BytesIO(png), "image/png")}
        api.post(f"{API}/organisations/{SLUG}/logo", files=files, timeout=60)

        r = api.delete(f"{API}/organisations/{SLUG}/logo", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        r2 = api.get(f"{API}/organisations/{SLUG}", timeout=15).json()
        assert r2.get("logo_path") is None
        assert r2.get("logo_thumb_path") is None

        r3 = api.get(f"{API}/organisations/{SLUG}/logo", timeout=15)
        assert r3.status_code == 404

    def test_delete_cover(self, api):
        jpg = _make_jpg_bytes(1200, 400)
        files = {"file": ("TEST_cover_predelete.jpg", io.BytesIO(jpg), "image/jpeg")}
        api.post(f"{API}/organisations/{SLUG}/cover", files=files, timeout=60)

        r = api.delete(f"{API}/organisations/{SLUG}/cover", timeout=15)
        assert r.status_code == 200

        r2 = api.get(f"{API}/organisations/{SLUG}", timeout=15).json()
        assert r2.get("cover_path") is None

        r3 = api.get(f"{API}/organisations/{SLUG}/cover", timeout=15)
        assert r3.status_code == 404
