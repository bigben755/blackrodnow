"""Labeled-block document parsing — the user's real bulk-upload docx format."""
import os
import shutil
import requests
import pytest
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
USER_DOC = os.path.join(os.path.dirname(__file__), "fixtures", "blackrod_bulk_upload.docx")


@pytest.fixture(scope="module")
def parsed_doc():
    assert os.path.exists(USER_DOC), "user docx fixture missing"
    with open(USER_DOC, "rb") as fh:
        r = requests.post(
            f"{API}/admin/documents/parse",
            files={"files": ("Blackrod Now Bulk Upload.docx", fh, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
            timeout=60,
        )
    assert r.status_code == 200, r.text
    return r.json()["documents"][0]


def test_all_blocks_extracted(parsed_doc):
    assert parsed_doc["source_type"] == "labeled_document"
    assert len(parsed_doc["items"]) == 26
    assert any("without AI" in w for w in parsed_doc["warnings"])


def test_every_item_has_core_fields(parsed_doc):
    import re
    for it in parsed_doc["items"]:
        assert it["suggested_type"] == "event"
        assert it["title"]
        assert it["date"] and re.fullmatch(r"\d{4}-\d{2}-\d{2}", it["date"]), it["date"]
        assert it["category"] != ""


def test_field_fidelity_first_item(parsed_doc):
    it = parsed_doc["items"][0]
    assert "Family Hub Toddler Group" in it["title"]
    assert it["date"] == "2026-08-18"
    assert it["start_time"] == "10:00"
    assert it["end_time"] == "11:00"
    assert it["category"] == "Family"
    assert it["location"] == "Blackrod Young People's Centre"
    assert it["cost"] == "Free"
    assert it["contact_phone"] and "01204" in it["contact_phone"]
    assert it["recurrence_freq"] == "weekly"


def test_placeholder_values_filtered(parsed_doc):
    for it in parsed_doc["items"]:
        for field in ("contact_email", "contact_phone", "booking", "url", "image"):
            val = it.get(field) or ""
            assert not val.lower().startswith(("not published", "not reliably", "no advance", "no event-specific")), (it["title"], field, val)


def test_explicit_categories_respected(parsed_doc):
    by_title = {it["title"]: it for it in parsed_doc["items"]}
    book_group = next(v for k, v in by_title.items() if "Book Group" in k)
    assert book_group["category"] == "Community"
