from __future__ import annotations

import asyncio
import os
import re
import json
from typing import Iterable, List, Dict, Any, Optional

from fastapi import BackgroundTasks
from langchain_core.messages import HumanMessage

from src.services.llm_provider import get_chat_model


def _provider_and_model() -> tuple[str, str]:
    provider = os.getenv("TRANSFORM_MODEL_PROVIDER", os.getenv("DEFAULT_LLM_PROVIDER", "gemini"))
    model = os.getenv("TRANSFORM_MODEL", os.getenv("DEFAULT_LLM_MODEL", "gemini-1.5-flash"))
    return provider, model


def _run_llm(prompt: str) -> str:
    provider, model = _provider_and_model()
    chat = get_chat_model(provider=provider, model=model, temperature=0.1)
    resp = chat.invoke([HumanMessage(content=prompt)])
    text = getattr(resp, "content", "")
    return text.strip()


def summarize_chunk(text: str) -> str:
    prompt = (
        "Summarize the following content in 2-4 bullet points.\n"
        "Keep it factual and concise.\n\n"
        f"CONTENT:\n{text}\n"
    )
    return _run_llm(prompt)


def parse_summary_response(llm_response: str) -> Dict[str, Any]:
    """Parse summary LLM response into structured metadata.
    
    Extracts bullet points and generates confidence score based on content quality.
    """
    lines = [line.strip() for line in llm_response.strip().split('\n') if line.strip()]
    
    # Extract bullet points (lines starting with bullet markers)
    bullet_patterns = [r'^[•\-\*]\s+', r'^\d+\.\s+', r'^\d+\)\s+']
    key_points = []
    
    for line in lines:
        for pattern in bullet_patterns:
            if re.match(pattern, line):
                # Remove bullet marker and add to key points
                clean_point = re.sub(pattern, '', line).strip()
                if clean_point:
                    key_points.append(clean_point)
                break
    
    # If no bullet points found, split by sentences for key points
    if not key_points:
        sentences = [s.strip() for s in llm_response.split('.') if s.strip()]
        key_points = sentences[:4]  # Take first 4 sentences as key points
    
    # Generate confidence score based on content quality
    confidence_score = min(1.0, max(0.3, len(key_points) / 4.0))
    if len(llm_response.strip()) < 50:
        confidence_score *= 0.7  # Lower confidence for very short summaries
    
    return {
        "summary": llm_response.strip(),
        "key_points": key_points[:4],  # Limit to 4 key points
        "confidence_score": round(confidence_score, 2)
    }


def extract_qa(text: str) -> str:
    prompt = (
        "From the content, extract 3-6 key Q&A pairs in the format:\n"
        "Q: ...\nA: ...\n(Repeat)\n\n"
        f"CONTENT:\n{text}\n"
    )
    return _run_llm(prompt)


def parse_qa_response(llm_response: str) -> Dict[str, Any]:
    """Parse Q&A LLM response into structured question/answer pairs.
    
    Handles various Q&A formats and extracts multiple pairs.
    """
    qa_pairs = []
    lines = llm_response.strip().split('\n')
    
    current_question = None
    current_answer = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Check for question patterns
        q_match = re.match(r'^Q\d*[:\.]?\s*(.+)$', line, re.IGNORECASE)
        if q_match:
            # Save previous Q&A pair if exists
            if current_question and current_answer:
                qa_pairs.append({
                    "question": current_question.strip(),
                    "answer": current_answer.strip()
                })
            current_question = q_match.group(1)
            current_answer = None
            continue
            
        # Check for answer patterns
        a_match = re.match(r'^A\d*[:\.]?\s*(.+)$', line, re.IGNORECASE)
        if a_match:
            current_answer = a_match.group(1)
            continue
            
        # Continue building current answer if we have a question
        if current_question and not current_answer:
            current_answer = line
        elif current_question and current_answer:
            current_answer += " " + line
    
    # Don't forget the last pair
    if current_question and current_answer:
        qa_pairs.append({
            "question": current_question.strip(),
            "answer": current_answer.strip()
        })
    
    # If no structured Q&A found, try to extract from the first pair
    if not qa_pairs and llm_response.strip():
        # Split by newlines and try to find question/answer pattern
        parts = llm_response.strip().split('\n\n')
        if len(parts) >= 2:
            qa_pairs.append({
                "question": parts[0].strip(),
                "answer": parts[1].strip()
            })
    
    # Generate confidence based on number of pairs found
    confidence_score = min(1.0, len(qa_pairs) / 3.0) if qa_pairs else 0.3
    
    return {
        "qa_pairs": qa_pairs[:6],  # Limit to 6 pairs
        "question": qa_pairs[0]["question"] if qa_pairs else "No question available",
        "answer": qa_pairs[0]["answer"] if qa_pairs else "No answer available",
        "confidence_score": round(confidence_score, 2)
    }


