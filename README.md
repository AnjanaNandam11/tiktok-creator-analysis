# TikTok Creator Analysis

A full-stack web app to track TikTok creators, analyze their posting patterns, compare engagement rates, and discover top-performing content.

## Tech Stack

| Layer    | Technology                                  |
|----------|---------------------------------------------|
| Backend  | Python, FastAPI, SQLAlchemy, SQLite, Pandas  |
| Frontend | React 19, Vite 7, Tailwind CSS v4, Recharts |
| Deploy   | Render (backend), Vercel (frontend)          |

## Features

- Add and track TikTok creators with follower counts
- Per-creator analytics: engagement rates, posting patterns, top videos
- Side-by-side creator comparison with charts
- Inline niche editing on creator cards
- Demo data fallback when TikTok blocks scraping

## Run Locally

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to `http://localhost:8000`.

## Deployment

- **Backend:** https://tiktok-creator-api.onrender.com
- **Frontend:** https://tiktok-creator-analysis.vercel.app
