import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from database import engine
import models
from routers import projects, papers, grobid

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")


def run_migrations():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE papers ADD COLUMN description TEXT DEFAULT ''"))
            conn.commit()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    run_migrations()
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    yield


app = FastAPI(title="Paper Manager API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(papers.router, prefix="/api/projects", tags=["papers"])
app.include_router(grobid.router, prefix="/api/grobid", tags=["grobid"])


@app.get("/")
def root():
    return {"message": "Paper Manager API"}
