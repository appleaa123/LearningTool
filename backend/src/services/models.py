from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any

from sqlmodel import SQLModel, Field, Column, JSON, Relationship


class BaseModel(SQLModel):
    """Common base to ensure consistent table args and metadata registration."""
    pass


class Notebook(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, index=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    sources: List["Source"] = Relationship(back_populates="notebook")
    chunks: List["Chunk"] = Relationship(back_populates="notebook")
    transformed: List["TransformedItem"] = Relationship(back_populates="notebook")
    summaries: List["ResearchSummary"] = Relationship(back_populates="notebook")
    exclusions: List["Exclusion"] = Relationship(back_populates="notebook")
    feed_items: List["FeedItem"] = Relationship(back_populates="notebook")


class Source(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notebook_id: int = Field(foreign_key="notebook.id", index=True)
    type: str = Field(index=True)
    uri: str = Field(index=True)
    mime: Optional[str] = None
    title: Optional[str] = None
    tags: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    notebook: Notebook = Relationship(back_populates="sources")
    chunks: List["Chunk"] = Relationship(back_populates="source")


class Chunk(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notebook_id: int = Field(foreign_key="notebook.id", index=True)
    source_id: Optional[int] = Field(default=None, foreign_key="source.id", index=True)
    text: str
    metadata_json: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSON),
    )
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    notebook: Notebook = Relationship(back_populates="chunks")
    source: Optional[Source] = Relationship(back_populates="chunks")
    transformed: List["TransformedItem"] = Relationship(back_populates="chunk")


class TransformedType(str, Enum):
    summary = "summary"
    qa = "qa"
    flashcard = "flashcard"


class TransformedItem(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notebook_id: int = Field(foreign_key="notebook.id", index=True)
    chunk_id: Optional[int] = Field(default=None, foreign_key="chunk.id", index=True)
    type: TransformedType = Field(index=True)
    text: str
    metadata_json: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSON),
    )
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    notebook: Notebook = Relationship(back_populates="transformed")
    chunk: Optional[Chunk] = Relationship(back_populates="transformed")


class ResearchSummary(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notebook_id: int = Field(foreign_key="notebook.id", index=True)
    question: str
    answer: str
    sources: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    notebook: Notebook = Relationship(back_populates="summaries")


class ExclusionScope(str, Enum):
    rag = "rag"
    research = "research"
    both = "both"


class Exclusion(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notebook_id: int = Field(foreign_key="notebook.id", index=True)
    scope: ExclusionScope = Field(index=True)
    source_id: Optional[int] = Field(default=None, foreign_key="source.id", index=True)
    tag: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    notebook: Notebook = Relationship(back_populates="exclusions")


class FeedKind(str, Enum):
    chunk = "chunk"
    summary = "summary"
    qa = "qa"
    flashcard = "flashcard"
    research = "research"


class FeedItem(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notebook_id: int = Field(foreign_key="notebook.id", index=True)
    kind: FeedKind = Field(index=True)
    ref_id: int = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    notebook: Notebook = Relationship(back_populates="feed_items")


