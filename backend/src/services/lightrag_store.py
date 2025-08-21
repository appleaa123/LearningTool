from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List

try:
    # LightRAG must be installed; follow project README.
    from lightrag import LightRAG, QueryParam  # type: ignore
    from lightrag.llm.openai import openai_embed, gpt_4o_mini_complete  # type: ignore
    from lightrag.kg.shared_storage import initialize_pipeline_status  # type: ignore
except Exception:  # pragma: no cover - optional at import time before deps installed
    LightRAG = None  # type: ignore
    QueryParam = None  # type: ignore
    openai_embed = None  # type: ignore
    gpt_4o_mini_complete = None  # type: ignore
    initialize_pipeline_status = None  # type: ignore


class LightRAGStore:
    """User-scoped LightRAG wrapper for insert/query/export.

    Each user gets its own working directory to ensure isolation. The store exposes
    simple `insert`, `query`, and `export_graph` methods used by the ingestion and
    assistant routes.
    """

    def __init__(self, user_id: str = "anon") -> None:
        base_dir = os.getenv("LIGHTRAG_BASE_DIR", "/data/lightrag")
        self.working_dir = Path(base_dir) / user_id
        self.working_dir.mkdir(parents=True, exist_ok=True)
        if LightRAG is None:
            raise RuntimeError(
                "LightRAG is not installed. Please add 'lightrag' to dependencies."
            )
        if openai_embed is None or gpt_4o_mini_complete is None:
            raise RuntimeError(
                "LightRAG OpenAI functions unavailable. Ensure installation."
            )
        self.rag = LightRAG(
            working_dir=str(self.working_dir),
            embedding_func=openai_embed,
            llm_model_func=gpt_4o_mini_complete,
        )
        # Initialize storage and pipeline - this is needed for async operations
        self._initialized = False

    async def _ensure_initialized(self) -> None:
        """Ensure LightRAG storages are initialized before operations."""
        if not self._initialized:
            if initialize_pipeline_status is None:
                raise RuntimeError("LightRAG pipeline status function unavailable.")
            await self.rag.initialize_storages()
            await initialize_pipeline_status()
            self._initialized = True

    async def insert(self, chunks: List[Dict[str, Any]]) -> List[str]:
        """Insert text chunks into LightRAG.

        LightRAG's insert accepts a list of strings. We map the incoming chunk dicts
        to the `text` field and ignore empty entries.
        
        Includes workaround for LightRAG v1.4.6 UnboundLocalError bug.
        """
        await self._ensure_initialized()
        texts = [c.get("text", "").strip() for c in chunks if c.get("text")]
        if not texts:
            return []
        
        try:
            await self.rag.ainsert(texts)
            # LightRAG doesn't return IDs; we synthesize sequential placeholders.
            return [str(i) for i in range(len(texts))]
        except UnboundLocalError as e:
            # Handle LightRAG v1.4.6 bug: "cannot access local variable 'first_stage_tasks'"
            if "first_stage_tasks" in str(e):
                logging.warning(f"LightRAG v1.4.6 bug encountered: {e}. Document ingestion skipped.")
                # Return empty list to indicate insertion failed gracefully
                # This allows the system to continue operating without crashing
                raise RuntimeError(
                    "Document ingestion temporarily unavailable due to LightRAG library bug. "
                    "Please try again later or contact support."
                ) from e
            else:
                # Re-raise other UnboundLocalErrors as they might be different issues
                raise
        except Exception as e:
            # Log other unexpected errors for debugging
            logging.error(f"Unexpected error during LightRAG insertion: {e}")
            raise RuntimeError(f"Failed to ingest document: {e}") from e

    async def query(self, question: str, mode: str = "hybrid") -> str:
        await self._ensure_initialized()
        if QueryParam is None:
            raise RuntimeError("LightRAG QueryParam unavailable. Ensure installation.")
        return await self.rag.aquery(question, param=QueryParam(mode=mode))

    def export_graph(self) -> Dict[str, Any]:
        # Not all versions expose export; guard gracefully.
        exporter = getattr(self.rag, "export_graph", None)
        if callable(exporter):
            return exporter()
        return {"nodes": [], "edges": [], "warning": "export_graph not available"}