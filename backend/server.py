from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent LLM key (for AI text parsing feature)
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app without a prefix
app = FastAPI(title="Blackrod Now API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class ParseRequest(BaseModel):
    text: str
    hint: Optional[str] = None  # e.g. "event" or "update"


class ParsedSuggestion(BaseModel):
    suggested_type: str  # "event" or "update"
    title: str
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    description: str
    social_caption: str
    notification_text: str


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Blackrod Now API", "ok": True}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


def _fallback_parse(text: str) -> ParsedSuggestion:
    """Cheap regex fallback if LLM unavailable."""
    title = text.strip().split('\n')[0][:80] if text.strip() else "Community update"
    date_match = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?\b", text, re.I)
    time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", text, re.I)
    location_match = re.search(r"\b(?:at|venue:|location:)\s*([A-Z][\w &',.-]+)", text)
    is_event = bool(date_match or time_match)
    return ParsedSuggestion(
        suggested_type="event" if is_event else "update",
        title=title,
        date=date_match.group(0) if date_match else None,
        start_time=time_match.group(0) if time_match else None,
        end_time=None,
        location=location_match.group(1) if location_match else None,
        category="Community",
        description=text.strip()[:500],
        social_caption=f"📣 {title} — happening in Blackrod. Find out more on Blackrod Now.",
        notification_text=f"New on Blackrod Now: {title}",
    )


@api_router.post("/parse-content", response_model=ParsedSuggestion)
async def parse_content(req: ParseRequest):
    """Upload Once, Publish Everywhere — extract structured suggestion from raw text."""
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    if not EMERGENT_LLM_KEY:
        return _fallback_parse(req.text)

    system_message = (
        "You are a friendly community editor for Blackrod Now, a local platform for Blackrod, Bolton (UK). "
        "Given a raw paste (flyer/newsletter/update), decide whether it's an EVENT or a general UPDATE, "
        "then extract structured fields. Reply ONLY with a JSON object (no markdown, no prose) with EXACTLY these keys: "
        "suggested_type ('event' or 'update'), title, date (e.g. 'Saturday 14 June 2025' or null), "
        "start_time (e.g. '10:00 AM' or null), end_time (or null), location (or null), "
        "category (one of: Family, Youth, Sport, School, Charity, Business, Community, Music, "
        "Food & Drink, Volunteering, Faith, Heritage, Health & Wellbeing), "
        "description (a clean 1-3 sentence write-up), "
        "social_caption (a punchy Instagram/Facebook caption with 2-3 emojis and 2-4 hashtags), "
        "notification_text (a short push notification, max 90 chars). "
        "Use a warm, modern, youth-friendly tone."
    )

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"parse-{uuid.uuid4()}",
            system_message=system_message,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        msg = UserMessage(text=f"Raw paste:\n\n{req.text}\n\nReturn only the JSON object.")
        raw = await chat.send_message(msg)

        # Strip code fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()

        # Try direct parse, otherwise find first { ... }
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, re.S)
            if not match:
                return _fallback_parse(req.text)
            data = json.loads(match.group(0))

        return ParsedSuggestion(
            suggested_type=data.get("suggested_type", "update"),
            title=data.get("title", "Community update"),
            date=data.get("date"),
            start_time=data.get("start_time"),
            end_time=data.get("end_time"),
            location=data.get("location"),
            category=data.get("category", "Community"),
            description=data.get("description", ""),
            social_caption=data.get("social_caption", ""),
            notification_text=data.get("notification_text", ""),
        )
    except Exception as e:
        logging.exception("AI parse failed, using fallback: %s", e)
        return _fallback_parse(req.text)


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
