import os
import xml.etree.ElementTree as ET

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter()

GROBID_URL = os.getenv("GROBID_URL", "http://localhost:8070")
TEI_NS = "http://www.tei-c.org/ns/1.0"


def _parse_title(xml_bytes: bytes) -> str:
    try:
        root = ET.fromstring(xml_bytes)
        title_elem = root.find(f".//{{{TEI_NS}}}title[@type='main']")
        if title_elem is None:
            title_elem = root.find(f".//{{{TEI_NS}}}title")
        return (title_elem.text or "").strip() if title_elem is not None else ""
    except ET.ParseError:
        return ""


@router.post("/extract-title")
async def extract_title(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDFファイルのみ対応しています")

    content = await file.read()

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{GROBID_URL}/api/processHeaderDocument",
                files={"input": (file.filename, content, "application/pdf")},
                data={"consolidateHeader": "1"},
            )
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="GROBIDに接続できませんでした")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="GROBIDへのリクエストがタイムアウトしました")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GROBIDリクエストに失敗しました: {str(e)}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"GROBIDがエラーを返しました (HTTP {response.status_code})",
        )

    title = _parse_title(response.content)
    if not title:
        raise HTTPException(status_code=422, detail="論文タイトルを抽出できませんでした")

    return {"title": title}
