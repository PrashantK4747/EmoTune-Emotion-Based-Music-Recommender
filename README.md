# 🎵 EmoTune — Emotion-Based Music Recommender

EmoTune detects your facial emotion (via webcam or an uploaded photo — or a manual
pick) and recommends music that matches your mood, streamed from the free
[Jamendo](https://www.jamendo.com/) catalog.

```
Face / Emotion  --->  FastAPI backend  --->  Keras CNN model  --->  Jamendo API  --->  Song list
   (frontend)          (JWT-protected)        (emotion label)                        (frontend player)
```

## What changed in this pass

- **Security**: all secrets (JWT signing key, DB password, Jamendo client ID, CORS
  origins) moved out of source code and into a git-ignored `backend/.env` file.
- **Auth actually enforced**: `/emotion/detect` and `/music/recommend` now require a
  valid Bearer token (previously anyone could call them without logging in).
- **Reliability**: the ML model/cascade paths no longer depend on your terminal's
  working directory; the database layer creates its own table automatically on
  startup; Jamendo/network failures are caught and logged instead of crashing routes.
- **UX**: a single persistent **bottom music player** (play/pause, seek bar, track
  info) replaces the old per-song `<audio>` tags scattered around the page; blocking
  `alert()` popups were replaced with non-blocking toast notifications; session
  expiry now prompts a clean re-login instead of a silent failure.
- **Dev experience**: ready-to-use VS Code debug config, `.gitignore`, and a
  `.env.example` template.

## Project structure

```
EmoTune/
├── backend/                 FastAPI app
│   ├── main.py               App entrypoint, CORS, startup checks
│   ├── config.py             Loads settings from backend/.env
│   ├── .env.example           ← copy to .env and fill in your values
│   ├── models/schemas.py     Pydantic request/response models
│   ├── routes/                auth.py, emotion.py, music.py
│   └── utils/                  db_utils.py, ml_utils.py, jamendo_utils.py, auth_utils.py
├── frontend/                 Vanilla JS SPA (no build step)
│   ├── index.html
│   ├── script.js
│   └── style.css
├── shared/                   ML assets used by the backend
│   ├── emotune_model_v2.keras
│   └── haarcascade_frontalface_default.xml
└── .vscode/                  Debug/run configuration for VS Code
```

## 1. Prerequisites

- Python 3.10–3.12
- PostgreSQL running locally (or update `backend/.env` to point elsewhere)
- A modern browser with webcam access (for the live-camera feature)

## 2. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # then edit .env with your real DB password, etc.
```

Create the database once (the `users` table is created automatically on startup):

```sql
CREATE DATABASE emotune_db;
```

Run the API:

```bash
uvicorn main:app --reload --port 8000
```

Visit `http://127.0.0.1:8000/health` — you should see `{"status": "healthy"}`.
Interactive API docs are at `http://127.0.0.1:8000/docs`.

## 3. Frontend setup

The frontend is plain HTML/CSS/JS — no build step required. Serve it with any
static server so the browser's camera permissions work correctly (opening the
file directly via `file://` will block webcam access in most browsers):

- **VS Code**: install the "Live Server" extension, right-click
  `frontend/index.html` → **Open with Live Server**.
- **Or**: `cd frontend && python -m http.server 5500`, then open
  `http://127.0.0.1:5500`.

If your frontend runs on a different port, add it to `CORS_ORIGINS` in
`backend/.env`.

## 4. Running in VS Code

This repo ships with `.vscode/launch.json` and `.vscode/settings.json`:

1. Open the project folder in VS Code.
2. Install the recommended extensions when prompted (Python, Live Server).
3. Select the `backend/.venv` interpreter (`Ctrl+Shift+P` → *Python: Select
   Interpreter*).
4. Press `F5` and pick **"EmoTune: FastAPI (uvicorn)"** to start the backend
   with the debugger attached.
5. Right-click `frontend/index.html` → **Open with Live Server** for the UI.

## 5. Using the app

1. Register an account, then log in.
2. Pick a tab: **Live Camera**, **Upload Image**, or **Select Emotion** manually.
3. EmoTune detects (or accepts) an emotion and fetches matching songs.
4. Click ▶ on any track — it plays in the persistent player bar at the bottom.
5. Check **History** to revisit past sessions and replay songs.

## Notes & known limitations

- Jamendo's catalog is community-uploaded music, so track coverage/quality varies
  by mood tag.
- The emotion model only supports one face at a time (the largest face detected).
- `ACCESS_TOKEN_EXPIRE_HOURS` in `backend/.env` controls how long a login session
  lasts before the app asks you to sign in again.
