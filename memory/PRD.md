# Blackrod Now — PRD

## Original Problem Statement
A modern community website for Blackrod, Bolton showcasing local events, clubs, organisations and news. Anonymous browsing for residents (no accounts). Organisations get a dashboard with an AI "Upload Once, Publish Everywhere" tool that parses pasted flyers/newsletters into structured event/update drafts, 1-way Facebook publishing, personalised newsletters, and public document uploads.

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind 3 + shadcn-ui + sonner. All app state hydrated from FastAPI. Anonymous follows via `bn-device-id` localStorage UUID.
- **Backend**: FastAPI + MongoDB (Motor). All routes under `/api`. Pillow for logo/cover image processing. Emergent Object Storage for org documents + logos/covers. Emergent LLM key (Claude Sonnet 4.5) for AI parsing. Resend for newsletters (mocked until key set). Facebook Graph API (mocked until credentials set).
- **Branding**: Electric blue (#0052FF) + lime accents, "Blackrod Now" logo in headers.

## User Personas
- **Resident** — anonymous browsing, follows orgs/categories, subscribes to weekly digest.
- **Organisation admin** — manages own profile, uploads logo/cover, publishes events + updates via AI tool, posts to Facebook.
- **Super admin** — approves/edits any org, broadcasts newsletters, sends admin notifications to orgs.

## Implemented (Feb 2026)
- 20+ pages: Home, Events, Organisations, OrgDetail, LocalFeed, Venues, Volunteering, OrgDashboard, OrgProfileEdit, Admin, SubmitEvent, AddOrganisation, Preferences, Unsubscribe, EventDetail, FAQ, Contact, Notifications, Categories.
- 29 real Blackrod orgs + 33 events seeded from user-provided Word doc.
- AI parser `POST /api/parse-content` — multi-item event/update extraction (Claude Sonnet 4.5).
- Anonymous device-based follows (orgs + categories).
- Personalised newsletter renderer + Resend integration (mocked until key).
- Super-admin: org status/edit, event feature/delete, dashboard notifications, broadcasts.
- Emergent Object Storage: org documents (PDF/doc/xls/etc up to 10MB).
- Mobile-responsive calendar with `.ics` download.
- **[NEW — Feb 10 2026] Simple share-to-socials.** Removed the mock Facebook Page Connect / Graph API flow entirely (was overkill). New `ShareButtons` component drops in one-tap share buttons for **Facebook, LinkedIn, X/Twitter, WhatsApp, Copy for Instagram, and Copy link** — all client-side (no API keys, no app review). Placed on the AI parsed drafts (Org Dashboard) and on Event Detail pages. Instagram uses the standard "copy caption then paste" pattern since Instagram has no web share URL.
- **[NEW — Feb 10 2026] Per-event Open Graph endpoint.** `GET /api/events/{id}/og` returns crawler-friendly HTML with event-specific `og:title/description/image/url` + Twitter Card tags, then meta-refresh + JS redirects humans to the canonical React page. FB/LinkedIn/X/WhatsApp now render **rich per-event link previews** (event title, date, venue, image) instead of the generic site card. Image fallback chain: `event.image → org cover → org logo → /logo.png`. Description trimmed at word boundary. Copy-link + Copy-for-Instagram still use the pretty canonical URL for human-facing UX.
- **[NEW — Feb 10 2026] Organisation logo + cover image uploads.** Pillow processes uploads server-side:
  - Logo → 512×512 PNG (center-crop) + 128×128 PNG thumbnail
  - Cover → 1600×500 JPEG (fit-crop)
  - Accepted: PNG / JPG / WebP, 5 MB max
  - Endpoints: `POST/GET/DELETE /api/organisations/{slug}/logo`, `.../logo/thumb`, `.../cover`
  - Cache-busted via `?v=updated_at`
  - Displayed via new `OrgAvatar` React component (uses `object-contain` to preserve aspect ratio, falls back to emoji when no image uploaded)
  - Old objects deleted from object storage on replace
  - Available in Org Dashboard → Profile & branding AND Super Admin → edit any org
  - Verified: 14/14 backend pytest + full frontend E2E (testing agent iteration_3)

## Tests
- `/app/backend/tests/test_org_images.py` — new (14 cases: multipart upload, exact size validation via Pillow, WebP handling, replace, 400/413 rejections, delete flow).
- `/app/backend/tests/backend_test.py` — 17/17 regression pass.

## Prioritised Backlog
### P0 (blocked on user)
- **Resend API key** — activate real newsletters/broadcasts.

### P1
- Real JWT / Emergent Google Auth replacing simulated role switcher.
- Auth guard on the new image upload endpoints (currently public — flagged in iteration_3 code review).
- Live `webcal://` endpoint `GET /api/calendar.ics` for calendar subscriptions.

### P2
- Ownership check on `PATCH /api/organisations/{slug}` and `POST /admin/broadcast` (flagged in iteration_2).
- Refactor `server.py` (~1200 lines now — past the 700-line split threshold) into APIRouter modules by domain (events, orgs, subscribers, newsletter, images, og).
- Site-wide search (orgs + events + feed) from navbar.
- Per-org OG page (mirrors the per-event one, so sharing an organisation profile gets a rich card too).

### P3
- Admin analytics (real metrics beyond placeholder tiles).
- Browser push notifications (real service worker).
- Localisation of dates/times.

## Notes / Mocked Integrations
- **Resend** — mocked (`[MOCK EMAIL]` in logs) until `RESEND_API_KEY` is set in `/app/backend/.env`.
- **Auth** — simulated role switcher in navbar (guest / org / admin). No real login.
