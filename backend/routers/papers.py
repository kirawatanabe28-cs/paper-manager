import json
import os
import re
import xml.etree.ElementTree as ET
from collections import deque
from difflib import SequenceMatcher
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
GROBID_URL = os.getenv("GROBID_URL", "http://localhost:8070")
TEI_NS = "http://www.tei-c.org/ns/1.0"
SIMILARITY_THRESHOLD = 0.80


# ------------------------------------------------------------------ #
#  グラフノードビルダー                                                #
# ------------------------------------------------------------------ #

def _build_node(p: models.Paper) -> schemas.GraphNode:
    return schemas.GraphNode(
        id=str(p.id),
        data={"label": p.title, "year": p.year, "paperId": p.id, "description": p.description or ""},
        position={"x": 0, "y": 0},
    )


# ------------------------------------------------------------------ #
#  引用・URL ヘルパー                                                  #
# ------------------------------------------------------------------ #

def _add_citations(db: Session, paper_id: int, project_id: int, year: int,
                   citing_ids: List[int], cited_by_ids: List[int]):
    for cited_id in citing_ids:
        cited_paper = db.query(models.Paper).filter(
            models.Paper.id == cited_id, models.Paper.project_id == project_id
        ).first()
        if cited_paper and cited_paper.year <= year:
            if not db.query(models.Citation).filter(
                models.Citation.paper_id == paper_id,
                models.Citation.cited_paper_id == cited_id,
            ).first():
                db.add(models.Citation(paper_id=paper_id, cited_paper_id=cited_id))

    for citing_id in cited_by_ids:
        citing_paper = db.query(models.Paper).filter(
            models.Paper.id == citing_id, models.Paper.project_id == project_id
        ).first()
        if citing_paper and citing_paper.year >= year:
            if not db.query(models.Citation).filter(
                models.Citation.paper_id == citing_id,
                models.Citation.cited_paper_id == paper_id,
            ).first():
                db.add(models.Citation(paper_id=citing_id, cited_paper_id=paper_id))


def _replace_urls(db: Session, paper_id: int, url_items: List[schemas.UrlItem]):
    db.query(models.PaperUrl).filter(models.PaperUrl.paper_id == paper_id).delete()
    for item in url_items:
        if item.url.strip():
            db.add(models.PaperUrl(paper_id=paper_id, url=item.url.strip(), label=item.label.strip()))


# ------------------------------------------------------------------ #
#  GROBID 参考文献抽出・ファジーマッチング                             #
# ------------------------------------------------------------------ #

def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _similarity(a: str, b: str) -> float:
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


def _parse_references_xml(xml_bytes: bytes) -> List[str]:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []

    titles: List[str] = []
    for bibl in root.findall(f".//{{{TEI_NS}}}biblStruct"):
        title = ""

        # 優先1: analytic title（論文タイトル）
        analytic = bibl.find(f"{{{TEI_NS}}}analytic")
        if analytic is not None:
            for xpath in [
                f"{{{TEI_NS}}}title[@type='main']",
                f"{{{TEI_NS}}}title[@level='a']",
                f"{{{TEI_NS}}}title",
            ]:
                elem = analytic.find(xpath)
                if elem is not None and elem.text and len(elem.text.strip()) > 5:
                    title = elem.text.strip()
                    break

        # 優先2: monogr title（書籍・学位論文）
        if not title:
            monogr = bibl.find(f"{{{TEI_NS}}}monogr")
            if monogr is not None:
                elem = monogr.find(f"{{{TEI_NS}}}title[@level='m']")
                if elem is None:
                    elem = monogr.find(f"{{{TEI_NS}}}title")
                if elem is not None and elem.text and len(elem.text.strip()) > 5:
                    title = elem.text.strip()

        if title:
            titles.append(title)

    return titles


