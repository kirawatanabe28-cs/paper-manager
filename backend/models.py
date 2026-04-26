import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    papers = relationship("Paper", back_populates="project", cascade="all, delete-orphan")


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    description = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="papers")
    urls = relationship("PaperUrl", back_populates="paper", cascade="all, delete-orphan")


class PaperUrl(Base):
    __tablename__ = "paper_urls"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)
    label = Column(String, default="")

    paper = relationship("Paper", back_populates="urls")


class Citation(Base):
    __tablename__ = "citations"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    cited_paper_id = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
