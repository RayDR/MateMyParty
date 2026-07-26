# Private invitation media

The Raymundo birthday invitation expects private media at these public application URLs:

- `/private-media/raymundo-6/dragons-intro.mp4`
- `/private-media/raymundo-6/dragons-theme.mp3`

Do not commit these files to GitHub.

## Server location

Upload the files directly on the deployment host to a persistent directory outside the repository:

```text
/forge/matemyparty-private-media/raymundo-6/dragons-intro.mp4
/forge/matemyparty-private-media/raymundo-6/dragons-theme.mp3
```

Mount or map that directory so the web application serves it as:

```text
/private-media/raymundo-6/
```

For a container deployment, use a read-only volume mapping equivalent to:

```yaml
volumes:
  - /forge/matemyparty-private-media:/app/apps/web/public/private-media:ro
```

The exact container destination may need to match the production image working directory.

## Required formats

Use an H.264/AAC MP4 for the widest browser compatibility. The audio fallback should be MP3. Keep file names exactly as listed above.

The experience starts only after the visitor presses the entry button. If the video cannot load or play, the page switches to the Night Fury pulse animation and plays the audio fallback.

## Privacy and indexing

The application sends these headers for invitation and private-media routes:

```text
X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
Cache-Control: private, no-store, max-age=0
```

These headers discourage search indexing and shared caching, but they are not access control. Invitation URLs must remain tokenized and unlisted. A future hardening step should serve media through an authenticated or signed endpoint instead of a predictable public path.

## Cleanup

After the private event, remove `/forge/matemyparty-private-media/raymundo-6` and replace the temporary theme with a distributable theme pack.
