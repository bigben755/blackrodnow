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
- **[NEW — Feb 10 2026] Super Admin free-form email compose.** New endpoints `GET /api/admin/email/senders`, `POST /api/admin/email/preview`, `POST /api/admin/email/send`. Sender whitelist from `ADMIN_SENDER_EMAILS` env (currently `blackrodnow@communityalliances.co.uk` + `now@communityalliances.co.uk`). Multi-recipient parser (comma/semicolon/newline, dedupe, validation), plain-text body → auto-formatted HTML (paragraphs + auto-linked URLs, punctuation-safe). New `AdminEmailCompose` React component on `/admin` with To/Subject/Body/Sender fields, live recipient counter, and a Preview dialog with sidebar metadata + sandboxed iframe render. XSS-safe (server-side `html.escape` + `sandbox=""` iframe defence in depth). Testing agent: 56/56 pytest + XSS + both senders live-delivered via Resend.
- **[NEW — Feb 26 2026] Charla chatbot widget** embedded in `/app/frontend/public/index.html`. Loads on `window.load`, mounts `<charla-widget p="a677bc38-...">` and pulls `https://app.charla.com/widget/widget.js`. Chat bubble appears bottom-right on every page.
- **[NEW — Feb 26 2026] Super Admin "Log in as Organisation" (impersonation).** New `POST /api/admin/organisations/{slug}/impersonate` returns an org access token when body contains the correct `admin_code`. `AppContext` gains `impersonateOrg(slug)` + `stopImpersonation()` + `impersonatingOrgSlug` state. Per-org "Log in as" button in Admin → Manage organisations (`data-testid="impersonate-org-<slug>"`). OrgDashboard renders a top banner (`data-testid="impersonation-banner"`) while impersonating, with a "Return to admin" button (`data-testid="stop-impersonation-btn"`) that reverts role + clears the impersonation token. Navigation-before-state ordering avoids the `RequireRole` redirect race. Backend endpoint 200/403/404 verified via curl; frontend flow verified end-to-end (impersonate → banner → return).
- **[NEW — Feb 26 2026] Super Admin "Quick Create" dashboard.** `QuickAddContentCard` on `/admin` now includes **five in-place dialogs** — Event, Local feed update, Volunteering opportunity, Organisation, and Venue — each with fields matching the corresponding public page's layout (event: title/org/category/date/time/venue/address/description/cost/age/accessibility/booking/contacts/image/status; org: name/category/short/about/logo/cover/brand colour/email/phone/website/socials/address/meeting; venue: name/address/facilities/capacity/accessibility/booking/image; volunteer: title/org/description/time/age/skills; feed: org/type/title/body/image). Organisations created this way are auto-approved. `Venues.jsx` now reads from `context.venues` (was hardcoded mock) so new venues appear immediately.
- **[NEW — Feb 26 2026] Chatbot context feed (public).** New endpoints for external chatbots (Charla, etc.):
  - `GET /api/chat/context?days=30` — compact JSON snapshot: `{site, events, organisations, venues, volunteering, faqs}`. Events are the next `days` days (max 180) of approved events, each with `{id,title,date,time,venue,address,url,description,organiser}`. Orgs include public contact info + socials. FAQs mirrored from `/app/backend/data/faqs.py` (was frontend-only inline before).
  - `GET /api/chat/context.md?days=30` — same data rendered as Markdown so knowledge-base ingestion (which usually prefers a URL of Markdown) can pull it directly.
  - Site URL uses `PUBLIC_URL` env → `APP_URL` fallback → placeholder.
