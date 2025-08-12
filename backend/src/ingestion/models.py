from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class KnowledgeChunk(BaseModel):
    """Normalized text unit produced by ingestion.

    Attributes:
        text: Extracted or provided text content.
        source_type: Origin of the chunk (image, audio, document, text).
        source_uri: Local or remote URI/path where the original file is stored.
        metadata: Arbitrary metadata, e.g., filename, page number, timestamps.
    """

    text: str
    source_type: Literal["image", "audio", "document", "text"]
    source_uri: Optional[str] = None
    metadata: Dict = Field(default_factory=dict)


class IngestResponse(BaseModel):
    inserted: int
    ids: List[str]


