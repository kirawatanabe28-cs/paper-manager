import json
import os
from collections import deque
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter()

UPLOAD_DIR = "uploads"


@router.get("/{project_id}/papers", response_model=List[schemas.PaperResponse])
def get_papers(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(models.Paper).filter(models.Paper.project_id == project_id).order_by(models.Paper.year.desc()).all()


@router.get("/{project_id}/papers/for-citation", response_model=List[schemas.PaperResponse])
def get_papers_for_citation(
    project_id: int,
    year: int,
    direction: str,  # "citing" | "cited_by"
    exclude_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    引用関係選択用の論文一覧を返す。
    direction=citing  → この論文が引用する側 → year <= 指定年 の論文を返す
    direction=cited_by → この論文を引用する側 → year >= 指定年 の論文を返す
    """
    query = db.query(models.Paper).filter(models.Paper.project_id == project_id)
    if direction == "citing":
        query = query.filter(models.Paper.year <= year)
    elif direction == "cited_by":
        query = query.filter(models.Paper.year >= year)
    if exclude_id is not None:
        query = query.filter(models.Paper.id != exclude_id)
    return query.order_by(models.Paper.year.desc()).all()


@router.get("/{project_id}/papers/{paper_id}", response_model=schemas.PaperDetail)
def get_paper(project_id: int, paper_id: int, db: Session = Depends(get_db)):
    paper = db.query(models.Paper).filter(
        models.Paper.id == paper_id, models.Paper.project_id == project_id
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    citing_rows = db.query(models.Citation).filter(models.Citation.paper_id == paper_id).all()
    cited_by_rows = db.query(models.Citation).filter(models.Citation.cited_paper_id == paper_id).all()

    citing_papers = [
        db.query(models.Paper).filter(models.Paper.id == c.cited_paper_id).first()
        for c in citing_rows
    ]
    cited_by_papers = [
        db.query(models.Paper).filter(models.Paper.id == c.paper_id).first()
        for c in cited_by_rows
    ]

    return schemas.PaperDetail(
        id=paper.id,
        project_id=paper.project_id,
        title=paper.title,
        year=paper.year,
        filename=paper.filename,
        filepath=paper.filepath,
        created_at=paper.created_at,
        citing=[p for p in citing_papers if p],
        cited_by=[p for p in cited_by_papers if p],
    )


@router.post("/{project_id}/papers", response_model=schemas.PaperResponse)
async def upload_paper(
    project_id: int,
    title: str = Form(...),
    year: int = Form(...),
    file: UploadFile = File(...),
    citing_paper_ids: str = Form("[]"),
    cited_by_paper_ids: str = Form("[]"),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDFファイルのみアップロード可能です")

    project_dir = os.path.join(UPLOAD_DIR, str(project_id))
    os.makedirs(project_dir, exist_ok=True)

    filename = file.filename
    filepath = os.path.join(project_dir, filename)
    counter = 1
    while os.path.exists(filepath):
        name, ext = os.path.splitext(filename)
        filename = f"{name}_{counter}{ext}"
        filepath = os.path.join(project_dir, filename)
        counter += 1

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    db_paper = models.Paper(
        project_id=project_id,
        title=title,
        year=year,
        filename=filename,
        filepath=filepath,
    )
    db.add(db_paper)
    db.commit()
    db.refresh(db_paper)

    try:
        citing_ids: List[int] = json.loads(citing_paper_ids)
        cited_by_ids: List[int] = json.loads(cited_by_paper_ids)
    except json.JSONDecodeError:
        citing_ids = []
        cited_by_ids = []

    for cited_id in citing_ids:
        cited_paper = db.query(models.Paper).filter(
            models.Paper.id == cited_id, models.Paper.project_id == project_id
        ).first()
        if cited_paper and cited_paper.year <= year:
            existing = db.query(models.Citation).filter(
                models.Citation.paper_id == db_paper.id,
                models.Citation.cited_paper_id == cited_id,
            ).first()
            if not existing:
                db.add(models.Citation(paper_id=db_paper.id, cited_paper_id=cited_id))

    for citing_id in cited_by_ids:
        citing_paper = db.query(models.Paper).filter(
            models.Paper.id == citing_id, models.Paper.project_id == project_id
        ).first()
        if citing_paper and citing_paper.year >= year:
            existing = db.query(models.Citation).filter(
                models.Citation.paper_id == citing_id,
                models.Citation.cited_paper_id == db_paper.id,
            ).first()
            if not existing:
                db.add(models.Citation(paper_id=citing_id, cited_paper_id=db_paper.id))

    db.commit()
    return db_paper


@router.delete("/{project_id}/papers/{paper_id}")
def delete_paper(project_id: int, paper_id: int, db: Session = Depends(get_db)):
    paper = db.query(models.Paper).filter(
        models.Paper.id == paper_id, models.Paper.project_id == project_id
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if os.path.exists(paper.filepath):
        os.remove(paper.filepath)

    db.query(models.Citation).filter(
        (models.Citation.paper_id == paper_id) | (models.Citation.cited_paper_id == paper_id)
    ).delete(synchronize_session=False)

    db.delete(paper)
    db.commit()
    return {"message": "Paper deleted"}


@router.get("/{project_id}/graph", response_model=schemas.GraphResponse)
def get_graph(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    papers = db.query(models.Paper).filter(models.Paper.project_id == project_id).all()
    paper_ids = {p.id for p in papers}

    citations = db.query(models.Citation).filter(
        models.Citation.paper_id.in_(paper_ids)
    ).all()

    nodes = [
        schemas.GraphNode(
            id=str(p.id),
            data={"label": p.title, "year": p.year, "paperId": p.id},
            position={"x": 0, "y": 0},
        )
        for p in papers
    ]

    edges = [
        schemas.GraphEdge(
            id=f"e{c.paper_id}-{c.cited_paper_id}",
            source=str(c.paper_id),
            target=str(c.cited_paper_id),
        )
        for c in citations
    ]

    return schemas.GraphResponse(nodes=nodes, edges=edges)


@router.get("/{project_id}/graph/{paper_id}", response_model=schemas.GraphResponse)
def get_subgraph(project_id: int, paper_id: int, db: Session = Depends(get_db)):
    papers = db.query(models.Paper).filter(models.Paper.project_id == project_id).all()
    paper_ids = {p.id for p in papers}

    if paper_id not in paper_ids:
        raise HTTPException(status_code=404, detail="Paper not found")

    citations = db.query(models.Citation).filter(
        models.Citation.paper_id.in_(paper_ids)
    ).all()

    # 双方向隣接リストを構築してBFS
    adj: dict = {pid: set() for pid in paper_ids}
    for c in citations:
        adj[c.paper_id].add(c.cited_paper_id)
        adj[c.cited_paper_id].add(c.paper_id)

    visited: set = set()
    queue: deque = deque([paper_id])
    while queue:
        current = queue.popleft()
        if current in visited:
            continue
        visited.add(current)
        queue.extend(adj[current] - visited)

    papers_map = {p.id: p for p in papers}
    connected_papers = [papers_map[pid] for pid in visited if pid in papers_map]
    connected_citations = [
        c for c in citations if c.paper_id in visited and c.cited_paper_id in visited
    ]

    nodes = [
        schemas.GraphNode(
            id=str(p.id),
            data={"label": p.title, "year": p.year, "paperId": p.id},
            position={"x": 0, "y": 0},
        )
        for p in connected_papers
    ]

    edges = [
        schemas.GraphEdge(
            id=f"e{c.paper_id}-{c.cited_paper_id}",
            source=str(c.paper_id),
            target=str(c.cited_paper_id),
        )
        for c in connected_citations
    ]

    return schemas.GraphResponse(nodes=nodes, edges=edges)
