# Security

## Token handling

Invitation tokens contain 256 bits of cryptographic randomness and use base64url encoding. The raw value is returned only from create or regenerate operations. Only SHA-256 and a non-reconstructive eight-character diagnostic prefix are stored. Raw tokens must not appear in application logs, activity metadata, analytics, or error responses.

Possession of a link grants access to its public invitation. A shared or forwarded link therefore shares that access. Revocation is the current response to disclosure; regeneration revokes the old credential and creates a new one.

## Public and private data

The public contract contains public event presentation, guest display name, invitation state, locale, prior-open indication, and disabled capability flags. It excludes guest/invitation UUIDs, email, phone, notes, token material, owner data, and activity details. Personalized pages use `noindex`, neutral metadata, and no guest name in social previews.

Host contracts intentionally include contact and operational data. They are available only through bearer-protected API routes or the temporary server-side web proxy.

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
- Add rate limits for public token lookup and host access attempts.
- Add real authentication and event-level authorization.
- Define token rotation, incident response, retention, and privacy policies.
- Review CSP, CSRF posture, secure headers, dependency advisories, backup encryption, and database access controls.
- Avoid third-party scripts on personalized invitation pages unless their privacy impact is explicitly accepted.

## Current limitations

There is no RSVP, delivery verification, authentication, authorization, tracking-cookie deduplication, bot filtering, or automated abuse protection. Every valid GET counts as an open, including link scanners. These constraints are intentional for the milestone and must remain visible in operational decisions.
