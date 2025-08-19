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