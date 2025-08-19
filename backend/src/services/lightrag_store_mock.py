from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List


class LightRAGStore:
    """Mock LightRAG wrapper for testing purposes.
    
    This is a temporary implementation to allow API testing while we resolve
    the LightRAG library import issues.
    """

    def __init__(self, user_id: str = "anon") -> None:
        base_dir = os.getenv("LIGHTRAG_BASE_DIR", "/tmp/lightrag")
        self.working_dir = Path(base_dir) / user_id
        self.working_dir.mkdir(parents=True, exist_ok=True)
        # Store chunks in a simple JSON file for now
        self.chunks_file = self.working_dir / "chunks.txt"

    def insert(self, chunks: List[Dict[str, Any]]) -> List[str]:
        """Insert text chunks into mock storage."""
        texts = [c.get("text", "").strip() for c in chunks if c.get("text")]
        if not texts:
            return []
        
        # Append to simple text file
        with open(self.chunks_file, "a", encoding="utf-8") as f:
            for i, text in enumerate(texts):
                f.write(f"CHUNK_{len(texts)}_ID_{i}: {text}\n")
        
        # Return mock IDs
        return [f"mock_id_{i}" for i in range(len(texts))]

    def query(self, question: str, mode: str = "hybrid") -> str:
        """Mock query that returns stored chunks mentioning keywords."""
        if not self.chunks_file.exists():
            return "No knowledge chunks found."
        
        with open(self.chunks_file, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Simple keyword matching
        question_words = question.lower().split()
        lines = content.split("\n")
        relevant_lines = []
        
        for line in lines:
            if any(word in line.lower() for word in question_words):
                relevant_lines.append(line)
        
        if relevant_lines:
            return f"Found {len(relevant_lines)} relevant chunks:\n" + "\n".join(relevant_lines)
        else:
            return f"No chunks found matching '{question}'. Available chunks: {len(lines)}"

    def export_graph(self) -> Dict[str, Any]:
        """Mock graph export."""
        return {
            "nodes": [{"id": "mock_node", "label": "Mock Knowledge"}],
            "edges": [],
            "warning": "This is a mock implementation"
        }