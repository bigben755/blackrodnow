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
- **[NEW — Feb 10 2026] Live calendar sync (webcal://).** `GET /api/calendar.ics` returns an RFC 5545 iCalendar feed with `X-WR-CALNAME`, hourly refresh hint, and per-event UID/DTSTART/DTEND/SUMMARY/LOCATION/URL. Filterable via `?device=<uuid>` (uses the user's followed orgs+categories), `?orgs=slug1,slug2`, or `?category=<name>`. New `SubscribeCalendarDialog` on the Events page with scope toggle and 1-click add to Apple Calendar / Google Calendar / Outlook.com / Copy webcal:// link, plus a fallback `.ics` download.
- **[NEW — Feb 10 2026] Weekly share pack for orgs.** `GET /api/organisations/{slug}/share-pack` returns the org's next 6 upcoming events with per-event share links to Facebook/LinkedIn/X/WhatsApp (all wired to the OG endpoint so previews are rich). `POST .../share-pack/email` renders an HTML email with previews + share buttons and sends via Resend (mocked with `[MOCK EMAIL]` until `RESEND_API_KEY` is set). New "Weekly share pack" card on the Org Dashboard with "Preview" and "Email me the pack" actions.
- **[NEW — Feb 10 2026] Admin notifications open in a full-content dialog.** Clicking any notification in the OrgDashboard bell dropdown now opens a Radix Dialog showing the full title, formatted 'Received' timestamp, and complete multi-line body (whitespace preserved, up to 45vh with scroll). Includes a Copy button (copies title+body) and marks the notification as read on open. Testing agent 17/17 detailed checks pass.
- **[NEW — Feb 10 2026] Notification reply thread.** Orgs can reply directly from the notification dialog. Replies POST to `/api/contact-admin` with `in_reply_to = notification.id`, and `GET /api/notifications/{id}/thread` returns the full conversation (notification + all replies). Dialog now shows a "Conversation" section with prior replies + a composer (Cmd/Ctrl+Enter shortcut). Super Admin inbox shows a "REPLY" badge on threaded messages. Turns one-way admin messages into a lightweight ticket flow.
- **[NEW — Feb 10 2026] Event editing (super admin + org admin).** New `PATCH /api/events/{id}` endpoint accepts partial updates. New `/edit-event/:id` React page with prefilled fields, delete action, and an admin-only status picker (approved/pending/rejected). Edit CTAs visible on Event Detail (for admin/org roles), OrgDashboard event tiles, and Super Admin pending queue + approved-events table.
- **[FIX — Feb 10 2026] Facebook share OG rendering.** The per-event OG endpoint used to include `<meta http-equiv="refresh" content="0; url=…">`, which Facebook's scraper *follows* — landing it on the SPA and reading generic site-level OG tags instead of the per-event ones. Removed the meta-refresh (kept only the JS redirect, which crawlers don't execute). Also changed `og:type` from unsupported `"event"` to `"article"`, added `og:image:width/height/secure_url`. Facebook caches OG scrapes for ~24h — if a preview still looks generic post-fix, force a re-scrape at https://developers.facebook.com/tools/debug/.
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
- Refactor `server.py` (now ~1475 lines) into APIRouter modules by domain — testing agent flagged in iteration_7.
- Site-wide search (orgs + events + feed) from navbar.
- Per-org OG page (mirrors the per-event one, so sharing an organisation profile gets a rich card too).
- Real weekly scheduler for share-pack email (cron/APScheduler) — right now it's on-demand only.

### P3
- Admin analytics (real metrics beyond placeholder tiles).
- Browser push notifications (real service worker).
- Localisation of dates/times.

## Notes / Mocked Integrations
- **Resend** — FULLY LIVE as of Feb 10 2026. Domain `communityalliances.co.uk` verified. Sender: `"Blackrod Now" <blackrodnow@communityalliances.co.uk>`. Verified real delivery to arbitrary addresses via share pack + welcome email + broadcast pathways — no sandbox restriction. Multi-alliance sender naming pattern already in place (add `bradshawnow@communityalliances.co.uk`, `halliwellnow@…` etc. when those alliances go live — just update `SENDER_EMAIL` per deployment).
- **Auth** — simulated role switcher in navbar (guest / org / admin). No real login.
