from __future__ import annotations

from typing import Iterable, List

from ingestion.models import KnowledgeChunk
from services.lightrag_store import LightRAGStore


def ingest_chunks(chunks: Iterable[KnowledgeChunk], user_id: str) -> List[str]:
    """Persist normalized chunks to LightRAG and return synthesized IDs."""
    store = LightRAGStore(user_id=user_id)
    as_dicts = [c.model_dump() for c in chunks]
    return store.insert(as_dicts)


