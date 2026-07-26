# DNS

## Required records

The Domoforge VPS public IPv4 address observed on 2026-07-26 is `66.179.210.180`. Configure these records at the authoritative DNS provider:

| Type | Name                        | Value            | Cutover TTL |
| ---- | --------------------------- | ---------------- | ----------- |
| A    | `matemyparty.domoforge.com` | `66.179.210.180` | 300 seconds |
| A    | `raymundo6th.domoforge.com` | `66.179.210.180` | 300 seconds |

After 24 hours of stable HTTPS operation, a TTL of 3600 seconds is appropriate.

Do not create AAAA records. This VPS currently has only a link-local IPv6 address and cannot accept globally routed IPv6 traffic. Remove the existing AAAA records that point to `2607:f1c0:100f:f000::200` during cutover.

The records observed before deployment pointed both names to `74.208.236.82` and `2607:f1c0:100f:f000::200`. Those addresses belong to the previous destination and block certificate issuance on this VPS.

## Verification

Check two independent public resolvers and the authoritative nameservers:

```bash
dig +noall +answer A matemyparty.domoforge.com @1.1.1.1
dig +noall +answer A raymundo6th.domoforge.com @8.8.8.8
dig +noall +answer AAAA matemyparty.domoforge.com @1.1.1.1
dig +noall +answer AAAA raymundo6th.domoforge.com @8.8.8.8
dig +short NS domoforge.com
```

Both A answers must be `66.179.210.180`; both AAAA answers must be empty. Allow cached records to expire before requesting TLS.

## Hostname responsibilities

- `matemyparty.domoforge.com` is the generic product entry point.
- `raymundo6th.domoforge.com` is the custom hostname for the seeded Raymundo birthday event.
- Nginx sends both names to the same Next.js process and preserves the original `Host` header.
- Next.js resolves the generic host to the landing page and the birthday host through the API-backed hostname mapping.

DNS contains no application secrets. DNS changes must be made through the existing authoritative provider account; no DNS credentials are stored in this repository.
