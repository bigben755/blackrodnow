"""Parser regression fixtures for date/time normalization and classification.

These are unit-style checks for parser helpers that do not require a live API.
"""
import os
import sys
from pathlib import Path

# server.py expects these env vars at import time.
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "blackrodnow")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server import (  # noqa: E402
    ParsedItem,
    _normalize_parsed_item,
    _fallback_document_classify,
)


def test_normalize_uk_date_and_time_range_from_text():
    text = "Summer fair Saturday 14 June 11am-4pm at Community Centre"
    item = ParsedItem(
        suggested_type="event",
        title="Summer fair",
        description=text,
        action="new_event",
    )
    normalized = _normalize_parsed_item(item, text)

    assert normalized.date and normalized.date.endswith("-06-14")
    assert normalized.start_time == "11:00"
    assert normalized.end_time == "16:00"
    assert normalized.date_confidence is not None
    assert normalized.time_confidence is not None


def test_normalize_does_not_treat_uk_date_as_time_range():
    text = "Meeting date 16-07-26 at the library"
    item = ParsedItem(
        suggested_type="event",
        title="Library meeting",
        description=text,
        action="new_event",
    )
    normalized = _normalize_parsed_item(item, text)

    assert normalized.date == "2026-07-16"
    assert normalized.start_time is None
    assert normalized.end_time is None


def test_fallback_classifies_volunteer_content():
    orgs = [{"slug": "blackrod-town-council", "name": "Blackrod Town Council"}]
    events = [{"id": "evt1", "title": "Summer Fair"}]
    volunteers = [{"id": "vol1", "title": "Volunteer Drivers Needed", "orgSlug": "blackrod-town-council"}]

    items = _fallback_document_classify(
        "volunteer-flyer.txt",
        "Volunteer drivers needed for weekly foodbank pickups",
        orgs,
        events,
        volunteers,
        [],
    )
    assert items
    assert items[0].action in {"new_volunteer", "update_volunteer"}
    assert items[0].suggested_type == "volunteer"
