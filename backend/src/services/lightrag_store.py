from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List

try:
    # LightRAG must be installed; follow project README.
    from lightrag import LightRAG, QueryParam  # type: ignore
except Exception:  # pragma: no cover - optional at import time before deps installed
    LightRAG = None  # type: ignore
    QueryParam = None  # type: ignore


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
        self.rag = LightRAG(working_dir=str(self.working_dir))

    def insert(self, chunks: List[Dict[str, Any]]) -> List[str]:
        """Insert text chunks into LightRAG.

        LightRAG's insert accepts a list of strings. We map the incoming chunk dicts
        to the `text` field and ignore empty entries.
        """
        texts = [c.get("text", "").strip() for c in chunks if c.get("text")]
        if not texts:
            return []
        self.rag.insert(texts)
        # LightRAG doesn't return IDs; we synthesize sequential placeholders.
        return [str(i) for i in range(len(texts))]

    def query(self, question: str, mode: str = "hybrid") -> str:
        if QueryParam is None:
            raise RuntimeError("LightRAG QueryParam unavailable. Ensure installation.")
        return self.rag.query(question, param=QueryParam(mode=mode))

    def export_graph(self) -> Dict[str, Any]:
        # Not all versions expose export; guard gracefully.
        exporter = getattr(self.rag, "export_graph", None)
        if callable(exporter):
            return exporter()
        return {"nodes": [], "edges": [], "warning": "export_graph not available"}


