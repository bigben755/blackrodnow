# BlackrodLife — PRD

## Original Problem Statement
A modern, youth-friendly community website for Blackrod, Bolton — events, clubs, organisations, schools, local businesses, community projects, volunteer opportunities and local news. Tagline: *"Everything happening in Blackrod — events, groups, clubs, causes and local life."* It should feel like a local social/event discovery platform, NOT a council site or directory.

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind 3 + shadcn-ui + sonner toasts. SPA prototype with all CRUD state held in `AppContext` (in-memory) seeded from `/app/frontend/src/data/mockData.js`.
- **Backend**: FastAPI; only real endpoint backing the app is `/api/parse-content` for the "Upload Once, Publish Everywhere" AI feature (Claude Sonnet 4.5 via `emergentintegrations` + Emergent universal key, with a regex fallback). MongoDB used for `/api/status` only.
- **Theme**: Electric blue (#0052FF) + lime green (#D4FF00) accents, navy/charcoal headings, Outfit display + Plus Jakarta Sans body, light/dark toggle.

## User Personas
- **Resident** — discovers events, follows orgs, signs up to the weekly digest.
- **Young person / DofE participant** — finds clubs and volunteer opportunities.
- **Organisation admin** — manages their profile, publishes events & updates via the AI tool.
- **Site admin** — approves submissions, features content, manages everything.

## Core Requirements (Static)
- Homepage with hero, what's-on-this-week, featured events, AI feature, featured orgs, community/business spotlights, volunteer opps, newsletter.
- Events calendar with month + list view, search & filters, individual event pages, calendar export buttons.
- Organisation directory with filters; branded profile pages with about/events/updates/volunteer/contact/social.
- Submit-event + add-organisation forms (pending approval).
- Admin dashboard (stats, approve/reject, feature, delete).
- Organisation dashboard with the **"Upload Once, Publish Everywhere"** AI tool.
- Local feed (community posts), venues directory, volunteer opportunities, notification preferences.
- Light/dark toggle, mock role switcher (guest/admin/org/contributor).

## Implemented (Feb 2026)
- All 13 pages built and routed.
- Bento-grid hero, distinctive lime + blue + coral palette, NOT-AI-slop visual identity (per design_guidelines.json).
- AI parser endpoint `POST /api/parse-content` working with Claude Sonnet 4.5 (verified — returns full ParsedSuggestion JSON in ~8s) + regex fallback if LLM fails.
- Event/Org submission flows write to in-memory state and appear in admin pending queues.
- Add to Google Calendar (real TEMPLATE URL) + Outlook (real deeplink) + Apple Calendar (placeholder) + native Share.
- Follow organisation, notification preferences, newsletter capture (counter).
- 100% testing-agent pass (5/5 backend pytest, all frontend flows).

## Tests
- Backend: `/app/backend/tests/backend_test.py` (5 pytest cases — health, status CRUD, parse-content empty/event/update).
- Manual UI: `data-testid` coverage across every interactive element.

## Prioritised Backlog
**P1**
- Persist AppContext to localStorage so reloads don't reset pending submissions, follows, notification prefs.
- Real auth (JWT or Emergent Google Auth) replacing role switcher.
- Real file upload for logos/covers (object storage).
**P2**
- Implement real `.ics` download for Apple Calendar.
- Real social posting (Meta Graph API for FB/IG).
- Convert mock data → persistent MongoDB collections with REST endpoints.
- Search across the whole site (orgs + events + feed) from the navbar.
- Browser push notifications (real service worker).
**P3**
- Localisation of dates/times for hard accessibility readers.
- Admin analytics (real metrics, not placeholder tiles).
- Multi-org switcher tied to user account.
