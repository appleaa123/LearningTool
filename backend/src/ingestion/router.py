from __future__ import annotations

import os
import re
import secrets
import time
from pathlib import Path
from typing import Iterable

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
    Depends,
)

from src.ingestion.extractors import (
    extract_text_from_document,
    extract_text_from_image,
    transcribe_audio_to_text,
)
from src.ingestion.models import IngestResponse, KnowledgeChunk
from src.ingestion.pipeline import ingest_chunks
from src.ingestion.config import get_ingestion_defaults
from src.ingestion.transformations import run_transformations_in_background
from sqlmodel import Session, select
from src.services.db import get_session
from src.services.models import Notebook


router = APIRouter(prefix="/ingest", tags=["ingest"])


def _resolve_notebook_id(session: Session, user_id: str, notebook_id: int | None) -> int:
    if notebook_id is not None:
        return notebook_id
    # Default notebook per user (create if missing)
    existing = session.exec(select(Notebook).where(Notebook.user_id == user_id, Notebook.name == "Default")).first()
    if existing:
        return int(existing.id)  # type: ignore[arg-type]
    nb = Notebook(user_id=user_id, name="Default")
    session.add(nb)
    session.commit()
    session.refresh(nb)
    return int(nb.id)  # type: ignore[arg-type]


@router.post("/text", response_model=IngestResponse)
async def ingest_text_endpoint(
    background_tasks: BackgroundTasks,
    text: str = Form(...),
    user_id: str = Form("anon"),
    notebook_id: int | None = Form(None),
    session: Session = Depends(get_session),
):
    nid = _resolve_notebook_id(session, user_id, notebook_id)
    chunk = KnowledgeChunk(text=text, source_type="text", metadata={"ingest": "text"})
    ids = ingest_chunks([chunk], user_id, notebook_id=nid)
    # Background transformations linked to notebook
    run_transformations_in_background(background_tasks, user_id=user_id, notebook_id=nid, chunk_ids=ids, chunk_texts=[chunk.text])
    return IngestResponse(inserted=len(ids), ids=ids)


def _sanitize_filename(filename: str) -> str:
    name = os.path.basename(filename)
    # Keep alphanum, dash, underscore, dot; replace others with underscore
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    # Avoid hidden files or empty names
    return name or f"upload_{int(time.time())}"


def _unique_path(tmp_dir: str, filename: str) -> Path:
    sanitized = _sanitize_filename(filename)
    stem = ".".join(sanitized.split(".")[:-1]) if "." in sanitized else sanitized
    ext = sanitized.split(".")[-1] if "." in sanitized else ""
    rand = secrets.token_hex(4)
    ts = int(time.time())
    unique = f"{stem}-{ts}-{rand}{('.' + ext) if ext else ''}"
    return Path(tmp_dir) / unique


ALLOWED_PATTERNS: Iterable[str] = (
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.",
    "text/",
    "image/",
    "audio/",
)


def _is_allowed_content_type(content_type: str | None) -> bool:
    if not content_type:
        return False
    for pat in ALLOWED_PATTERNS:
        if content_type == pat or content_type.startswith(pat):
            return True
    return False


def _save_upload(file: UploadFile) -> str:
    """Stream the uploaded file to disk with validation and unique name.

    - Enforces allowlisted content types
    - Enforces max size (50 MB)
    - Uses a sanitized, unique filename in UPLOAD_TMP_DIR
    """
    max_bytes = 50 * 1024 * 1024  # 50 MB
    if not _is_allowed_content_type(getattr(file, "content_type", None)):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type: {file.content_type}",
        )

    tmp_dir = os.getenv("UPLOAD_TMP_DIR", "/tmp")
    Path(tmp_dir).mkdir(parents=True, exist_ok=True)
    out_path = _unique_path(tmp_dir, file.filename or "upload.bin")

    bytes_written = 0
    try:
        with open(out_path, "wb") as f:
            while True:
                chunk = file.file.read(1024 * 1024)  # 1MB
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File exceeds 50MB limit",
                    )
                f.write(chunk)
    except HTTPException:
        # Cleanup partial file on validation failure
        try:
            out_path.unlink(missing_ok=True)  # type: ignore[arg-type]
        finally:
            pass
        raise
    except Exception as exc:
        try:
            out_path.unlink(missing_ok=True)  # type: ignore[arg-type]
        finally:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {exc}")

    return str(out_path)


@router.post("/document", response_model=IngestResponse)
async def ingest_document_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form("anon"),
    notebook_id: int | None = Form(None),
    session: Session = Depends(get_session),
):
    try:
        path = _save_upload(file)
        chunks = extract_text_from_document(path)
        nid = _resolve_notebook_id(session, user_id, notebook_id)
        ids = ingest_chunks(chunks, user_id, notebook_id=nid)
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as exc:
        # Map known ingestion issues to 422
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # unexpected
        raise HTTPException(status_code=400, detail=f"Failed to ingest document: {exc}")

    # Schedule background content transformations (persisted per notebook/chunk)
    run_transformations_in_background(background_tasks, user_id=user_id, notebook_id=nid, chunk_ids=ids, chunk_texts=[c.text for c in chunks])
    return IngestResponse(inserted=len(ids), ids=ids)


@router.post("/image", response_model=IngestResponse)
async def ingest_image_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form("anon"),
    notebook_id: int | None = Form(None),
    vision_provider: str | None = Form(None),
    session: Session = Depends(get_session),
):
    defaults = get_ingestion_defaults()
    provider = (vision_provider or defaults["image_processor"]).lower()
    try:
        path = _save_upload(file)
        chunks = extract_text_from_image(path, provider=provider)
        nid = _resolve_notebook_id(session, user_id, notebook_id)
        ids = ingest_chunks(chunks, user_id, notebook_id=nid)
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to ingest image: {exc}")

    run_transformations_in_background(background_tasks, user_id=user_id, notebook_id=nid, chunk_ids=ids, chunk_texts=[c.text for c in chunks])
    return IngestResponse(inserted=len(ids), ids=ids)


@router.post("/audio", response_model=IngestResponse)
async def ingest_audio_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form("anon"),
    notebook_id: int | None = Form(None),
    asr_provider: str = Form("whisper"),
    session: Session = Depends(get_session),
):
    """Ingest audio by transcribing with the selected ASR provider.

    Args:
        file: Uploaded audio blob (e.g., audio/webm).
        user_id: User scope for the LightRAG store.
        asr_provider: "whisper" (default), "openai", or "gemini".
    """
    defaults = get_ingestion_defaults()
    provider = (asr_provider or defaults["audio_asr_provider"]).lower()
    try:
        path = _save_upload(file)
        chunks = transcribe_audio_to_text(path, provider=provider)
        nid = _resolve_notebook_id(session, user_id, notebook_id)
        ids = ingest_chunks(chunks, user_id, notebook_id=nid)
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to ingest audio: {exc}")

    run_transformations_in_background(background_tasks, user_id=user_id, notebook_id=nid, chunk_ids=ids, chunk_texts=[c.text for c in chunks])
    return IngestResponse(inserted=len(ids), ids=ids)