- **[NEW — Feb 26 2026] Real JWT admin authentication** replacing the launch-code stub.
  - `POST /api/auth/admin/login` (email + password) → bcrypt-verified → returns `{token, user}`. Token is a 12h HS256 JWT.
  - `GET /api/auth/me` — verifies `Authorization: Bearer <jwt>` and returns the user.
  - Brute force protection: 5 failed attempts per `{ip}:{email}` = 15 min lockout via `login_attempts` collection.
  - Idempotent admin seeding on startup from `ADMIN_EMAIL` + `ADMIN_PASSWORD` env (rotates hash if password env changed).
  - Impersonation endpoint `/api/admin/organisations/{slug}/impersonate` now accepts either an admin JWT (`Authorization: Bearer …`, preferred) OR the legacy `admin_code` body (backward compat).
  - Frontend: Admin login modal is now email + password (data-testid `admin-email-input` / `admin-password-input` / `admin-login-submit`); JWT stored in `localStorage['rn-admin-jwt']`; `AppContext` re-hydrates admin session on page reload by decoding & expiry-checking the stored JWT — role, adminUnlocked, adminCodeSession all survive refresh (fixes long-standing "have to re-enter code on every reload" complaint). Axios request interceptor auto-attaches `Authorization: Bearer <jwt>` to all API calls.
  - `_require_org_write_access` now recognises admin JWTs sent via `X-Org-Auth: Bearer …` alongside existing `X-Admin-Code` header + org tokens.
  - Testing: iteration_15 — 11/11 new pytest + 2 previously-failing parser tests now PASS; end-to-end frontend flow (login → reload → impersonate → return) verified green.
- **[FIX — Feb 26 2026] Pre-existing pytest failures resolved.** `TestAdminImageParse::test_image_upload_is_ocrd` and `TestAdminBulkDocumentParse::test_parse_multiple_documents` were failing with `422 list_type` because `files: Optional[List[UploadFile]] = File(None)` didn't wrap a single file in a list under Pydantic v2. Fixed by changing to `files: List[UploadFile] = File(default=[])`.
- **[NEW — Feb 26 2026] Coming Soon launch gate.** New `site_settings` singleton doc (`GET /api/site/settings` public, `POST /api/admin/site/settings` admin-only) with `{coming_soon, launch_at, teaser}` — currently `coming_soon:true`, `launch_at:2026-09-12T09:00:00+00:00`. A new branded `ComingSoon.jsx` page shows to unauthenticated visitors on every route with hero, live countdown to 12/09/26, email subscribe field, embedded Web Wizard enquiry dialog, and both Admin + Org login buttons wired to their respective backends. Admins and org accounts bypass the gate the moment they authenticate — full site renders for them so they can populate/preview ahead of launch. New Admin dashboard "Site mode" card lets the super admin flip the flag, edit launch date/time (datetime-local, UK), and edit teaser copy. New `/api/organisations/{slug}/auth/login` endpoint returns an opaque org access token in exchange for the org password (frontend had been calling this URL but the backend handler was previously missing). `AppContext` role state now rehydrates on refresh from both admin JWT AND org-token+role, so refresh no longer dumps org users back to guest / Coming Soon. Testing agent iteration_16: 8/8 backend pytest + 100% frontend E2E green.
- **[POLISH — Feb 26 2026] Coming Soon page rebalance.** Theme toggle now works (dark ↔ light for the whole gate, persists across reloads). Highlight colour rebalanced: bright neon blue `#0052FF` for main accents (hero word "brilliant", subscribe button with glow, list header) and lime `#D2FF00` reduced to accent duty (Community Alliance Fund badge, bullet arrows). "Run a business?" panel removed; Web Wizard logo now sits in the footer with "This site was created by / The Web Design Wizard" caption — clickable to open the enquiry dialog (contact form remains live).
- **[NEW — Feb 26 2026] Batch A: Funder Impact Dashboard (`/admin/impact`).** New admin-only page + PDF report designed specifically to prove social value to the Community Alliance Fund and support grant renewal.
  - **Backend endpoints**: `GET /api/admin/impact/summary?days=N` (JSON snapshot: unique_residents / orgs / events / volunteer conversions / cost per resident / geography / top orgs), `POST /api/admin/impact/grant-config` (admin sets grant amount + period label), `GET /api/admin/impact/pdf?days=N&variant=short|full` (ReportLab-generated PDF, accepts JWT via header or ?token= query for anchor download).
  - **Metrics**: Unique residents = max(unique device_ids, subscribers, follows). Cost per resident = grant_amount ÷ unique_residents. Volunteer hours estimated at 4h per contact-click × £15/hour standard multiplier. Geographic reach = UK postcode outward codes (e.g. "BL6") extracted from org+event addresses via regex — outward-code only, GDPR-safe. Cross-org engagement = subscribers following >1 org.
  - **Analytics wiring**: New `volunteer_contact` analytics kind added; volunteer 'Get in touch' buttons on `/volunteering` now fire it via `api.trackAnalytics()`. Consolidated `AnalyticsEvent` + `AnalyticsTrackReq` Literals to a shared `AnalyticsKind` type to prevent future drift.
  - **Frontend**: New `Impact.jsx` page — 8 headline tiles, social-value card, editable grant-config card, postcode bar chart, top-org list. Window select (7/30/90/180/365), short + full PDF download buttons.
  - **PDF report**: Blue-and-white ReportLab layout. Short = executive summary + big-number tiles (1 page, board-friendly). Full = adds reach breakdown, geography table, top orgs table, methodology notes (multi-page).
  - Testing agent iteration_17: 11/11 backend pytest + full frontend E2E green.
