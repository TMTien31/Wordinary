# Wordinary Production Runbook

This runbook covers the single-server Docker Compose production deployment.

## Files On The Server

Expected layout:

```text
~/Wordinary/
  .env
  compose.prod.yaml
  youtube-cookies/cookies.txt
```

`.env` is private server state. Do not commit it.

`youtube-cookies/cookies.txt` is private browser cookie state. Do not commit it.

## Deploy

Deployments are normally handled by GitHub Actions on pushes to `main`.

The workflow:

1. Runs the quality gate.
2. Builds ARM64 backend and frontend images.
3. Verifies backend runtime dependencies such as Deno and yt-dlp.
4. Pushes both short-SHA and `latest` image tags.
5. SSHes into the server.
6. Checks out the exact deploy commit.
7. Pulls and recreates Docker Compose services with `IMAGE_TAG`.
8. Verifies running containers use the exact short-SHA image tag.

Manual server check:

```bash
cd ~/Wordinary
docker compose --env-file .env -f compose.prod.yaml ps
curl --fail http://127.0.0.1:5500/ >/dev/null
curl --fail http://127.0.0.1:5500/api/v1/captions/health
```

## YouTube Cookies

When YouTube rejects caption requests, export fresh cookies from a browser session that can play the target video.

Place the file on the server:

```text
~/Wordinary/youtube-cookies/cookies.txt
```

Then restart the API:

```bash
cd ~/Wordinary
docker compose --env-file .env -f compose.prod.yaml restart api
```

Verify from inside the container:

```bash
docker compose --env-file .env -f compose.prod.yaml exec api sh -lc '
which deno
deno --version
python -m yt_dlp --version
test -s "$WORDINARY_COOKIES_FILE"
'
```

## Backups

Before inviting real users, make sure these are backed up:

- Postgres volume: `wordinary_postgres_data`.
- MinIO volume: `wordinary_minio_data`.
- Server `.env`.

Suggested minimal database backup:

```bash
cd ~/Wordinary
docker compose --env-file .env -f compose.prod.yaml exec -T db \
  sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "backup-wordinary-$(date +%Y%m%d-%H%M%S).sql"
```

Test restoring backups on a non-production machine before relying on them.

## Production Config

The API refuses to start with unsafe production defaults when `ENVIRONMENT=production`.

Check these values in `.env`:

- `AUTH_SECRET_KEY` is unique and long.
- `DATABASE_URL` does not contain placeholder/default credentials.
- `STORAGE_ACCESS_KEY` and `STORAGE_SECRET_KEY` are real MinIO credentials.
- `STORAGE_BUCKET` is not `wordinary-dev`.
- `BACKEND_CORS_ORIGINS` contains only production origins.

## First-User Smoke Test

Run this after deploy:

1. Sign up a new test account.
2. Import an article, save a word, and review it.
3. Upload a small PDF, close it, reopen it from Library, and confirm it loads after the spinner.
4. Open a YouTube URL with captions and confirm transcript rows appear.
5. Delete the test library items.