def generate_flashcards(text: str) -> str:
    prompt = (
        "Create 5-8 concise flashcards from the content in the format:\n"
        "Front: ...\nBack: ...\n(Repeat)\n\n"
        f"CONTENT:\n{text}\n"
    )
    return _run_llm(prompt)


def parse_flashcard_response(llm_response: str) -> Dict[str, Any]:
    """Parse flashcard LLM response into structured front/back pairs.
    
    Handles 'Front: X Back: Y' format and extracts multiple cards.
    """
    cards = []
    
    # Split by double newlines to separate cards
    card_blocks = llm_response.strip().split('\n\n')
    
    for block in card_blocks:
        lines = [line.strip() for line in block.split('\n') if line.strip()]
        
        front_text = None
        back_text = None
        
        for line in lines:
            # Check for Front: pattern
            front_match = re.match(r'^Front:\s*(.+)$', line, re.IGNORECASE)
            if front_match:
                front_text = front_match.group(1).strip()
                continue
                
            # Check for Back: pattern
            back_match = re.match(r'^Back:\s*(.+)$', line, re.IGNORECASE)
            if back_match:
                back_text = back_match.group(1).strip()
                continue
                
            # If we have front but no back pattern, this might be continuation
            if front_text and not back_text and not line.lower().startswith('back:'):
                back_text = line.strip()
        
        # Add card if we have both front and back
        if front_text and back_text:
            # Determine difficulty based on content length and complexity
            difficulty = "medium"  # default
            if len(front_text) < 30 and len(back_text) < 50:
                difficulty = "easy"
            elif len(front_text) > 80 or len(back_text) > 150:
                difficulty = "hard"
                
            cards.append({
                "front": front_text,
                "back": back_text,
                "difficulty": difficulty,
                "category": "general"  # default category
            })
    
    # If no structured cards found, try to parse as single block
    if not cards:
        # Look for any Front/Back pattern in the entire response
        front_match = re.search(r'Front:\s*(.+?)(?=Back:|$)', llm_response, re.IGNORECASE | re.DOTALL)
        back_match = re.search(r'Back:\s*(.+?)(?=Front:|$)', llm_response, re.IGNORECASE | re.DOTALL)
        
        if front_match and back_match:
            cards.append({
                "front": front_match.group(1).strip(),
                "back": back_match.group(1).strip(),
                "difficulty": "medium",
                "category": "general"
            })
    
    # Fallback: create a single card from the entire content
    if not cards and llm_response.strip():
        # Split content roughly in half for front/back
        content_lines = [line.strip() for line in llm_response.strip().split('\n') if line.strip()]
        if len(content_lines) >= 2:
            mid_point = len(content_lines) // 2
            front_lines = content_lines[:mid_point]
            back_lines = content_lines[mid_point:]
            
            cards.append({
                "front": " ".join(front_lines),
                "back": " ".join(back_lines),
                "difficulty": "medium",
                "category": "general"
            })
    
    return {
        "cards": cards[:8],  # Limit to 8 cards
        "front": cards[0]["front"] if cards else "No question available",
        "back": cards[0]["back"] if cards else "No answer available",
        "difficulty": cards[0]["difficulty"] if cards else "medium",
        "category": cards[0]["category"] if cards else "general",
        "total_cards": len(cards)
    }