- **[NEW — Feb 26 2026] Batch B: Public engagement uplift.** Four features shipped together:
  - **Filter chip rows on `/events`** — single-select date chips (Any date / Today / Tomorrow / This weekend / Evening after 6pm) and multi-select accessibility chips (Free, Kids-friendly, Step-free, Wheelchair, Hearing loop, Quiet/sensory). Chip state persists across full-page reloads via localStorage rehydration (lazy `useState` initializer — fixed React strict-mode double-mount race caught by testing agent iter18).
  - **Accessibility filter** now first-class — chips match against `event.accessibility` free-text (`wheelchair`, `step-free`, `hearing loop`, `quiet`/`sensory`).
  - **Reminder emails 24h + 2h before saved events** — new `saved_events` field on `subscribers`. Client auto-syncs on save-toggle via `POST /api/subscribers/saved-events` (matches by email or device_id). Background asyncio loop `_event_reminder_loop` fires every 15 min, scanning approved events in the 24h and 2h target windows (±10 min); sends a branded reminder email via Resend with Google/Outlook/Apple calendar buttons. Idempotency guaranteed by unique index on `event_reminders_sent(email, event_id, kind)`. Admin can trigger a run manually via `POST /api/admin/reminders/run-now`.
  - **Add-to-Calendar buttons in the newsletter digest email** — each event now has Google / Outlook / Apple pill buttons (email-safe inline styles). Same helper (`_gcal_url`, `_outlook_url`) reused by both digest and reminder templates.
  - Testing iteration_18: 7/7 backend pytest + frontend E2E green (1 LS persistence bug found and fixed by self-test).
- **[NEW — Feb 26 2026] Batch C: Organisation power tools.**
  - **Recurring events** — new `EventRecurrence` optional field on `Event` and `EventPatch` (`freq: weekly/biweekly/monthly + until` date OR `count` max instances). Server-side expansion (`_expand_recurring_event`) fans out into virtual instances (id `<parent>__YYYY-MM-DD`) up to 180-day horizon on `GET /api/events` (default). Individual instance lookup via `GET /api/events/<parent>__YYYY-MM-DD` returns an on-the-fly instance with the correct start/end. `EventEdit.jsx` gains a "Repeat this event" section (freq dropdown + until date). One entry now covers weekly Bingo/prayer/clubs.
  - **Event templates (Duplicate)** — new `POST /api/events/{id}/duplicate` clones an event with blanked start/end + `Copy of ` prefix. Admin gets `status=approved`; org gets `status=pending`. "Duplicate" button on every OrgDashboard event card triggers the flow and navigates to the new event's edit page.
  - **Auto-generated posters** — `GET /api/events/{id}/poster.png` (1080×1080 branded PNG with blue gradient, lime accents, wrapped title, date/time, venue, cost/age/accessibility chips, and a QR code linking back to the event page) and `GET /api/events/{id}/poster.pdf` (A4 PDF with the same rendered image centred). PNG≈65KB, PDF≈76KB. Public, no auth required. PNG + PDF pill buttons on every OrgDashboard event card.
  - **Analytics uplift on org dashboard** — new `GET /api/orgs/{slug}/analytics?days=7|30|90` returns per-day series (`event_views/org_views/share_clicks/volunteer_contacts`), totals, and the best-performing event over the window. `OrgDashboard` gains an "Reach for [org name]" panel with 7d/30d/90d toggle, 3-stat cards, SVG sparkline chart, and a "★ Best performing event" callout.
  - Testing iteration_19: 7/7 backend pytest green after single one-line fix (added `recurrence` field to `EventPatch` — caught by testing agent RCA). Frontend E2E all green.
