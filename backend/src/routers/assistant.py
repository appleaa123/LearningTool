from __future__ import annotations

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from services.deep_research import run_deep_research
from services.lightrag_store import LightRAGStore


router = APIRouter(prefix="/assistant", tags=["assistant"])


class AskRequest(BaseModel):
    user_id: str = "anon"
    question: str
    effort: str = "medium"  # low | medium | high
    provider: Optional[str] = None
    model: Optional[str] = None
    deep_research: bool = False


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
        return {"answer": final, "sources": result.get("sources_gathered", []), "rag_preview": rag_answer}

    return {"answer": rag_answer, "sources": []}


