from __future__ import annotations

import os
from fastapi import APIRouter, File, Form, UploadFile

from ingestion.extractors import (
    extract_text_from_document,
    extract_text_from_image,
    transcribe_audio_to_text,
)
from ingestion.models import IngestResponse, KnowledgeChunk
from ingestion.pipeline import ingest_chunks
from ingestion.config import get_ingestion_defaults


router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/text", response_model=IngestResponse)
async def ingest_text_endpoint(text: str = Form(...), user_id: str = Form("anon")):
    chunk = KnowledgeChunk(text=text, source_type="text", metadata={"ingest": "text"})
    ids = ingest_chunks([chunk], user_id)
    return IngestResponse(inserted=len(ids), ids=ids)


def _save_upload(file: UploadFile) -> str:
    tmp_dir = os.getenv("UPLOAD_TMP_DIR", "/tmp")
    path = os.path.join(tmp_dir, file.filename)
    with open(path, "wb") as f:
        f.write(file.file.read())
    return path


@router.post("/document", response_model=IngestResponse)
async def ingest_document_endpoint(file: UploadFile = File(...), user_id: str = Form("anon")):
    path = _save_upload(file)
    ids = ingest_chunks(extract_text_from_document(path), user_id)
    return IngestResponse(inserted=len(ids), ids=ids)


@router.post("/image", response_model=IngestResponse)
async def ingest_image_endpoint(
    file: UploadFile = File(...),
    user_id: str = Form("anon"),
    vision_provider: str | None = Form(None),
):
    defaults = get_ingestion_defaults()
    provider = (vision_provider or defaults["image_processor"]).lower()
    path = _save_upload(file)
    ids = ingest_chunks(extract_text_from_image(path, provider=provider), user_id)
    return IngestResponse(inserted=len(ids), ids=ids)


@router.post("/audio", response_model=IngestResponse)
async def ingest_audio_endpoint(
    file: UploadFile = File(...),
    user_id: str = Form("anon"),
    asr_provider: str = Form("whisper"),
):
    """Ingest audio by transcribing with the selected ASR provider.

    Args:
        file: Uploaded audio blob (e.g., audio/webm).
        user_id: User scope for the LightRAG store.
        asr_provider: "whisper" (default) or "gemini" (not yet available server-side).
    """
    defaults = get_ingestion_defaults()
    provider = (asr_provider or defaults["audio_asr_provider"]).lower()
    path = _save_upload(file)
    ids = ingest_chunks(transcribe_audio_to_text(path, provider=provider), user_id)
    return IngestResponse(inserted=len(ids), ids=ids)


