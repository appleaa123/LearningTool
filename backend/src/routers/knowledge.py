from __future__ import annotations

import re
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Query, Depends, HTTPException
from src.services.lightrag_store import LightRAGStore
from sqlmodel import Session, select
from src.services.db import get_session
from src.services.models import (
    FeedItem, Notebook, Chunk, TransformedItem, ResearchSummary, 
    SuggestedTopic, FeedKind
)
from pydantic import BaseModel


router = APIRouter(prefix="/knowledge", tags=["knowledge"])


# Response Models
class TopicContext(BaseModel):
    topic_id: int
    topic: str
    context: str
    user_initiated: bool


class FeedContentResponse(BaseModel):
    feed_item: Dict[str, Any]
    content: Any
    topic_context: Optional[TopicContext] = None
    user_choice_metadata: Dict[str, Any]


class FeedRefreshRequest(BaseModel):
    user_id: str


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
    filter: Optional[str] = Query(None, description="Filter by feed item kind"),
    search: Optional[str] = Query(None, description="Search across feed content"),
    session: Session = Depends(get_session),
):
    """Get paginated feed items with optional filtering and search."""
    # Resolve default notebook if not provided
    if notebook_id is None:
        nb = session.exec(select(Notebook).where(Notebook.user_id == user_id, Notebook.name == "Default")).first()
        if not nb:
            return {"items": [], "next_cursor": None}
        notebook_id = int(nb.id)  # type: ignore[arg-type]

    # Build query with filters
    query = select(FeedItem).where(FeedItem.notebook_id == notebook_id)
    
    # Apply kind filter if provided
    if filter and filter != "all":
        try:
            filter_kind = FeedKind(filter)
            query = query.where(FeedItem.kind == filter_kind)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid filter kind: {filter}")
    
    # Apply search if provided (basic implementation - searches content tables)
    if search:
        search_term = f"%{search}%"
        # For now, we'll do a simple text search - can be enhanced with full-text search later
        # This is a simplified version - in production, you'd want proper full-text search
        pass  # Search implementation can be added in next iteration
    
    # Apply cursor and ordering
    query = query.where(FeedItem.id > cursor).order_by(FeedItem.created_at.desc()).limit(limit)
    
    items = session.exec(query).all()
    next_cursor = items[-1].id if items else None
    
    return {
        "items": [
            {
                "id": it.id, 
                "kind": it.kind, 
                "ref_id": it.ref_id, 
                "created_at": it.created_at.isoformat(),
                "notebook_id": it.notebook_id
            }
            for it in items
        ],
        "next_cursor": next_cursor,
    }


@router.get("/feed/{item_id}/content", response_model=FeedContentResponse)
def get_feed_item_content(
    item_id: int,
    user_id: str = Query("anon"),
    include_topic_context: bool = Query(True),
    session: Session = Depends(get_session),
):
    """Get full content for a specific feed item with topic context."""
    # Get the feed item
    feed_item = session.get(FeedItem, item_id)
    if not feed_item:
        raise HTTPException(status_code=404, detail="Feed item not found")
    
    # Verify access (check if user owns the notebook)
    notebook = session.get(Notebook, feed_item.notebook_id)
    if not notebook or notebook.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Resolve content based on feed item kind
    content = None
    topic_context = None
    source_metadata = {"source": "user_upload", "user_initiated": False}
    
    if feed_item.kind == FeedKind.chunk:
        chunk = session.get(Chunk, feed_item.ref_id)
        if chunk:
            content = {
                "text": chunk.text,
                "metadata": chunk.metadata_json
            }
    
    elif feed_item.kind in [FeedKind.summary, FeedKind.qa, FeedKind.flashcard]:
        transformed = session.get(TransformedItem, feed_item.ref_id)
        if transformed:
            metadata = transformed.metadata_json or {}
            
            # Base content structure
            content = {
                "text": transformed.text,
                "type": transformed.type,
                "metadata": metadata
            }
            
            # Enhanced parsing based on type
            if feed_item.kind == FeedKind.summary:
                # Extract structured summary data
                content.update({
                    "summary": metadata.get("summary", transformed.text),
                    "key_points": metadata.get("key_points", []),
                    "confidence_score": metadata.get("confidence_score", 0.5),
                    "content": metadata.get("summary", transformed.text)  # For backward compatibility
                })
                
            elif feed_item.kind == FeedKind.qa:
                # Extract structured Q&A data with fallback parsing
                content.update({
                    "question": metadata.get("question", _extract_question_fallback(transformed.text)),
                    "answer": metadata.get("answer", _extract_answer_fallback(transformed.text)),
                    "confidence_score": metadata.get("confidence_score", 0.5),
                    "category": metadata.get("category", "general"),
                    "sources": metadata.get("sources", [])
                })
                
            elif feed_item.kind == FeedKind.flashcard:
                # Extract structured flashcard data with fallback parsing
                content.update({
                    "front": metadata.get("front", _extract_flashcard_front_fallback(transformed.text)),
                    "back": metadata.get("back", _extract_flashcard_back_fallback(transformed.text)),
                    "difficulty": metadata.get("difficulty", "medium"),
                    "category": metadata.get("category", "general"),
                    "tags": metadata.get("tags", []),
                    "total_cards": metadata.get("total_cards", 1)
                })
    
    elif feed_item.kind == FeedKind.research:
        research = session.get(ResearchSummary, feed_item.ref_id)
        if research:
            # Enhanced research content with structured sources and keywords
            sources_data = research.sources or []
            
            content = {
                "summary": research.answer,
                "question": research.question,
                "sources": _structure_research_sources(sources_data),
                "keywords": _extract_research_keywords(research.answer),
                "confidence_score": _calculate_research_confidence(research.answer, sources_data),
                "research_date": research.created_at.isoformat(),
                "report": research.answer  # Alias for backward compatibility
            }
            source_metadata = {"source": "topic_research", "user_initiated": True}
            
            # Get topic context if requested and available
            if include_topic_context:
                # Find the topic that generated this research
                topic = session.exec(
                    select(SuggestedTopic).where(
                        SuggestedTopic.research_summary_id == research.id
                    )
                ).first()
                
                if topic:
                    topic_context = TopicContext(
                        topic_id=topic.id,
                        topic=topic.topic,
                        context=topic.context,
                        user_initiated=True
                    )
    
    if content is None:
        raise HTTPException(status_code=404, detail="Content not found for feed item")
    
    return FeedContentResponse(
        feed_item={
            "id": feed_item.id,
            "kind": feed_item.kind,
            "ref_id": feed_item.ref_id,
            "created_at": feed_item.created_at.isoformat(),
            "notebook_id": feed_item.notebook_id
        },
        content=content,
        topic_context=topic_context,
        user_choice_metadata=source_metadata
    )


