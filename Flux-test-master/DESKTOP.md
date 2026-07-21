# Flasqo Desktop

Flasqo packaged as a native desktop app for **macOS, Windows and Linux** — like Postman,
but with the full Flasqo automation suite (functional, smoke, performance, chaos, fuzz,
regression, contract, GraphQL, flow builder…) plus a new **manual Request Builder** and a
**built-in offline test library**.

## What was added (turning the web app into a desktop app)

Everything below was layered on top of the existing web app; the cloud/web build is
unchanged (still Postgres + Google/GitHub OAuth) — the desktop behaviour only turns on
when the backend runs with `FLASQO_LOCAL=1`.

| Area | What / where |
|---|---|
| Local desktop mode | `backend/backend.py` — `FLASQO_LOCAL=1` switches DB to SQLite, disables login (built-in `local` user, `/auth/local`), serves the built UI as an SPA. JSONB columns made cross-dialect. |
| Electron shell | `desktop/main.js` + `desktop/package.json` — spawns the backend sidecar, waits for health, opens the window, shuts the backend down on quit. |
| Backend sidecar | `backend/flasqo-backend.spec` + `backend/requirements-desktop.txt` — PyInstaller bundle (no Postgres/Streamlit/Playwright). |
| Native app shell | `frontend/src/DesktopShell.jsx` — persistent left icon rail on every route. |
| App home | `frontend/src/AppHome.jsx` + `SuitesPage.jsx` — replace the marketing landing in desktop mode. |
| Manual API client | `backend/request_builder.py` + `frontend/src/RequestBuilderApp.jsx` — the Postman-style Request Builder. |
| Offline test library | `backend/test_library.py` — 100+ ready-made tests, no API cost, wired into the functional flow (`frontend/src/App.jsx`). |
| Cloud account (hybrid) | `backend/cloud_account.py` + `frontend/src/AccountApp.jsx` — optional sign-in to flasqo.com; local testing stays local. |
| CI installers | `.github/workflows/desktop-build.yml` — builds macOS (arm64+x64), Windows and Linux on a tag push. |

## Architecture

```
┌──────────────────── Flasqo.app / Flasqo.exe / Flasqo.AppImage ─────────────────────┐
│  Electron shell (desktop/main.js)                                                  │
│    └─ spawns sidecar → flasqo-backend (PyInstaller-bundled FastAPI)                 │
│         • FLASQO_LOCAL=1  → no login, built-in "local" user                         │
│         • SQLite storage in the OS user-data dir (no Postgres needed)               │
│         • serves the built React UI at http://127.0.0.1:<port>/                     │
│    └─ BrowserWindow loads that URL                                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Nothing is OS-specific except process paths in `main.js` (Windows `.exe` naming, Windows
vs. Unix shutdown). PyInstaller compiles a native backend binary on whichever OS runs the
build, so each platform ships its own correct sidecar.

Key backend env vars:

| Var | Meaning |
|---|---|
| `FLASQO_LOCAL=1` | Desktop mode: SQLite, no auth, serve static UI, `/auth/local` endpoint |
| `FLASQO_DATA_DIR` | Where SQLite DBs live (default `~/.flasqo`) |
| `PORT` | Backend port (Electron picks a free one, prefers 8765) |
| `OPENAI_API_KEY` | Optional — enables the AI test-generation features |

## Native app shell

In desktop mode the app no longer shows the marketing website. A persistent
**icon rail** (`DesktopShell.jsx`) is mounted on every route — Home, Request Builder,
Test Suites, History, Flow Builder, Settings — so it reads as an application, not a
web page. The home route renders an app dashboard (`AppHome.jsx`) instead of the
marketing landing, and `/suites` (`SuitesPage.jsx`) is a clean launcher for the 13
test suites. Non-desktop (web) builds are unchanged.

## Three ways to build tests

Every test-suite flow now offers three sources you can mix:

1. **Manual** — write each case yourself.
2. **AI** — generate a suite from your endpoint (needs `OPENAI_API_KEY`).
3. **Built-in library** — `backend/test_library.py`, a curated OFFLINE directory of
   100+ tests across 12 packs (HTTP methods, CRUD, validation, boundary, edge cases,
   SQL injection, XSS/SSTI, injection suite, auth/access, headers/content, paging,
   rate-limit/idempotency) plus one-click bundles (essentials / security / full_owasp /
   everything). **Zero API cost.** Endpoints: `GET /library/catalog`, `POST /library/generate`.
   Wired into the Functional testing flow as green "Built-in Test Library" bundle buttons.

## Cloud account (hybrid — optional sign-in)

The desktop app is local-first: it works fully offline with no login. Signing in to a
**flasqo.com** account is optional and lives on the **Account & Settings** screen (rail gear
icon / avatar). It does NOT change how testing runs — every request and test suite still
executes locally.

`backend/cloud_account.py` proxies account calls from the local backend to flasqo.com, so:
- the renderer (origin `127.0.0.1`) never hits flasqo.com directly — no CORS issues
- the cloud token is stored in SQLite (`account.db`) and persists across launches
- if flasqo.com is unreachable, the app keeps working and shows the last-known account (`stale`)

Endpoints (mounted at `/account`, target set by `FLASQO_CLOUD_API`, default `https://flasqo.com`):
`GET /account/session`, `POST /account/login`, `POST /account/signup`,
`PUT /account/profile`, `GET /account/subscription`, `POST /account/logout`.