def _run_transformations(chunk_texts: Iterable[str]) -> List[Dict[str, Any]]:
    """Generate structured transformations with parsed metadata.
    
    Returns artifacts with both raw content and structured metadata
    for improved frontend card rendering.
    """
    artifacts: List[Dict[str, Any]] = []
    for text in chunk_texts:
        if not text.strip():
            continue
            
        # Generate LLM responses
        summary_raw = summarize_chunk(text)
        qa_raw = extract_qa(text)
        flash_raw = generate_flashcards(text)
        
        # Parse responses into structured metadata
        summary_parsed = parse_summary_response(summary_raw)
        qa_parsed = parse_qa_response(qa_raw)
        flash_parsed = parse_flashcard_response(flash_raw)
        
        # Create summary artifact with structured metadata
        artifacts.append({
            "type": "summary",
            "content": summary_raw,  # Keep original for backward compatibility
            "metadata": summary_parsed,
        })
        
        # Create Q&A artifact with structured metadata
        artifacts.append({
            "type": "qa",
            "content": qa_raw,  # Keep original for backward compatibility
            "metadata": qa_parsed,
        })
        
        # Create flashcards artifact with structured metadata
        artifacts.append({
            "type": "flashcards",
            "content": flash_raw,  # Keep original for backward compatibility
            "metadata": flash_parsed,
        })
    return artifacts


def run_transformations_in_background(
    background_tasks: Optional[BackgroundTasks],
    *,
    user_id: str,
    notebook_id: int,
    chunk_ids: List[str],
    chunk_texts: List[str],
) -> None:
    """Schedule transformation generation and persist to DB and LightRAG.

    - Writes `TransformedItem` rows for summary, qa, flashcards.
    - Creates `FeedItem` rows for each artifact.
    - Mirrors artifact text into LightRAG for continuity.
    """
    from src.services.lightrag_store import LightRAGStore
    from src.services.db import session_scope
    from src.services.models import TransformedItem, TransformedType, FeedItem, FeedKind

    async def _async_task() -> None:
        """Async task to handle transformations with non-blocking database operations."""
        artifacts = _run_transformations(chunk_texts)

        # Use async thread for database operations to prevent blocking ASGI
        mirror_texts = await asyncio.to_thread(
            _store_artifacts_sync, artifacts, notebook_id
        )

        if mirror_texts:
            store = LightRAGStore(user_id=user_id)
            try:
                # Run async insert in the background task
                await store.insert(mirror_texts)
            except Exception as e:
                # Log the error but don't fail the background task
                print(f"Warning: Failed to mirror transformations to LightRAG: {e}")
    
    def _task() -> None:
        """Synchronous wrapper for background task compatibility."""
        # Run the async task in a new event loop to prevent blocking
        asyncio.run(_async_task())

    if background_tasks is not None:
        background_tasks.add_task(_task)
    else:
        _task()


def _store_artifacts_sync(
    artifacts: List[Dict[str, Any]], 
    notebook_id: int
) -> List[Dict[str, str]]:
    """Synchronous helper to store artifacts in database.
    
    This function runs in a separate thread to prevent blocking ASGI.
    Returns mirror_texts for LightRAG insertion.
    """
    from src.services.db import session_scope
    from src.services.models import TransformedItem, TransformedType, FeedItem, FeedKind
    
    mirror_texts: List[Dict[str, str]] = []
    
    with session_scope() as session:
        for idx, a in enumerate(artifacts):
            typ = a["type"]
            content = a["content"].strip()
            # Map artifacts back to chunk id by simple round-robin
            chunk_ref_id: Optional[int] = None
            try:
                # Chunk IDs are synthesized strings from LightRAG insert; DB ids are separate.
                # We cannot map precisely without returning DB IDs earlier; leave as None.
                chunk_ref_id = None
            except Exception:
                chunk_ref_id = None

            item = TransformedItem(
                notebook_id=notebook_id,
                chunk_id=chunk_ref_id,
                type=TransformedType(typ if typ != "flashcards" else "flashcard"),
                text=content,
                metadata_json=a.get("metadata", {}),  # Store structured metadata
            )
            session.add(item)
            session.commit()
            session.refresh(item)

            # Feed entry
            feed = FeedItem(
                notebook_id=notebook_id,
                kind=FeedKind.summary if item.type == TransformedType.summary else (
                    FeedKind.qa if item.type == TransformedType.qa else FeedKind.flashcard
                ),
                ref_id=item.id,  # type: ignore[arg-type]
            )
            session.add(feed)
            session.commit()

            mirror_texts.append({"text": f"[{item.type.value.upper()}]\n{content}"})
    
    return mirror_texts


