# Blackrod Now Facebook event publishing

Blackrod Now publishes approved/current events to the **Blackrod Now** Facebook Page through the Meta Pages API.

## Backend secrets

Configure these in the backend deployment environment. Never place the Page token in frontend/React variables, source code, GitHub, logs, or screenshots.

- `FACEBOOK_PAGE_ACCESS_TOKEN` — required. Paste the fresh Page access token directly into the deployment secret manager.
- `FACEBOOK_PAGE_ID` — optional; defaults to `1340129215839919` (Blackrod Now).
- `FACEBOOK_GRAPH_API_VERSION` — optional; defaults to `v26.0`.
- `FACEBOOK_AUTO_PUBLISH_ENABLED` — optional; defaults to `true`.
- `FACEBOOK_AUTO_PUBLISH_POLL_SECONDS` — optional; defaults to `20` and has a minimum of 10 seconds.

## Behaviour

- Events that are newly created as `approved` after the backend starts are posted automatically.
- Existing pending/draft events that transition to `approved` while the backend is running are posted automatically.
- Existing approved events are deliberately **not** dumped to Facebook on deployment. Admins select those from **Admin → Global event management → Facebook publishing**.
- Past events are excluded.
- Recurring events are promoted once, using the parent event and recurrence end date to determine whether they are still current.
- A MongoDB atomic lock plus the stored `facebook_post_id` prevents duplicate posts.
- Facebook failures never block event approval. The event records `facebook_post_status=error` and a sanitised error message for retry/diagnostics.
- The access token is read server-side only and is never returned from the admin API.

## Admin endpoints

All endpoints require the normal Blackrod Now admin JWT or legacy `X-Admin-Code` authentication.

- `GET /api/admin/facebook/status`
- `GET /api/admin/facebook/events`
- `POST /api/admin/facebook/events/{event_id}/publish`
- `POST /api/admin/facebook/publish-current` with `{ "event_ids": ["..."] }`

## Post format

Posts include the event title, date/time, venue, a short description, the canonical Blackrod Now event link and the Blackrod Now tagline. The link sent to Meta uses the existing event Open Graph endpoint so Facebook can render the event image/card where available.
