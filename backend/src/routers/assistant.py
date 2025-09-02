from __future__ import annotations

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.services.deep_research import run_deep_research
from src.services.lightrag_store import LightRAGStore
from src.services.db import session_scope
from src.services.models import Notebook, ResearchSummary, FeedItem, FeedKind
from src.services.chat_service import chat_service, MessageType
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
    session_id: Optional[int] = None  # For chat session management


class AskResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]
    rag_preview: Optional[str] = None
    session_id: Optional[int] = None
    message_id: Optional[int] = None


@router.post("/ask", response_model=AskResponse)
async def ask_endpoint(req: AskRequest) -> AskResponse:
    """
    Enhanced chat endpoint with session management wrapper around existing LangGraph pipeline.
    
    This preserves all existing functionality:
    - LightRAG knowledge queries
    - Deep research with LangGraph agents
    - Research summary persistence  
    - Feed item creation
    
    Added functionality:
    - Chat session management
    - Message persistence
    - Chat history support
    """
    try:
        # Resolve notebook ID (maintain existing logic)
        notebook_id = req.notebook_id
        if notebook_id is None:
            with session_scope() as session:
                nb = session.exec(
                    select(Notebook).where(
                        Notebook.user_id == req.user_id, 
                        Notebook.name == "Default"
                    )
                ).first()
                if nb is None:
                    nb = Notebook(user_id=req.user_id, name="Default")
                    session.add(nb)
                    session.commit()
                    session.refresh(nb)
                notebook_id = int(nb.id)  # type: ignore[arg-type]
        
        # Get or create chat session for this notebook
        chat_session = chat_service.get_or_create_session(
            user_id=req.user_id,
            notebook_id=notebook_id
        )
        
        # Save user message BEFORE processing (as per test plan)
        user_message = chat_service.save_message(
            session_id=chat_session.id,  # type: ignore[arg-type]
            message_type=MessageType.user,
            content=req.question,
            sources=None
        )
        
        # === EXISTING LANGGRAPH FUNCTIONALITY - UNCHANGED ===
        store = LightRAGStore(req.user_id)
        rag_answer = await store.query(req.question)
        
        sources_list: List[Dict[str, Any]] = []
        final_answer = rag_answer
        
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
            final_answer = messages[-1].content if messages else rag_answer
            sources_list = result.get("sources_gathered", [])

            # Persist research summary per notebook (existing logic)
            with session_scope() as session:
                summary = ResearchSummary(
                    notebook_id=notebook_id,
                    question=req.question,
                    answer=final_answer if isinstance(final_answer, str) else str(final_answer),
                    sources=sources_list,
                )
                session.add(summary)
                session.commit()
                session.refresh(summary)

                # Feed entry for research summary (existing logic)
                feed = FeedItem(
                    notebook_id=notebook_id,
                    kind=FeedKind.research,
                    ref_id=summary.id,  # type: ignore[arg-type]
                )
                session.add(feed)
                session.commit()
        # === END EXISTING FUNCTIONALITY ===
        
        # Save assistant response AFTER processing (as per test plan)
        assistant_message = chat_service.save_message(
            session_id=chat_session.id,  # type: ignore[arg-type]
            message_type=MessageType.assistant,
            content=final_answer if isinstance(final_answer, str) else str(final_answer),
            sources=sources_list if sources_list else None
        )
        
        # Return enhanced response with session information
        return AskResponse(
            answer=final_answer if isinstance(final_answer, str) else str(final_answer),
            sources=sources_list,
            rag_preview=rag_answer if req.deep_research else None,
            session_id=chat_session.id,  # type: ignore[arg-type]
            message_id=assistant_message.id  # type: ignore[arg-type]
        )
        
    except Exception as e:
        # Preserve existing error handling behavior
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


class SessionHistoryRequest(BaseModel):
    user_id: str = "anon"
    session_id: int
    limit: Optional[int] = None


class MessageData(BaseModel):
    id: int
    type: str
    content: str
    sources: Optional[List[Dict[str, Any]]] = None
    created_at: str


class SessionHistoryResponse(BaseModel):
    session_id: int
    notebook_id: int
    messages: List[MessageData]


@router.get("/sessions/{session_id}/history", response_model=SessionHistoryResponse)
async def get_session_history(
    session_id: int,
    user_id: str,
    limit: Optional[int] = None
) -> SessionHistoryResponse:
    """
    Get chat history for a specific session.
    
    Args:
        session_id: Chat session ID
        user_id: User ID for access control
        limit: Optional limit on number of messages returned
        
    Returns:
        SessionHistoryResponse with session info and message history
        
    Raises:
        HTTPException: 404 if session not found, 403 if access denied
    """
    try:
        # Get session to verify access and get notebook_id
        session = chat_service.get_notebook_session(user_id, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get messages
        messages = chat_service.get_session_messages(
            session_id=session_id,
            user_id=user_id,
            limit=limit
        )
        
        # Convert to response format
        message_data = [
            MessageData(
                id=msg.id,  # type: ignore[arg-type]
                type=msg.type.value,
                content=msg.content,
                sources=msg.sources,
                created_at=msg.created_at.isoformat()
            )
            for msg in messages
        ]
        
        return SessionHistoryResponse(
            session_id=session_id,
            notebook_id=session.notebook_id,
            messages=message_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session history: {str(e)}")


class SessionCreateRequest(BaseModel):
    user_id: str = "anon"
    notebook_id: int


class SessionCreateResponse(BaseModel):
    session_id: int
    notebook_id: int
    created_at: str


@router.post("/sessions", response_model=SessionCreateResponse)
async def create_session(req: SessionCreateRequest) -> SessionCreateResponse:
    """
    Create new chat session for a notebook.
    
    Args:
        req: Session creation request with user_id and notebook_id
        
    Returns:
        SessionCreateResponse with new session information
        
    Raises:
        HTTPException: 400 if notebook invalid, 500 for other errors
    """
    try:
        session = chat_service.get_or_create_session(
            user_id=req.user_id,
            notebook_id=req.notebook_id
        )
        
        return SessionCreateResponse(
            session_id=session.id,  # type: ignore[arg-type]
            notebook_id=session.notebook_id,
            created_at=session.created_at.isoformat()
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


