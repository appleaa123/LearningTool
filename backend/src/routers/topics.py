from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi import status as http_status
from sqlmodel import Session
from pydantic import BaseModel

from src.services.db import get_session, session_scope
from src.services.topic_suggestion import TopicSuggestionService
from src.services.models import SuggestedTopic, TopicSuggestionPreference, TopicStatus, ResearchSummary, FeedItem, FeedKind
from src.services.deep_research import run_deep_research


router = APIRouter(prefix="/topics", tags=["topics"])


async def _run_topic_research_background(topic: SuggestedTopic) -> None:
    """Run deep research for an accepted topic in the background."""
    try:
        # Run deep research using the same pipeline as the assistant
        result = run_deep_research(
            topic.topic,
            initial_queries=3,  # Medium effort level
            max_loops=3,
            reasoning_model="gemini-2.0-flash-exp",
        )
        
        messages = result.get("messages", [])
        final_answer = messages[-1].content if messages else "No research results available"
        sources = result.get("sources_gathered", [])
        
        # Persist research summary and link it to the topic
        with session_scope() as session:
            research_summary = ResearchSummary(
                notebook_id=topic.notebook_id,
                question=topic.topic,
                answer=final_answer if isinstance(final_answer, str) else str(final_answer),
                sources=sources,
            )
            session.add(research_summary)
            session.commit()
            session.refresh(research_summary)
            
            # Link the research summary to the topic
            topic_in_session = session.get(SuggestedTopic, topic.id)
            if topic_in_session:
                topic_in_session.research_summary_id = research_summary.id
                session.commit()
            
            # Create feed entry for the research
            feed_item = FeedItem(
                notebook_id=topic.notebook_id,
                kind=FeedKind.research,
                ref_id=research_summary.id,
            )
            session.add(feed_item)
            session.commit()
            
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Completed research for topic {topic.id}: '{topic.topic}'")
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to complete research for topic {topic.id}: {e}")


# Request/Response Models
class TopicResponse(BaseModel):
    id: int
    topic: str
    context: str
    priority_score: float
    status: str
    source_type: str
    source_filename: Optional[str] = None
    created_at: str
    
    @classmethod
    def from_model(cls, topic: SuggestedTopic) -> "TopicResponse":
        return cls(
            id=topic.id,
            topic=topic.topic,
            context=topic.context,
            priority_score=topic.priority_score,
            status=topic.status.value,
            source_type=topic.source_type,
            source_filename=topic.source_filename,
            created_at=topic.created_at.isoformat()
        )


class PreferencesResponse(BaseModel):
    auto_suggest_enabled: bool
    suggestion_count: int
    min_priority_score: float
    preferred_domains: List[str]
    
    @classmethod
    def from_model(cls, prefs: TopicSuggestionPreference) -> "PreferencesResponse":
        return cls(
            auto_suggest_enabled=prefs.auto_suggest_enabled,
            suggestion_count=prefs.suggestion_count,
            min_priority_score=prefs.min_priority_score,
            preferred_domains=prefs.preferred_domains
        )


class PreferencesUpdate(BaseModel):
    auto_suggest_enabled: Optional[bool] = None
    suggestion_count: Optional[int] = None
    min_priority_score: Optional[float] = None
    preferred_domains: Optional[List[str]] = None


class TopicActionResponse(BaseModel):
    success: bool
    message: str
    topic: Optional[TopicResponse] = None


def _resolve_notebook_id(session: Session, user_id: str, notebook_id: Optional[int]) -> int:
    """Resolve notebook ID using the same pattern as ingestion endpoints."""
    if notebook_id is not None:
        return notebook_id
    
    # Import here to avoid circular dependency
    from src.services.models import Notebook
    from sqlmodel import select
    
    # Default notebook per user (create if missing)
    existing = session.exec(
        select(Notebook).where(Notebook.user_id == user_id, Notebook.name == "Default")
    ).first()
    if existing:
        return int(existing.id)
    
    # Create default notebook
    from src.services.models import Notebook
    nb = Notebook(user_id=user_id, name="Default")
    session.add(nb)
    session.commit()
    session.refresh(nb)
    return int(nb.id)


@router.get("/suggestions", response_model=List[TopicResponse])
async def get_topic_suggestions(
    user_id: str = Query(..., description="User ID for notebook identification"),
    notebook_id: Optional[int] = Query(None, description="Notebook ID (optional, uses default if not provided)"),
    status: Optional[TopicStatus] = Query(TopicStatus.pending, description="Filter by topic status"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of topics to return"),
    session: Session = Depends(get_session)
) -> List[TopicResponse]:
    """Get topic suggestions for a user's notebook.
    
    Returns pending topics by default, ordered by priority score and creation time.
    """
    try:
        nid = _resolve_notebook_id(session, user_id, notebook_id)
        service = TopicSuggestionService(session)
        
        if status == TopicStatus.pending:
            topics = await service.get_pending_topics(nid, limit)
        else:
            # For non-pending topics, query directly
            from sqlmodel import select
            topics = session.exec(
                select(SuggestedTopic)
                .where(
                    SuggestedTopic.notebook_id == nid,
                    SuggestedTopic.status == status
                )
                .order_by(SuggestedTopic.created_at.desc())
                .limit(limit)
            ).all()
        
        return [TopicResponse.from_model(topic) for topic in topics]
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve topic suggestions: {str(e)}"
        )