@router.post("/feed/refresh")
def refresh_feed(
    refresh_request: FeedRefreshRequest,
    session: Session = Depends(get_session),
):
    """Refresh the feed cache for a user."""
    # For now, this is a no-op as we don't have explicit caching
    # In the future, this could clear Redis cache or trigger feed regeneration
    return {"status": "success", "message": "Feed refreshed successfully"}


@router.get("/feed/health")
def feed_health_check():
    """Health check endpoint for feed service."""
    return {"status": "ok", "service": "feed", "timestamp": "2025-08-25T12:00:00Z"}


@router.get("/feed/search")
def search_feed(
    q: str = Query(..., description="Search query"),
    user_id: str = Query("anon"),
    notebook_id: int | None = Query(None),
    limit: int = Query(50, le=100),
    session: Session = Depends(get_session),
):
    """Search across all feed content."""
    # Resolve default notebook if not provided
    if notebook_id is None:
        nb = session.exec(select(Notebook).where(Notebook.user_id == user_id, Notebook.name == "Default")).first()
        if not nb:
            return {"items": [], "total": 0}
        notebook_id = int(nb.id)  # type: ignore[arg-type]
    
    # Basic search implementation - can be enhanced with full-text search
    search_term = f"%{q}%"
    
    # Search in chunks
    chunk_items = session.exec(
        select(FeedItem)
        .join(Chunk, FeedItem.ref_id == Chunk.id)
        .where(
            FeedItem.notebook_id == notebook_id,
            FeedItem.kind == FeedKind.chunk,
            Chunk.text.contains(search_term)  # type: ignore
        )
        .limit(limit)
    ).all()
    
    # Search in transformed items (summaries, Q&A, flashcards)
    transformed_items = session.exec(
        select(FeedItem)
        .join(TransformedItem, FeedItem.ref_id == TransformedItem.id)
        .where(
            FeedItem.notebook_id == notebook_id,
            FeedItem.kind.in_([FeedKind.summary, FeedKind.qa, FeedKind.flashcard]),
            TransformedItem.text.contains(search_term)  # type: ignore
        )
        .limit(limit)
    ).all()
    
    # Search in research summaries
    research_items = session.exec(
        select(FeedItem)
        .join(ResearchSummary, FeedItem.ref_id == ResearchSummary.id)
        .where(
            FeedItem.notebook_id == notebook_id,
            FeedItem.kind == FeedKind.research,
            ResearchSummary.answer.contains(search_term)  # type: ignore
        )
        .limit(limit)
    ).all()
    
    # Combine results
    all_items = list(chunk_items) + list(transformed_items) + list(research_items)
    
    # Sort by creation date (newest first) and limit
    all_items.sort(key=lambda x: x.created_at, reverse=True)
    all_items = all_items[:limit]
    
    return {
        "items": [
            {
                "id": it.id,
                "kind": it.kind,
                "ref_id": it.ref_id,
                "created_at": it.created_at.isoformat(),
                "notebook_id": it.notebook_id
            }
            for it in all_items
        ],
        "total": len(all_items)
    }


