from __future__ import annotations

from fastapi import APIRouter, Query, Depends
from src.services.lightrag_store import LightRAGStore
from sqlmodel import Session, select
from src.services.db import get_session
from src.services.models import FeedItem, Notebook


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
def get_feed(
    user_id: str = Query("anon"),
    notebook_id: int | None = Query(None),
    cursor: int = 0,
    limit: int = 20,
    session: Session = Depends(get_session),
):
    # Resolve default notebook if not provided
    if notebook_id is None:
        nb = session.exec(select(Notebook).where(Notebook.user_id == user_id, Notebook.name == "Default")).first()
        if not nb:
            return {"items": [], "next_cursor": None}
        notebook_id = int(nb.id)  # type: ignore[arg-type]

    items = session.exec(
        select(FeedItem)
        .where(FeedItem.notebook_id == notebook_id)
        .order_by(FeedItem.created_at.desc())
        .offset(cursor)
        .limit(limit)
    ).all()
    next_cursor = cursor + len(items) if len(items) == limit else None
    return {
        "items": [
            {"id": it.id, "kind": it.kind, "ref_id": it.ref_id, "created_at": it.created_at.isoformat()}
            for it in items
        ],
        "next_cursor": next_cursor,
    }


