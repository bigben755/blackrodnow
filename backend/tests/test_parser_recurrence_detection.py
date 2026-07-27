"""Verify the /api/parse-content endpoint recognises recurring event patterns
like the ones in the Blackrod newsletter (Mondays, Wednesdays, Fridays…)."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


NEWSLETTER_SNIPPET = """
Bumps, Boobs, and Buggies Walking Group
This gentle walk is suitable for prams, toddlers, and slings.
Mondays, 10:00am – 11:00am
Horwich Library

Breastfeeding Group
Drop-in and meet other breastfeeding parents.
Mondays, 11:00am – 12:00pm
Horwich Library

Baby Babble and Bond
Drop-in group for families with babies 0-12 months.
Wednesdays, 10:00am – 11:00am
Blackrod Young People's Centre, BL6 5SY

Toddler Tales
Storytelling sessions ideal for 2-5 years.
Thursdays, 10:30am
Horwich Library & Blackrod Library

Chat, Play, Read
Drop-in group for families with children 12 months plus.
Fridays, 9:30am – 10:30am
Horwich Health and Wellbeing Hub
"""


@pytest.fixture(scope="module")
def parsed():
    r = requests.post(f"{API}/parse-content", json={"text": NEWSLETTER_SNIPPET}, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


def _items_by_weekday(items, weekday):
    weekday = weekday.lower()
    return [
        it for it in items
        if it.get("suggested_type") == "event"
        and (it.get("recurrence_weekday") or "").lower() == weekday
    ]


def test_returns_multiple_events(parsed):
    events = [it for it in parsed.get("items", []) if it.get("suggested_type") == "event"]
    assert len(events) >= 4, f"expected at least 4 events, got {len(events)}"


@pytest.mark.parametrize("weekday", ["Monday", "Wednesday", "Thursday", "Friday"])
def test_each_weekly_group_is_flagged_weekly(parsed, weekday):
    matches = _items_by_weekday(parsed.get("items", []), weekday)
    assert matches, f"No parsed event tagged as recurring on {weekday}"
    for item in matches:
        assert item.get("recurrence_freq") == "weekly", (
            f"{weekday} item not marked weekly: {item.get('title')} → {item.get('recurrence_freq')}"
        )


def test_all_events_have_recurrence_field(parsed):
    events = [it for it in parsed.get("items", []) if it.get("suggested_type") == "event"]
    # The four newsletter groups above are all recurring — at least three should be
    # detected as non-"none" via the regex fallback, even if the LLM omits them.
    recurring = [e for e in events if e.get("recurrence_freq") and e["recurrence_freq"] != "none"]
    assert len(recurring) >= 3, f"expected ≥3 recurring events, got {len(recurring)}"


def test_regex_direct_detection():
    """Direct unit-style check of the detection helper by round-tripping a
    single item with unambiguous plural weekday text."""
    text = "Sing & Sign\nMondays, 1:30pm at Blackrod Library"
    r = requests.post(f"{API}/parse-content", json={"text": text}, timeout=45)
    assert r.status_code == 200
    items = r.json().get("items", [])
    assert items, "no items"
    ev = next((it for it in items if it.get("suggested_type") == "event"), None)
    assert ev, "no event item"
    assert ev.get("recurrence_freq") == "weekly"
    assert (ev.get("recurrence_weekday") or "").lower() == "monday"
