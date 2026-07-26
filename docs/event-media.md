# Event media references

This milestone stores safe media references; it does not provide unrestricted uploads or object storage.

## Supported references

Event thumbnail, background, video, fallback, and audio fields accept either:

- an HTTPS URL; or
- a protected path below `/private-media/<public-slug>/`.

Raymundo's existing media uses:

```text
/private-media/raymundo-6/dragons-intro.mp4
/private-media/raymundo-6/dragons-theme.mp3
```

The corresponding VPS files remain outside Git:

```text
/forge/matemyparty-private-media/raymundo-6/dragons-intro.mp4
/forge/matemyparty-private-media/raymundo-6/dragons-theme.mp3
```

Do not place private media, invitation credentials, or database secrets in the repository. Nginx owns the path-to-file mapping and privacy headers. The parent and event directories use owner `sysops`, group `www-data`, no permissions for others, and may retain the setgid bit (`02750`). The MateMyParty service user does not receive direct filesystem access.

## Deferred work

Managed uploads, image transformations, malware scanning, storage quotas, object-storage providers, signed media access, and lifecycle deletion are intentionally deferred. Adding any upload flow requires a separate threat model and authorization review.