**Subscription is stubbed.** There is no billing system in the codebase or on the server yet,
so every account reports the **Free** plan (`_plan_for()` in `cloud_account.py`). The Account
screen shows a subscription card as a preview of where paid plans will live. Email/password
sign-in works today; Google/GitHub sign-in from desktop (system browser + deep link) is a TODO.

## Request Builder (new)

Postman-style manual client at `/request-builder`, backed by `backend/request_builder.py`:

- Any method + URL, query params, headers, body (JSON / raw / form-data / x-www-form-urlencoded / GraphQL)
- Auth: Bearer, Basic, API key (header or query)
- Environments with `{{variable}}` substitution
- Collections (save/organize requests), request history (last 500)
- Per-request **assertions** (status, body contains, JSON path, response time, header) and a
  **collection runner** with a pass/fail report
- Import: Postman Collection v2.x JSON, cURL commands. Export: Postman v2.1 JSON. Copy as cURL.
- **Code generation** (Code button): cURL, JavaScript fetch, Node axios, Python requests,
  Go net/http, PHP cURL, Java HttpClient — copy-ready snippets from the current request.
- No CORS restrictions — requests are sent by the local backend, not the browser.

## Develop

```bash
# backend deps (Python 3.11)
cd backend && python3.11 -m venv .venv && .venv/bin/pip install -r requirements-desktop.txt

# frontend build (desktop mode)
cd frontend && npm install
VITE_LOCAL_MODE=1 VITE_API_BASE_URL=http://127.0.0.1:8765 npx vite build
rm -rf ../backend/static && cp -R dist ../backend/static

# run the desktop app in dev mode (spawns backend.py from the venv)
cd ../desktop && npm install && npm start
```

## Build installers

Locally (current platform only — you can only build the installer for the OS you're on):

```bash
cd backend && .venv/bin/pip install pyinstaller && .venv/bin/pyinstaller flasqo-backend.spec --noconfirm
cd ../desktop && npx electron-builder --publish never
# → desktop/dist/Flasqo-<version>-<arch>.dmg   (macOS)
# → desktop/dist/Flasqo Setup <version>.exe    (Windows)
# → desktop/dist/Flasqo-<version>.AppImage      (Linux)
```

On this Mac, prefix builds with `DEVELOPER_DIR=/Library/Developer/CommandLineTools`
(Xcode license workaround).

All platforms via CI: push a tag like `v1.0.0` (or run the workflow manually) —
`.github/workflows/desktop-build.yml` spins up real macOS (arm64 + x64), Windows and
Ubuntu runners, builds the DMG / NSIS `.exe` / AppImage and uploads them as artifacts.
No Windows or Linux machine of your own is needed.

## Platform support

| OS | Installer | electron-builder target | Status |
|---|---|---|---|
| macOS (Apple Silicon + Intel) | `.dmg`, `.zip` | `dmg`, `zip` | Built + verified end-to-end on-device |
| Windows x64 | `.exe` (NSIS) | `nsis` | Built by CI (not smoke-tested by author) |
| Linux x64 | `.AppImage` | `AppImage` | Built by CI (not smoke-tested by author) |

## Notes / trade-offs

- The desktop build omits Playwright, Streamlit and Postgres. Playwright-powered features
  (FullSend crawling, Vibe screenshots) degrade gracefully; everything else is fully local.
- Web/cloud deployment is unchanged: without `FLASQO_LOCAL=1` the backend behaves exactly
  as before (Postgres, Google/GitHub OAuth).
