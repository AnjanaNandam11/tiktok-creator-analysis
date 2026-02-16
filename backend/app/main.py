import os
import sys
from pathlib import Path

# Ensure "backend/" is on sys.path so `from app.*` imports work
# regardless of which directory uvicorn is launched from.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.models.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TikTok Creator Analysis", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"message": "TikTok Creator Analysis API"}
