from __future__ import annotations

from typing import Optional, List, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from services.db import get_session
from services.models import Notebook, Exclusion, ExclusionScope


router = APIRouter(prefix="/notebooks", tags=["notebooks"])


class CreateNotebookRequest(BaseModel):
    name: str
    user_id: Optional[str] = None


class NotebookResponse(BaseModel):
    id: int
    name: str
    user_id: Optional[str]


@router.post("")
def create_notebook(req: CreateNotebookRequest, session: Session = Depends(get_session)) -> NotebookResponse:
    existing = session.exec(select(Notebook).where(Notebook.name == req.name, Notebook.user_id == req.user_id)).first()
    if existing:
        return NotebookResponse(id=existing.id, name=existing.name, user_id=existing.user_id)  # type: ignore[arg-type]

    nb = Notebook(name=req.name, user_id=req.user_id)
    session.add(nb)
    session.commit()
    session.refresh(nb)
    return NotebookResponse(id=nb.id, name=nb.name, user_id=nb.user_id)  # type: ignore[arg-type]


@router.get("")
def list_notebooks(user_id: Optional[str] = Query(None), session: Session = Depends(get_session)) -> List[NotebookResponse]:
    stmt = select(Notebook)
    if user_id is not None:
        stmt = stmt.where(Notebook.user_id == user_id)
    nbs = session.exec(stmt.order_by(Notebook.created_at.desc())).all()
    return [NotebookResponse(id=n.id, name=n.name, user_id=n.user_id) for n in nbs]  # type: ignore[arg-type]


@router.get("/{notebook_id}")
def get_notebook(notebook_id: int, session: Session = Depends(get_session)) -> NotebookResponse:
    nb = session.get(Notebook, notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return NotebookResponse(id=nb.id, name=nb.name, user_id=nb.user_id)  # type: ignore[arg-type]


@router.delete("/{notebook_id}")
def delete_notebook(notebook_id: int, session: Session = Depends(get_session)) -> dict:
    nb = session.get(Notebook, notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    session.delete(nb)
    session.commit()
    return {"ok": True}


class ExclusionRequest(BaseModel):
    scope: ExclusionScope
    source_id: Optional[int] = None
    tag: Optional[str] = None


@router.post("/{notebook_id}/exclusions")
def create_exclusion(notebook_id: int, req: ExclusionRequest, session: Session = Depends(get_session)) -> dict:
    if req.source_id is None and (req.tag is None or req.tag.strip() == ""):
        raise HTTPException(status_code=400, detail="Either source_id or tag must be provided")
    nb = session.get(Notebook, notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    ex = Exclusion(notebook_id=notebook_id, scope=req.scope, source_id=req.source_id, tag=req.tag)
    session.add(ex)
    session.commit()
    session.refresh(ex)
    return {"id": ex.id}


@router.get("/{notebook_id}/exclusions")
def list_exclusions(
    notebook_id: int,
    scope: Optional[Literal["rag", "research", "both"]] = Query(None),
    session: Session = Depends(get_session),
) -> List[dict]:
    nb = session.get(Notebook, notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    stmt = select(Exclusion).where(Exclusion.notebook_id == notebook_id)
    if scope is not None:
        stmt = stmt.where(Exclusion.scope == scope)  # type: ignore[comparison-overlap]
    items = session.exec(stmt.order_by(Exclusion.created_at.desc())).all()
    return [
        {"id": e.id, "scope": e.scope, "source_id": e.source_id, "tag": e.tag, "created_at": e.created_at.isoformat()}
        for e in items
    ]


