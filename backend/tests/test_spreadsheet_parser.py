"""Structured spreadsheet parsing — columns → one event per row."""
import io
import os
import requests
import pytest
from datetime import date
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

HEADERS = ["Organisation", "Title", "Date", "Time/s", "Venue", "Category", "Fee", "URL", "Booking info"]
ROWS = [
    ["Blackrod Library", "Summer Craft Morning", date(2026, 7, 21), "10am-12pm", "Blackrod Library", "Family", "Free", "https://example.org/craft", "Just turn up"],
    ["St Katharine's Church", "Heritage Talk", date(2026, 8, 5), "7:30pm", "Church Hall", "Heritage", "£3", "", "Book via phone"],
    ["Blackrod FC", "Junior Football Trials", date(2026, 9, 1), "6pm-8pm", "Blackrod Sports Centre", "Sport", "£2", "https://example.org/trials", "Register online"],
]


def _xlsx_bytes():
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.append(HEADERS)
    for r in ROWS:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _csv_bytes():
    lines = [",".join(HEADERS)]
    for r in ROWS:
        lines.append(",".join(f'"{c.isoformat() if isinstance(c, date) else c}"' for c in r))
    return "\n".join(lines).encode()


def _parse(filename, content, mime):
    r = requests.post(
        f"{API}/admin/documents/parse",
        files={"files": (filename, content, mime)},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    return r.json()["documents"][0]


@pytest.mark.parametrize("filename,builder,mime", [
    ("events.xlsx", _xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ("events.csv", _csv_bytes, "text/csv"),
])
def test_structured_rows_become_events(filename, builder, mime):
    doc = _parse(filename, builder(), mime)
    assert doc["source_type"] == "spreadsheet"
    assert len(doc["items"]) == 3
    by_title = {it["title"]: it for it in doc["items"]}
    craft = by_title["Summer Craft Morning"]
    assert craft["suggested_type"] == "event"
    assert craft["date"] == "2026-07-21"
    assert craft["start_time"] == "10:00"
    assert craft["end_time"] == "12:00"
    assert craft["category"] == "Family"
    assert craft["cost"] == "Free"
    assert craft["url"] == "https://example.org/craft"
    talk = by_title["Heritage Talk"]
    assert talk["start_time"] == "19:30"
    assert talk["category"] == "Heritage"
    assert talk["cost"] == "£3"
    trials = by_title["Junior Football Trials"]
    assert trials["start_time"] == "18:00" and trials["end_time"] == "20:00"


def test_unstructured_xlsx_falls_back():
    """A spreadsheet without a recognisable header row still parses via the text pipeline."""
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.append(["Some notes about the village fete happening soon"])
    ws.append(["Contact the committee for details"])
    buf = io.BytesIO()
    wb.save(buf)
    doc = _parse("notes.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    assert doc["source_type"] == "xlsx"  # fell through to text extraction
    assert len(doc["items"]) >= 1
