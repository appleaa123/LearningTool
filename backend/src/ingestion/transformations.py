from __future__ import annotations

import os
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


def extract_qa(text: str) -> str:
    prompt = (
        "From the content, extract 3-6 key Q&A pairs in the format:\n"
        "Q: ...\nA: ...\n(Repeat)\n\n"
        f"CONTENT:\n{text}\n"
    )
    return _run_llm(prompt)


def generate_flashcards(text: str) -> str:
    prompt = (
        "Create 5-8 concise flashcards from the content in the format:\n"
        "Front: ...\nBack: ...\n(Repeat)\n\n"
        f"CONTENT:\n{text}\n"
    )
    return _run_llm(prompt)


def _run_transformations(chunk_texts: Iterable[str]) -> List[Dict[str, Any]]:
    artifacts: List[Dict[str, Any]] = []
    for text in chunk_texts:
        if not text.strip():
            continue
        summary = summarize_chunk(text)
        qa = extract_qa(text)
        flash = generate_flashcards(text)
        artifacts.append({
            "type": "summary",
            "content": summary,
        })
        artifacts.append({
            "type": "qa",
            "content": qa,
        })
        artifacts.append({
            "type": "flashcards",
            "content": flash,
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
    from services.lightrag_store import LightRAGStore
    from services.db import session_scope
    from services.models import TransformedItem, TransformedType, FeedItem, FeedKind

    def _task() -> None:
        artifacts = _run_transformations(chunk_texts)

        with session_scope() as session:
            # Persist and collect text payloads for LightRAG
            mirror_texts: List[Dict[str, str]] = []
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
                    metadata_json={},
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

        if mirror_texts:
            store = LightRAGStore(user_id=user_id)
            store.insert(mirror_texts)

    if background_tasks is not None:
        background_tasks.add_task(_task)
    else:
        _task()


