# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Domoforge VPS deployment and operations runbooks.
- Loopback-bound systemd units for the API and web application.
- Daily PostgreSQL backup service and timer with seven-day local retention.
- Fail-fast deployment automation with validation, pre-migration backup, and health checks.
- DNS and backup-and-restore documentation.

### Changed

- Moved the production web listener to `127.0.0.1:3200` to avoid an unrelated service on port 3000.
- Replaced the public-prefixed API origin with the server-only `INTERNAL_API_BASE_URL`.
- Hardened Nginx routing, no-store responses, and access-log privacy for invitation URLs.

### Planned

- RSVP management.

## [0.1.0] - 2026-07-26

### Added

- MateMyParty pnpm and Turborepo foundation with Next.js and NestJS/Fastify.
- PostgreSQL and Drizzle schema, versioned migrations, and idempotent seed.
- Data-driven event and hostname resolution for the first birthday event.
- English (United States) and Spanish (Mexico) internationalization.
- Guest management, secure individual invitations, and invitation activity history.
- Personalized noindex invitation pages and initial open tracking.
- Temporary bearer-protected host API and HttpOnly host panel session.
- Docker Compose development topology, CI, dependency automation, and VPS deployment examples.

[Unreleased]: https://github.com/RayDR/MateMyParty/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RayDR/MateMyParty/releases/tag/v0.1.0