@router.post("/suggestions/{topic_id}/accept", response_model=TopicActionResponse)
async def accept_topic_suggestion(
    topic_id: int,
    background_tasks: BackgroundTasks,
    user_id: str = Query(..., description="User ID for verification"),
    notebook_id: Optional[int] = Query(None, description="Notebook ID (optional)"),
    session: Session = Depends(get_session)
) -> TopicActionResponse:
    """Accept a topic suggestion and trigger research.
    
    This marks the topic as accepted and should trigger the deep research pipeline.
    """
    try:
        nid = _resolve_notebook_id(session, user_id, notebook_id)
        service = TopicSuggestionService(session)
        
        topic = await service.accept_topic(topic_id, nid)
        if not topic:
            return TopicActionResponse(
                success=False,
                message="Topic not found or already processed"
            )
        
        # Trigger deep research in the background
        background_tasks.add_task(_run_topic_research_background, topic)
        
        return TopicActionResponse(
            success=True,
            message="Topic accepted successfully. Research will begin shortly.",
            topic=TopicResponse.from_model(topic)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to accept topic: {str(e)}"
        )


@router.post("/suggestions/{topic_id}/reject", response_model=TopicActionResponse)
async def reject_topic_suggestion(
    topic_id: int,
    user_id: str = Query(..., description="User ID for verification"),
    notebook_id: Optional[int] = Query(None, description="Notebook ID (optional)"),
    session: Session = Depends(get_session)
) -> TopicActionResponse:
    """Reject a topic suggestion.
    
    This marks the topic as rejected and removes it from the pending list.
    """
    try:
        nid = _resolve_notebook_id(session, user_id, notebook_id)
        service = TopicSuggestionService(session)
        
        topic = await service.reject_topic(topic_id, nid)
        if not topic:
            return TopicActionResponse(
                success=False,
                message="Topic not found or already processed"
            )
        
        return TopicActionResponse(
            success=True,
            message="Topic rejected successfully",
            topic=TopicResponse.from_model(topic)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject topic: {str(e)}"
        )


@router.get("/preferences", response_model=PreferencesResponse)
async def get_topic_preferences(
    user_id: str = Query(..., description="User ID for notebook identification"),
    notebook_id: Optional[int] = Query(None, description="Notebook ID (optional)"),
    session: Session = Depends(get_session)
) -> PreferencesResponse:
    """Get topic suggestion preferences for a user's notebook."""
    try:
        nid = _resolve_notebook_id(session, user_id, notebook_id)
        service = TopicSuggestionService(session)
        
        preferences = await service._get_or_create_preferences(nid)
        return PreferencesResponse.from_model(preferences)
        
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve preferences: {str(e)}"
        )


@router.put("/preferences", response_model=PreferencesResponse)
async def update_topic_preferences(
    preferences_update: PreferencesUpdate,
    user_id: str = Query(..., description="User ID for notebook identification"),
    notebook_id: Optional[int] = Query(None, description="Notebook ID (optional)"),
    session: Session = Depends(get_session)
) -> PreferencesResponse:
    """Update topic suggestion preferences for a user's notebook."""
    try:
        nid = _resolve_notebook_id(session, user_id, notebook_id)
        service = TopicSuggestionService(session)
        
        # Filter out None values
        update_data = {
            k: v for k, v in preferences_update.dict().items() 
            if v is not None
        }
        
        if not update_data:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="No valid preferences provided for update"
            )
        
        # Validate ranges
        if "suggestion_count" in update_data:
            count = update_data["suggestion_count"]
            if not (1 <= count <= 5):
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="suggestion_count must be between 1 and 5"
                )
        
        if "min_priority_score" in update_data:
            score = update_data["min_priority_score"]
            if not (0.0 <= score <= 1.0):
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="min_priority_score must be between 0.0 and 1.0"
                )
        
        preferences = await service.update_preferences(nid, **update_data)
        return PreferencesResponse.from_model(preferences)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update preferences: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for topic suggestion service."""
    return {"status": "ok", "service": "topic_suggestions"}


@router.get("/{topic_id}/feed")
async def get_topic_feed(
    topic_id: int,
    user_id: str = Query(..., description="User ID for verification"),
    notebook_id: Optional[int] = Query(None, description="Notebook ID (optional)"),
    session: Session = Depends(get_session)
):
    """Get feed items related to a specific topic."""
    try:
        nid = _resolve_notebook_id(session, user_id, notebook_id)
        
        # Get the topic
        topic = session.get(SuggestedTopic, topic_id)
        if not topic or topic.notebook_id != nid:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Topic not found"
            )
        
        # Get feed items related to this topic's research
        feed_items = []
        if topic.research_summary_id:
            # Find feed item that references this research summary
            from src.services.models import FeedItem, FeedKind
            research_feed_item = session.exec(
                select(FeedItem).where(
                    FeedItem.notebook_id == nid,
                    FeedItem.kind == FeedKind.research,
                    FeedItem.ref_id == topic.research_summary_id
                )
            ).first()
            
            if research_feed_item:
                feed_items.append({
                    "id": research_feed_item.id,
                    "kind": research_feed_item.kind,
                    "ref_id": research_feed_item.ref_id,
                    "created_at": research_feed_item.created_at.isoformat(),
                    "notebook_id": research_feed_item.notebook_id
                })
        
        return {
            "items": feed_items,
            "topic": TopicResponse.from_model(topic),
            "total": len(feed_items)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve topic feed: {str(e)}"
        )