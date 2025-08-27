from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any

from sqlmodel import SQLModel, Field, Column, JSON


class BaseModel(SQLModel):
    """Common base to ensure consistent table args and metadata registration."""
    pass


class Notebook(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, index=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class Source(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notebook_id: int = Field(foreign_key="notebook.id", index=True)
    type: str = Field(index=True)
    uri: str = Field(index=True)
    mime: Optional[str] = None
    title: Optional[str] = None
    tags: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


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


class ResearchSummary(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notebook_id: int = Field(foreign_key="notebook.id", index=True)
    question: str
    answer: str
    sources: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


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


class TopicStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class SuggestedTopic(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notebook_id: int = Field(foreign_key="notebook.id", index=True)
    source_content: str  # Original content that generated this topic
    source_type: str = Field(index=True)  # "document", "image", "text"
    source_filename: Optional[str] = None  # Original filename if applicable
    topic: str  # The suggested topic/research question
    context: str  # Why this topic is relevant/interesting
    priority_score: float = Field(default=0.0, index=True)  # 0.0-1.0 relevance score
    status: TopicStatus = Field(default=TopicStatus.pending, index=True)
    research_summary_id: Optional[int] = Field(default=None, foreign_key="researchsummary.id")
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TopicSuggestionPreference(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notebook_id: int = Field(foreign_key="notebook.id", index=True)
    auto_suggest_enabled: bool = Field(default=True)  # Whether to show topic suggestions
    suggestion_count: int = Field(default=3, ge=1, le=5)  # Max topics to suggest per upload
    min_priority_score: float = Field(default=0.5, ge=0.0, le=1.0)  # Minimum score threshold
    preferred_domains: List[str] = Field(default_factory=list, sa_column=Column(JSON))  # Focus areas
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)