- **[NEW — Feb 26 2026] Batch D (partial): Scheduled broadcasts + Content moderation.**
  - **Scheduled broadcasts** — new `POST /api/admin/broadcasts/schedule` (write now, send at future ISO datetime), `GET /api/admin/broadcasts/scheduled`, `DELETE /api/admin/broadcasts/scheduled/{id}` (cancel), and `POST /api/admin/broadcasts/scheduled/run-now` (manual dispatch). Background `_scheduled_broadcast_loop` runs every 5 min via asyncio.create_task, dispatching any scheduled broadcast whose time has passed via Resend. Admin dashboard "Scheduled broadcasts" card lets you compose + queue + cancel.
  - **Content moderation** — public `POST /api/reports` (kind: event/org/feed/venue/volunteer + reason + optional notes/email + device_id) with per-reporter rate limit of 5/10min. Reusable `<ReportButton>` component ships on event detail and org detail pages. Admin dashboard "Moderation queue" card lists open reports with status filter, and Actioned / Dismiss buttons flip `POST /api/admin/reports/{id}/resolve`.
  - Testing iteration_20: 8/8 backend pytest + 100% frontend E2E green. No critical issues.
- **[FIX — Feb 26 2026] Production deployment `NameError: new_id` blocker resolved.** `AnalyticsEvent` class at line 181 of `server.py` referenced `new_id` as `default_factory`, but the function wasn't defined until line 508 — Python's class-definition-time evaluation failed on import. Preview kept running from an older process, but any restart or fresh deploy would fail. Moved `new_id`/`new_token`/`now_iso` above the model definitions and removed the later duplicates. Also added the missing `_require_org_write_access` stub that was called throughout but never defined (pre-existing latent bug). Backend now imports cleanly; 48/50 pytest pass (2 unrelated pre-existing failures in `/admin/documents/parse` due to Pydantic `List[UploadFile]` handling — flagged as P2 backlog).
- **[FIX — Feb 14 2026] Mobile responsive scaling.** User reported the site didn't scale to device. Root causes (all now fixed + regression-tested at 320/360/390/1440px):
  - Admin org-list grid rows overflowed 88px on mobile — CSS Grid children default to `min-width: auto` which prevented `truncate` from working on long org names. Fixed with `min-w-0` on grid items + `shrink-0` on avatar/Edit button.
  - OrgDashboard header action row overflowed 134px — `<select data-testid="org-switcher">` couldn't shrink and the row didn't wrap. Fixed with `flex-wrap` + `flex-1 sm:flex-none min-w-0 max-w-full truncate` on the select.
  - NewsletterSection form overflowed ~16px — email `<input>`'s intrinsic min-width exceeded its grid slot. Fixed with `min-w-0` on both grid children + input, and `shrink-0` on the Subscribe button.
  - Notification bell dropdown was clipped off-screen left on mobile (was `absolute right-0 w-80` = 320px anchored to a bell that had moved to the left of a wrapped header row). Fixed with responsive positioning: `fixed left-4 right-4 top-auto mt-2 sm:absolute sm:left-auto sm:right-0 sm:w-80` — fills viewport on mobile, reverts to compact anchored dropdown on ≥640px.
  - /events filter grid overflowed 8px at 360px — 3 `<select>`s and the search wrapper needed `min-w-0` on their grid slots. Fixed.
  - Added global `overflow-x: hidden` on `html` + `body` in index.css as a safety net for future latent overflows.
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
- Connect Charla widget to `/api/chat/context.md` in its dashboard (backend feed is now live — just needs to be wired in the Charla admin UI).
- Real JWT admin auth is now live for the Super Admin role. Extend the same pattern to organisations (per-org account login) as a follow-up.
- Auth guard on the new image upload endpoints (currently public — flagged in iteration_3 code review).

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
