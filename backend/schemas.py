import datetime
from typing import Optional, List
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime.datetime
    paper_count: int = 0

    model_config = {"from_attributes": True}


class PaperResponse(BaseModel):
    id: int
    project_id: int
    title: str
    year: int
    filename: str
    filepath: str
    description: str = ""
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class PaperDetail(PaperResponse):
    citing: List["PaperResponse"] = []
    cited_by: List["PaperResponse"] = []


class PaperUpdate(BaseModel):
    title: str
    year: int
    description: str = ""
    citing_paper_ids: List[int] = []
    cited_by_paper_ids: List[int] = []


class GraphNode(BaseModel):
    id: str
    data: dict
    position: dict = {"x": 0, "y": 0}


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    markerEnd: dict = {"type": "arrowclosed"}


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
