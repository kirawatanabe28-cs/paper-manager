import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine
import models
from routers import projects, papers

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Paper Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(papers.router, prefix="/api/projects", tags=["papers"])


@app.get("/")
def root():
    return {"message": "Paper Manager API"}
