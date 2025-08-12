from __future__ import annotations

from fastapi import APIRouter, Query
from services.lightrag_store import LightRAGStore


router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("/graph")
def get_graph(user_id: str = Query("anon")):
    return LightRAGStore(user_id).export_graph()


@router.get("/export/markdown")
def export_markdown(user_id: str = Query("anon")):
    # Placeholder: a real implementation would collect and format user notes.
    # We can store research summaries as well and compile here.
    return {"markdown": "# Knowledge Export\n\n_Coming soon_: consolidated notes."}


@router.get("/feed")
def get_feed(user_id: str = Query("anon"), cursor: int = 0, limit: int = 20):
    # Placeholder feed until we add a lightweight index; can be backed by LightRAG cache.
    return {"items": [], "next_cursor": None}


