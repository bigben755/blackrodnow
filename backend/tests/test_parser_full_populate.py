"""Bulk-upload parser overhaul — every parse path should fully populate event fields.

Unit-style checks importing parser helpers directly (no live API needed).
"""
import io
import os
import sys
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "blackrodnow")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server import (  # noqa: E402
    ParsedItem,
    _fallback_parse,
    _normalize_parsed_item,
    _try_structured_spreadsheet,
)

FLYER = """Blackrod Summer Fair
Saturday 14 June 2026, 11am-4pm
Venue: Blackrod Community Centre
15 Church Road, Blackrod BL6 5AQ
Entry is free, all ages welcome. Wheelchair accessible with accessible toilets.
Book your stall via events@blackrodfair.org or call 01204 696295.
More info: https://blackrodfair.org/summer
"""


def test_normalize_fills_all_event_fields_from_flyer_text():
    item = ParsedItem(
        suggested_type="event",
        title="Blackrod Summer Fair",
        description="Annual summer fair",
        action="new_event",
    )
    normalized = _normalize_parsed_item(item, FLYER)

    assert normalized.date == "2026-06-14"
    assert normalized.start_time == "11:00"
    assert normalized.end_time == "16:00"
    assert normalized.location == "Blackrod Community Centre"
    assert normalized.address and "BL6 5AQ" in normalized.address
    assert normalized.cost == "Free"
    assert normalized.booking and "Book" in normalized.booking
    assert normalized.url == "https://blackrodfair.org/summer"
    assert normalized.age and "all ages" in normalized.age.lower()
    assert normalized.accessibility and "wheelchair" in normalized.accessibility.lower()
    assert normalized.contact_email == "events@blackrodfair.org"
    assert normalized.contact_phone and "01204" in normalized.contact_phone
    assert normalized.category == "Food & Drink"  # fair ⇒ Food & Drink keyword bucket


def test_fallback_parse_populates_structured_fields():
    item = _fallback_parse(FLYER)
    assert item.suggested_type == "event"
    assert item.date == "2026-06-14"
    assert item.cost == "Free"
    assert item.contact_email == "events@blackrodfair.org"
    assert item.location == "Blackrod Community Centre"


def test_multi_day_range_sets_start_and_end_date():
    text = "Blackrod Beer Festival, 21-23 July 2026, 12pm-11pm at the Sports Club"
    item = ParsedItem(suggested_type="event", title="Beer Festival", description=text, action="new_event")
    normalized = _normalize_parsed_item(item, text)
    assert normalized.date == "2026-07-21"
    assert normalized.end_date == "2026-07-23"


def test_normalize_does_not_invent_fields_for_updates():
    item = ParsedItem(suggested_type="update", title="Roadworks notice", description="Roadworks on Church Road", action="unclear")
    normalized = _normalize_parsed_item(item, "Roadworks on Church Road from 3 May")
    assert normalized.cost is None
    assert normalized.contact_email is None


def _xlsx_bytes(headers, rows):
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


FULL_HEADERS = [
    "Organisation", "Title", "Date", "End date", "Start time", "End time", "Venue", "Address",
    "Category", "Fee", "Age", "Accessibility", "Booking info", "URL", "Contact email", "Contact phone",
    "Repeats", "Description",
]
FULL_ROW = [
    "Blackrod Library", "Craft Morning", "2026-07-21", "2026-07-22", "10am", "12pm", "Blackrod Library",
    "Church Street, Blackrod BL6 5EQ", "Family", "Free", "All ages", "Step-free access", "Just turn up",
    "https://example.org/craft", "library@example.org", "01204 000000", "Every Tuesday",
    "Crafts, stories and songs for families.",
]


def test_structured_spreadsheet_full_columns():
    data = _xlsx_bytes(FULL_HEADERS, [FULL_ROW])
    doc = _try_structured_spreadsheet("events.xlsx", data, orgs=[], events=[])
    assert doc is not None
    assert len(doc.items) == 1
    item = doc.items[0]
    assert item.title == "Craft Morning"
    assert item.date == "2026-07-21"
    assert item.end_date == "2026-07-22"
    assert item.start_time == "10:00"
    assert item.end_time == "12:00"
    assert item.location == "Blackrod Library"
    assert item.address == "Church Street, Blackrod BL6 5EQ"
    assert item.category == "Family"
    assert item.cost == "Free"
    assert item.age == "All ages"
    assert item.accessibility == "Step-free access"
    assert item.booking == "Just turn up"
    assert item.url == "https://example.org/craft"
    assert item.contact_email == "library@example.org"
    assert item.contact_phone == "01204 000000"
    assert item.recurrence_freq == "weekly"
    assert item.recurrence_weekday == "Tuesday"
    assert item.description == "Crafts, stories and songs for families."


def test_structured_spreadsheet_legacy_columns_still_work():
    headers = ["Organisation", "Title", "Date", "Time/s", "Venue", "Category", "Fee", "URL", "Booking info"]
    rows = [["Blackrod FC", "Junior Trials", "2026-09-01", "6pm-8pm", "Blackrod Sports Centre", "Sport", "£2", "https://example.org/trials", "Register online"]]
    doc = _try_structured_spreadsheet("legacy.xlsx", _xlsx_bytes(headers, rows), orgs=[], events=[])
    assert doc is not None
    item = doc.items[0]
    assert item.start_time == "18:00" and item.end_time == "20:00"
    assert item.category == "Sport"
    assert item.cost == "£2"
    assert item.booking == "Register online"


def test_structured_spreadsheet_infers_category_when_column_missing():
    headers = ["Organisation", "Title", "Date", "Time/s", "Venue"]
    rows = [["Blackrod Choir", "Carol Concert", "2026-12-12", "7pm", "St Katharine's Church"]]
    doc = _try_structured_spreadsheet("nocategory.xlsx", _xlsx_bytes(headers, rows), orgs=[], events=[])
    assert doc is not None
    assert doc.items[0].category == "Music"
