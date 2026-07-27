# Security

## Token handling

Invitation tokens contain 256 bits of cryptographic randomness and use base64url encoding. The raw value is returned only from create or regenerate operations. Only SHA-256 and a non-reconstructive eight-character diagnostic prefix are stored. Raw tokens must not appear in application logs, activity metadata, analytics, or error responses.

Possession of a link grants access to its public invitation. A shared or forwarded link therefore shares that access. Revocation is the current response to disclosure; regeneration revokes the old credential and creates a new one.

## Public and private data

The event root uses a dedicated `PublicEventLanding` contract. It contains only the public slug/lookup identifier, default locale, primary hostname, localized promotional copy, and presentation references. Date, time, time zone, venue, address, maps, arrival information, guest data, party size, invitation state, and RSVP state do not cross this API boundary.

`PrivateInvitation` is returned only after a valid permanent token or temporary lookup grant is resolved. It contains the localized event details and invited party size required for rendering, while excluding guest email, phone, private notes, invitation/database IDs, hashes, prefixes, and owner data. Personalized routes are `noindex` and `no-store`; social metadata can use localized event-level fields but never guest personalization or party size. Invalid permanent tokens and invalid, expired, or revoked grants use the same neutral page and metadata.

Host contracts intentionally include contact and operational data. They are available only through bearer-protected API routes or the temporary server-side web proxy.

Invitation candidate and public-detail queries exclude both revoked invitations and archived guests. Archiving therefore immediately makes an otherwise valid link resolve to the same neutral 404 used for unknown or revoked credentials. Restoring is a protected host action. Creating or regenerating an invitation for an archived guest is rejected.

## Secure invitation lookup

Lookup requires the invited display name plus either the complete registered email or complete registered mobile phone. Names and emails are trimmed, whitespace/case normalized, and compared exactly. Phone punctuation is removed consistently while preserving an explicitly supplied leading `+`; the application never invents a country code. Name-only, malformed, nonmatching, archived-guest, and revoked-invitation cases all return `{ "verified": false }` without identifying which field failed.

The API rate limits attempts by an HMAC of the request address using a process-random key. Raw addresses and lookup values are not retained by the limiter or written to application logs. The public browser submits to a same-origin Next handler; production Nginx does not expose `/api/invitations/*`, so lookup bodies and credential-bearing resolution paths bypass public access logs. Global cross-origin API access is disabled.

A successful match creates an `InvitationAccessGrant` valid for 12 minutes. Its 256-bit raw token is returned once to the server-side web handler and stored in a Secure, HttpOnly, SameSite=Strict cookie. PostgreSQL stores only SHA-256, an eight-character diagnostic prefix, lookup method, timestamps, and invitation relation—never the name, email, phone, raw grant, or permanent invitation token. Expiration and revocation are checked inside the render transaction; invitation revoke/regenerate revokes related grants. Expired grants are removed opportunistically after a retention buffer.

Lookup itself does not record an open. Open counters and `OPENED` activity change only when `/invitation` or `/i/{token}` successfully renders the private contract. The grant can be reused during its short session lifetime and records `last_used_at`; it does not recover or rotate the permanent invitation token.

The host sharing preview contains event-level presentation only. A raw link can exist temporarily in browser memory after creation or regeneration so the host can copy it, but it is never placed in local storage, persisted by the API, recovered from the hash, or included in event metadata. Invalid and revoked routes receive product-level metadata only; every invitation page remains `noindex`.

The presentation preview is protected by the same host session and API guard as event editing. It uses synthetic guest data, never accepts a real invitation credential, and never calls open tracking. Its public/private, locale, viewport, media-disabled, and reduced-motion controls are preview state only.

## Temporary host protection

`HOST_ADMIN_TOKEN` is a shared development secret, not user authentication. Nest compares it with timing-safe operations. Production startup rejects missing, short, and known example values. The web application never exposes the token to client JavaScript: its access form is handled server-side, a derived HMAC session is stored in an HttpOnly, SameSite=Strict cookie, and Next route handlers attach the API bearer token server-side.

The mechanism has no users, roles, per-event grants, session revocation list, rate limit, or second factor. Replace it with authenticated users, rotating sessions, CSRF review, and event ownership authorization before a public host launch.

The temporary dashboard lists every event available to the shared host context. Public slugs and random event codes keep UUIDs out of visible navigation, but they are identifiers rather than authorization credentials. The API guard remains mandatory for list, detail, statistics, update, guest, and invitation operations.

`GET /host/access` contains only the password form. `POST /host/access` is handled server-side, derives the session cookie, and builds redirects from the validated forwarded host with HTTPS forced in production. `HOST_ADMIN_TOKEN` must never be included in HTML, browser JavaScript, URLs, local storage, response bodies, or logs.

Event updates accept only shared-contract fields, supported locales, allowed template keys, valid date ordering, bounded overlay values, HTTPS media URLs, or protected event-media paths. Every successful update and its revision snapshot are committed transactionally.

## Open tracking and logging

Invitation activity can store a user agent truncated to 160 characters, one supported requested locale, and a referrer hostname. It does not store full referrer URLs or IP addresses. Infrastructure access logs must redact `/i/*` path segments because the URL itself contains a credential. Application code must never log request parameters for invitation routes.

## Recommendations before public exposure

- Terminate TLS and set `PUBLIC_APP_PROTOCOL=https`.
- Generate a unique high-entropy `HOST_ADMIN_TOKEN`; do not reuse the documented local value.
- Redact invitation paths in CDN, reverse-proxy, APM, and error-reporting logs.
- Replace the in-process lookup limiter with a shared limiter before horizontally scaling the API.
- Add rate limits for host access attempts.
- Add real authentication and event-level authorization.
- Define token rotation, incident response, retention, and privacy policies.
- Review CSP, CSRF posture, secure headers, dependency advisories, backup encryption, and database access controls.
- Avoid third-party scripts on personalized invitation pages unless their privacy impact is explicitly accepted.

## Current limitations

There is no RSVP, delivery verification, real user authentication/authorization, tracking-cookie deduplication, bot filtering, or distributed abuse protection. Every valid private render counts as an open, including link scanners. These constraints are intentional for the milestone and must remain visible in operational decisions.