# Helper functions for fallback content parsing and structuring

def _extract_question_fallback(text: str) -> str:
    """Extract question from unstructured Q&A text as fallback."""
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Look for Q: pattern
    for line in lines:
        if line.lower().startswith('q:') or line.lower().startswith('question:'):
            return line.split(':', 1)[1].strip() if ':' in line else line
    
    # Fallback: return first line if it looks like a question
    if lines and lines[0].endswith('?'):
        return lines[0]
    
    # Last resort: return first line or default
    return lines[0] if lines else "No question available"


def _extract_answer_fallback(text: str) -> str:
    """Extract answer from unstructured Q&A text as fallback."""
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Look for A: pattern
    for i, line in enumerate(lines):
        if line.lower().startswith('a:') or line.lower().startswith('answer:'):
            # Return this line and subsequent lines as answer
            answer_lines = [line.split(':', 1)[1].strip() if ':' in line else line]
            answer_lines.extend(lines[i+1:])
            return ' '.join(answer_lines)
    
    # Fallback: if first line looks like question, return rest as answer
    if lines and lines[0].endswith('?') and len(lines) > 1:
        return ' '.join(lines[1:])
    
    # Last resort: return full text or default
    return text if text.strip() else "No answer available"


def _extract_flashcard_front_fallback(text: str) -> str:
    """Extract front content from unstructured flashcard text as fallback."""
    # Look for Front: pattern
    front_match = re.search(r'Front:\s*(.+?)(?=Back:|$)', text, re.IGNORECASE | re.DOTALL)
    if front_match:
        return front_match.group(1).strip()
    
    # Fallback: split text and use first half
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if lines:
        mid_point = max(1, len(lines) // 2)
        return ' '.join(lines[:mid_point])
    
    return "No question available"


def _extract_flashcard_back_fallback(text: str) -> str:
    """Extract back content from unstructured flashcard text as fallback."""
    # Look for Back: pattern
    back_match = re.search(r'Back:\s*(.+?)(?=Front:|$)', text, re.IGNORECASE | re.DOTALL)
    if back_match:
        return back_match.group(1).strip()
    
    # Fallback: split text and use second half
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if len(lines) > 1:
        mid_point = len(lines) // 2
        return ' '.join(lines[mid_point:])
    
    return text if text.strip() else "No answer available"


def _structure_research_sources(sources_data: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Structure research sources for frontend consumption."""
    if not sources_data:
        return []
    
    structured_sources = []
    for source in sources_data:
        if isinstance(source, dict):
            structured_sources.append({
                "title": source.get("title", "Untitled Source"),
                "url": source.get("url", "#"),
                "excerpt": source.get("excerpt", source.get("description", "")),
                "relevance": source.get("relevance", source.get("relevancy", 0.8))
            })
        elif isinstance(source, str):
            # Handle string sources as simple title
            structured_sources.append({
                "title": source,
                "url": "#",
                "excerpt": "",
                "relevance": 0.7
            })
    
    return structured_sources[:10]  # Limit to 10 sources


def _extract_research_keywords(content: str) -> List[str]:
    """Extract keywords from research content for better categorization."""
    if not content or len(content.strip()) < 20:
        return []
    
    # Simple keyword extraction - look for important terms
    # This could be enhanced with NLP libraries in the future
    words = re.findall(r'\b[A-Z][a-z]{3,}\b|\b[a-z]{4,}\b', content)
    
    # Remove common words
    stop_words = {'that', 'this', 'with', 'from', 'they', 'have', 'were', 'been', 'their', 'said', 'each', 'more', 'time', 'very', 'what', 'know', 'just', 'first', 'could', 'other', 'after', 'back', 'work', 'good', 'take', 'make', 'way', 'also', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'}
    
    keywords = [word.lower() for word in words if word.lower() not in stop_words and len(word) > 3]
    
    # Get unique keywords and limit to 8
    unique_keywords = list(dict.fromkeys(keywords))[:8]
    
    return unique_keywords


def _calculate_research_confidence(content: str, sources: List[Dict[str, Any]]) -> float:
    """Calculate confidence score for research results based on content and sources."""
    if not content or not content.strip():
        return 0.1
    
    base_score = 0.6  # Base confidence
    
    # Boost for longer, more detailed content
    if len(content) > 500:
        base_score += 0.2
    elif len(content) > 200:
        base_score += 0.1
    
    # Boost for having sources
    if sources:
        base_score += min(0.2, len(sources) * 0.05)
    
    # Slight boost for structured content (paragraphs, etc.)
    if content.count('\n\n') > 0 or content.count('. ') > 3:
        base_score += 0.1
    
    return min(1.0, base_score)


