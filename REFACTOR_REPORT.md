# Refactor Report

## Completed

- Extracted the original inline CSS into cascade-preserving CSS files.
- Extracted the original inline JavaScript into ordered Vanilla JS files grouped by app, core, infrastructure, shared, mock, and feature ownership.
- Extracted embedded MP4/PDF Base64 payloads into `frontend/public/demo`.
- Preserved original localStorage keys and initialization flow.
- Moved the browser app to `frontend/`.
- Added a FastAPI skeleton under `backend/`.
- Moved the temporary local server to `tools/reference_server/server.py`.
- Moved repo-level smoke checks to `scripts/verify_structure.py`.
- Added `compose.yaml` for local frontend/API/Postgres development.
- Added backend schema contracts before endpoint implementation.
- Aligned schema decisions with the current frontend: progress `0..100`, review `good/again`, import `file`, UUID canonical ids, and legacy migration ids/timestamps.

## Verification

- Python syntax checks for backend, scripts, and reference server.
- JavaScript syntax checks for frontend files referenced by `index.html`.
- CSS import resolution and brace-balance checks.
- Verification that embedded MP4/PDF Base64 payloads no longer remain in HTML/CSS/JS.
- Schema modules import successfully under the backend package.

## External Runtime Note

YouTube playback/caption extraction, translation endpoints, PDF.js CDN loading,
Iconify, and first-run OCR models depend on external services and network
availability, as they did in the original project. Install `yt-dlp` from
`tools/reference_server/requirements.txt` before testing the temporary caption
bridge.