async def _extract_reference_titles(pdf_content: bytes, filename: str) -> List[str]:
    """GROBIDから参考文献タイトル一覧を取得する（失敗時は空リストを返す）"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{GROBID_URL}/api/processReferences",
                files={"input": (filename, pdf_content, "application/pdf")},
                data={"consolidateCitations": "0"},
            )
        if response.status_code != 200:
            return []
        return _parse_references_xml(response.content)
    except Exception:
        return []


def _auto_link_references(
    db: Session,
    paper_id: int,
    project_id: int,
    ref_titles: List[str],
    paper_title: str,
    paper_year: int,
) -> None:
    """
    1. 抽出した参考文献タイトルを paper_references に保存
    2. 既存論文との照合で「この論文が引用している」を自動登録
    3. 既存論文の保存済み参考文献との照合で「この論文を引用している」を自動登録
    """
    # 1. 生の参考文献タイトルを保存
    for ref_title in ref_titles:
        if ref_title.strip():
            db.add(models.PaperReference(paper_id=paper_id, ref_title=ref_title))

    existing_papers = db.query(models.Paper).filter(
        models.Paper.project_id == project_id,
        models.Paper.id != paper_id,
    ).all()

    if not existing_papers:
        db.commit()
        return

    papers_map = {p.id: p for p in existing_papers}
    existing_paper_ids = [p.id for p in existing_papers]

    # 2. 順方向リンク: 新論文 → 既存論文（年フィルタ: 引用先は新論文以前）
    linked_cited_ids: set = set()
    for ref_title in ref_titles:
        best_sim, best_ep = -1.0, None
        for ep in existing_papers:
            if ep.year <= paper_year and ep.id not in linked_cited_ids:
                sim = _similarity(ref_title, ep.title)
                if sim >= SIMILARITY_THRESHOLD and sim > best_sim:
                    best_sim, best_ep = sim, ep
        if best_ep is not None:
            if not db.query(models.Citation).filter(
                models.Citation.paper_id == paper_id,
                models.Citation.cited_paper_id == best_ep.id,
            ).first():
                db.add(models.Citation(paper_id=paper_id, cited_paper_id=best_ep.id))
            linked_cited_ids.add(best_ep.id)

    # 3. 逆方向リンク: 既存論文 → 新論文（年フィルタ: 引用元は新論文以降）
    existing_refs = db.query(models.PaperReference).filter(
        models.PaperReference.paper_id.in_(existing_paper_ids)
    ).all()

    paper_refs_map: dict = {}
    for ref in existing_refs:
        paper_refs_map.setdefault(ref.paper_id, []).append(ref.ref_title)

    for ep_id, refs in paper_refs_map.items():
        ep = papers_map.get(ep_id)
        if ep is None or ep.year < paper_year:
            continue  # 引用元は新論文と同年以降のみ
        matched = any(
            _similarity(ref_title, paper_title) >= SIMILARITY_THRESHOLD
            for ref_title in refs
        )
        if matched:
            if not db.query(models.Citation).filter(
                models.Citation.paper_id == ep_id,
                models.Citation.cited_paper_id == paper_id,
            ).first():
                db.add(models.Citation(paper_id=ep_id, cited_paper_id=paper_id))

    db.commit()


# ------------------------------------------------------------------ #
#  API エンドポイント                                                  #
# ------------------------------------------------------------------ #

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
    direction: str,
    exclude_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
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
    citing_papers = [db.query(models.Paper).filter(models.Paper.id == c.cited_paper_id).first() for c in citing_rows]
    cited_by_papers = [db.query(models.Paper).filter(models.Paper.id == c.paper_id).first() for c in cited_by_rows]

    return schemas.PaperDetail(
        id=paper.id,
        project_id=paper.project_id,
        title=paper.title,
        year=paper.year,
        filename=paper.filename,
        filepath=paper.filepath,
        description=paper.description or "",
        created_at=paper.created_at,
        citing=[p for p in citing_papers if p],
        cited_by=[p for p in cited_by_papers if p],
        urls=[schemas.UrlItem(url=u.url, label=u.label) for u in paper.urls],
    )


@router.post("/{project_id}/papers", response_model=schemas.PaperResponse)
async def upload_paper(
    project_id: int,
    title: str = Form(...),
    year: int = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    citing_paper_ids: str = Form("[]"),
    cited_by_paper_ids: str = Form("[]"),
    urls: str = Form("[]"),
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
        description=description,
        filename=filename,
        filepath=filepath,
    )
    db.add(db_paper)
    db.commit()
    db.refresh(db_paper)

    # 手動選択の引用関係（編集モーダルからの呼び出し用）
    try:
        citing_ids: List[int] = json.loads(citing_paper_ids)
        cited_by_ids: List[int] = json.loads(cited_by_paper_ids)
        url_items = [schemas.UrlItem(**u) for u in json.loads(urls)]
    except Exception:
        citing_ids, cited_by_ids, url_items = [], [], []

    _add_citations(db, db_paper.id, project_id, year, citing_ids, cited_by_ids)
    _replace_urls(db, db_paper.id, url_items)
    db.commit()

    # GROBID による参考文献自動抽出・自動リンク（失敗しても論文保存は成功）
    try:
        ref_titles = await _extract_reference_titles(content, file.filename)
        if ref_titles:
            _auto_link_references(db, db_paper.id, project_id, ref_titles, db_paper.title, db_paper.year)
    except Exception:
        pass

    return db_paper


@router.put("/{project_id}/papers/{paper_id}", response_model=schemas.PaperResponse)
def update_paper(
    project_id: int,
    paper_id: int,
    data: schemas.PaperUpdate,
    db: Session = Depends(get_db),
):
    paper = db.query(models.Paper).filter(
        models.Paper.id == paper_id, models.Paper.project_id == project_id
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper.title = data.title
    paper.year = data.year
    paper.description = data.description

    db.query(models.Citation).filter(
        (models.Citation.paper_id == paper_id) | (models.Citation.cited_paper_id == paper_id)
    ).delete(synchronize_session=False)
    db.flush()

    _add_citations(db, paper_id, project_id, data.year, data.citing_paper_ids, data.cited_by_paper_ids)
    _replace_urls(db, paper_id, data.urls)
    db.commit()
    db.refresh(paper)
    return paper


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
    citations = db.query(models.Citation).filter(models.Citation.paper_id.in_(paper_ids)).all()

    return schemas.GraphResponse(
        nodes=[_build_node(p) for p in papers],
        edges=[
            schemas.GraphEdge(id=f"e{c.paper_id}-{c.cited_paper_id}",
                              source=str(c.paper_id), target=str(c.cited_paper_id))
            for c in citations
        ],
    )


@router.get("/{project_id}/graph/{paper_id}", response_model=schemas.GraphResponse)
def get_subgraph(project_id: int, paper_id: int, db: Session = Depends(get_db)):
    papers = db.query(models.Paper).filter(models.Paper.project_id == project_id).all()
    paper_ids = {p.id for p in papers}

    if paper_id not in paper_ids:
        raise HTTPException(status_code=404, detail="Paper not found")

    citations = db.query(models.Citation).filter(models.Citation.paper_id.in_(paper_ids)).all()

    adj: dict = {pid: set() for pid in paper_ids}
    for c in citations:
        adj[c.paper_id].add(c.cited_paper_id)
        adj[c.cited_paper_id].add(c.paper_id)

    visited: set = set()
    queue = deque([paper_id])
    while queue:
        current = queue.popleft()
        if current in visited:
            continue
        visited.add(current)
        queue.extend(adj[current] - visited)

    papers_map = {p.id: p for p in papers}
    connected_papers = [papers_map[pid] for pid in visited if pid in papers_map]
    connected_citations = [c for c in citations if c.paper_id in visited and c.cited_paper_id in visited]

    return schemas.GraphResponse(
        nodes=[_build_node(p) for p in connected_papers],
        edges=[
            schemas.GraphEdge(id=f"e{c.paper_id}-{c.cited_paper_id}",
                              source=str(c.paper_id), target=str(c.cited_paper_id))
            for c in connected_citations
        ],
    )
