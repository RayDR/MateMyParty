# Secure invitation lookup

The public birthday homepage exposes only the celebrant name and age. Schedule, venue, address, guest, invitation, and RSVP data remain available only through a permanent private invitation or a verified short-lived access grant.

Lookup requires an exact normalized match on both the invited display name and either the full email address or full phone number. Every failed verification receives the same public message. The API rate-limits attempts by a one-way hash of the client address and never logs submitted lookup values.

Successful verification creates a cryptographically random 256-bit grant valid for ten minutes. PostgreSQL stores only its SHA-256 hash and invitation association. Creating another grant revokes the previous active grant. The original permanent invitation token remains hash-only and is neither recovered nor regenerated.

Grant URLs use `/a/<opaque-grant>`. Nginx and Next.js suppress access logging for grant and permanent-token paths, and both routes return private no-store and noindex headers.

The `/host/access` protection remains deliberately temporary. After a valid host token is verified server-side, `/host/events` lists the events available through the protected API and links to guest management. The generic MateMyParty portal should eventually replace this with authenticated user accounts and list every event owned by the signed-in user.
