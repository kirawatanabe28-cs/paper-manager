import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from database import engine
import models
from routers import projects, papers


def run_migrations():
    """既存DBに新しいカラムを追加するマイグレーション"""
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE papers ADD COLUMN description TEXT DEFAULT ''"))
            conn.commit()
        except Exception:
            pass  # カラムが既に存在する場合は無視


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    run_migrations()
    os.makedirs("uploads", exist_ok=True)
    yield


app = FastAPI(title="Paper Manager API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(papers.router, prefix="/api/projects", tags=["papers"])


@app.get("/")
def root():
    return {"message": "Paper Manager API"}
