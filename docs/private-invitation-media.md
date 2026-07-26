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

The VPS Nginx site maps that directory read-only with an `alias` and serves it as:

```text
/private-media/raymundo-6/
```

Create the directories so only the operator can write and the Nginx group can read:

```bash
sudo install -d -m 0750 -o sysops -g www-data /forge/matemyparty-private-media
sudo install -d -m 0750 -o sysops -g www-data \
  /forge/matemyparty-private-media/raymundo-6
```

After upload, keep media read-only to Nginx and inaccessible to the application service account:

```bash
sudo chown sysops:www-data \
  /forge/matemyparty-private-media/raymundo-6/dragons-intro.mp4 \
  /forge/matemyparty-private-media/raymundo-6/dragons-theme.mp3
sudo chmod 0640 \
  /forge/matemyparty-private-media/raymundo-6/dragons-intro.mp4 \
  /forge/matemyparty-private-media/raymundo-6/dragons-theme.mp3
```

Upload the files from an operator workstation with:

```bash
scp /local/path/dragons-intro.mp4 \
  sysops@domoforge.com:/forge/matemyparty-private-media/raymundo-6/
scp /local/path/dragons-theme.mp3 \
  sysops@domoforge.com:/forge/matemyparty-private-media/raymundo-6/
```

Nginx disables directory listing and access logging for `/private-media/`. Missing files return `404` with the privacy headers below. The Next.js service does not need filesystem access to the media directory.

## Required formats

Use an H.264/AAC MP4 for the widest browser compatibility. The audio fallback should be MP3. Keep file names exactly as listed above.

The experience starts only after the visitor presses the entry button. If the video cannot load or play, the page switches to the Night Fury pulse animation and attempts the audio fallback. Visible controls allow the visitor to play, pause, and mute media. The page remains usable if both files are absent.

## Privacy and indexing

The application sends these headers for invitation and private-media routes:

```text
X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
Cache-Control: private, no-store, max-age=0
```

These headers discourage search indexing and shared caching, but they are not access control. Invitation URLs must remain tokenized and unlisted. A future hardening step should serve media through an authenticated or signed endpoint instead of a predictable public path.

## Cleanup

After the private event, remove `/forge/matemyparty-private-media/raymundo-6` and replace the temporary theme with a distributable theme pack.
