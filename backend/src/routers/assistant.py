from __future__ import annotations

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from services.deep_research import run_deep_research
from services.lightrag_store import LightRAGStore
from services.db import session_scope
from services.models import Notebook, ResearchSummary, FeedItem, FeedKind
from sqlmodel import select


router = APIRouter(prefix="/assistant", tags=["assistant"])


class AskRequest(BaseModel):
    user_id: str = "anon"
    question: str
    effort: str = "medium"  # low | medium | high
    provider: Optional[str] = None
    model: Optional[str] = None
    deep_research: bool = False
    notebook_id: Optional[int] = None


@router.post("/ask")
def ask_endpoint(req: AskRequest):
    store = LightRAGStore(req.user_id)
    rag_answer = store.query(req.question)

    if req.deep_research:
        loops_by_effort = {"low": 1, "medium": 3, "high": 10}
        loops = loops_by_effort.get(req.effort, 3)
        result = run_deep_research(
            req.question,
            initial_queries=min(5, loops),
            max_loops=loops,
            reasoning_model=req.model or "gemini-2.5-pro",
        )
        messages = result.get("messages", [])
        final = messages[-1].content if messages else rag_answer

        # Persist research summary per notebook
        with session_scope() as session:
            # Resolve notebook id (default per user if not provided)
            nid = req.notebook_id
            if nid is None:
                nb = session.exec(select(Notebook).where(Notebook.user_id == req.user_id, Notebook.name == "Default")).first()
                if nb is None:
                    nb = Notebook(user_id=req.user_id, name="Default")
                    session.add(nb)
                    session.commit()
                    session.refresh(nb)
                nid = int(nb.id)  # type: ignore[arg-type]

            summary = ResearchSummary(
                notebook_id=nid,
                question=req.question,
                answer=final if isinstance(final, str) else str(final),
                sources=result.get("sources_gathered", []),
            )
            session.add(summary)
            session.commit()
            session.refresh(summary)

            # Feed entry for research summary
            feed = FeedItem(
                notebook_id=nid,
                kind=FeedKind.research,
                ref_id=summary.id,  # type: ignore[arg-type]
            )
            session.add(feed)
            session.commit()

        return {"answer": final, "sources": result.get("sources_gathered", []), "rag_preview": rag_answer}

    return {"answer": rag_answer, "sources": []}


