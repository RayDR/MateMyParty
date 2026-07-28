# Transactional invitation email

MateMyParty owns a provider-neutral `EmailProvider` boundary in the API. The first production adapter uses authenticated SMTP; development and tests use a non-delivering stub. Provider selection and all credentials are server-only environment values.

## Host workflow

The guest panel shows email eligibility, the last safe attempt status and time, and a retry action when applicable. A host can:

- preview the localized responsive HTML at desktop or mobile width without creating a token;
- send a provider test message using a placeholder link without creating a guest attempt;
- generate and send the first invitation;
- explicitly rotate an existing or revoked invitation and send the new link;
- retain manual copy-link sharing; and
- see SMS as unavailable without any false sent state.

Only published, non-archived events and guests with an email-compatible preferred channel are eligible. Existing invitation links must be rotated because raw invitation tokens are intentionally not stored. The confirmation in the UI makes that invalidation explicit.

## Protected endpoints

Every endpoint below requires the existing host bearer guard. Browser calls use the authenticated `/internal/host/*` server proxy, which adds the bearer token. POST endpoints additionally require the exact `X-MMP-CSRF: 1` marker at both proxy and API boundaries.

| Method | API path                                               | Purpose                                                             |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------- |
| `GET`  | `/api/host/guests/:guestId/email/preview?locale=en-US` | Render with a non-functional placeholder; no token or attempt       |
| `GET`  | `/api/host/guests/:guestId/email/deliveries`           | Return bounded safe attempt history                                 |
| `POST` | `/api/host/guests/:guestId/email/send`                 | Generate/rotate, queue, and send one invitation                     |
| `POST` | `/api/host/events/:identifier/email/test`              | Send the template to a host-supplied destination without an attempt |
| `GET`  | `/api/host/events/:identifier/email/statistics`        | Return eligible and per-status counts                               |

Send bodies use a client-generated UUID `idempotencyKey` plus explicit `regenerate` and `overridePreferredChannel` booleans. Unknown properties are rejected. The normal host UI never overrides the preferred channel. Public contracts expose safe status categories but omit recipient fingerprints and provider message identifiers.

## Persistence and lifecycle

Migration `0008_fancy_yellow_claw.sql` adds `email_delivery_attempts` and the email channel/status enums. Attempt rows reference event, guest, and invitation; include a per-guest attempt sequence and globally unique idempotency key; and store subject/template snapshots, timestamps, retryability, a recipient SHA-256 fingerprint, and bounded safe failure categories.

The lifecycle is `QUEUED → SENDING → SENT`; authenticated delivery events may later transition `SENT → DELIVERED`. SMTP acceptance is only `SENT`. Rejections and safe adapter failures transition to `FAILED`. `CANCELLED` and `DELIVERED` are represented for a provider-neutral lifecycle but are not fabricated by the SMTP adapter.

Invitation generation/rotation and attempt insertion share one database transaction under a per-guest row lock. A second non-idempotent request is blocked while the latest attempt is queued or sending. Repeated requests with the same key return the original result and do not call the provider twice. The provider call runs outside the transaction under bounded process concurrency. Startup recovery marks stale sending attempts as retryable failures after 15 minutes.

## Privacy and operations

Templates escape event-controlled text, reject header newlines, accept only HTTPS invitation URLs, and include only explicitly public thumbnails. SMTP disables URL/file attachment loading and debug logging. Raw recipient addresses, message bodies, private links, credentials, and provider exceptions are never written to attempt rows or application logs.

Production configuration and recovery commands are documented in [deployment.md](deployment.md) and [operations.md](operations.md). Security properties are summarized in [security.md](security.md).
