from __future__ import annotations

import os
import re
import subprocess
import base64
import mimetypes
from typing import List

from src.ingestion.models import KnowledgeChunk


def extract_text_from_document(file_path: str) -> List[KnowledgeChunk]:
    """Extract text from common document formats using `unstructured`.

    Supports PDF, DOCX, PPTX, TXT, MD and others detected automatically.
    """
    try:
        from unstructured.partition.auto import partition  # lazy import
    except Exception as exc:  # pragma: no cover - available after deps installed
        raise RuntimeError(
            "`unstructured` is required for document parsing."
        ) from exc

    elements = partition(filename=file_path)
    chunks: List[KnowledgeChunk] = []
    for element in elements:
        text = getattr(element, "text", None)
        if text and text.strip():
            chunks.append(
                KnowledgeChunk(
                    text=text.strip(),
                    source_type="document",
                    source_uri=file_path,
                    metadata={"category": getattr(element, "category", None)},
                )
            )
    return chunks


def redact_pii(text: str) -> str:
    """Lightweight regex-based PII redaction.

    Redacts emails, phone numbers, and US SSNs. Controlled by INGESTION_REDACT_PII.
    """
    if not os.getenv("INGESTION_REDACT_PII", "false").lower() in {"1", "true", "yes"}:
        return text
    redacted = text
    # Emails
    redacted = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[REDACTED_EMAIL]", redacted)
    # Phone numbers (very loose)
    redacted = re.sub(r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}", "[REDACTED_PHONE]", redacted)
    # SSN (US)
    redacted = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]", redacted)
    return redacted


def extract_text_from_image(file_path: str, provider: str | None = None) -> List[KnowledgeChunk]:
    """Extract text from image using either OCR or Gemini Vision (if configured).

    - provider="ocr": uses Pillow + pytesseract
    - provider="gemini": uses Gemini Vision through google-genai
    """
    selected = (provider or os.getenv("INGEST_IMAGE_PROCESSOR", "ocr")).lower()
    if selected == "gemini":
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set for Gemini vision.")
        model_id = os.getenv("GEMINI_VISION_MODEL", os.getenv("GEMINI_DEFAULT_MODEL", "gemini-1.5-flash"))
        try:
            from google.genai import Client  # lazy import
            from PIL import Image
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("google-genai and pillow are required for Gemini vision.") from exc
        img = Image.open(file_path)
        # Convert to base64-encoded PNG
        import io
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
        client = Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_id,
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": "Extract any readable text from this image. Reply with plain text only."},
                        {"inline_data": {"mime_type": "image/png", "data": encoded}},
                    ],
                }
            ],
        )
        text = (getattr(response, "text", None) or "").strip()
        text = redact_pii(text)
        return [
            KnowledgeChunk(
                text=text,
                source_type="image",
                source_uri=file_path,
                metadata={"source_type": "image", "source_uri": file_path, "provider": "gemini", "model": model_id},
            )
        ]

    # Default OCR path
    try:
        from PIL import Image  # lazy import
        import pytesseract
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("`pillow` and `pytesseract` are required for image OCR.") from exc

    img = Image.open(file_path)
    full_text = pytesseract.image_to_string(img)
    full_text = redact_pii(full_text.strip())
    # Simple paragraph chunking by blank lines
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", full_text) if p.strip()]
    chunks: List[KnowledgeChunk] = []
    for para in paragraphs:
        chunks.append(
            KnowledgeChunk(
                text=para,
                source_type="image",
                source_uri=file_path,
                metadata={"source_type": "image", "source_uri": file_path, "provider": "ocr"},
            )
        )
    if not chunks:
        # Fallback to a single chunk if paragraph split yields nothing
        chunks.append(
            KnowledgeChunk(
                text=full_text,
                source_type="image",
                source_uri=file_path,
                metadata={"source_type": "image", "source_uri": file_path, "provider": "ocr"},
            )
        )
    return chunks


def transcribe_audio_to_text(file_path: str, provider: str = "whisper") -> List[KnowledgeChunk]:
    """Transcribe audio into text. Supports whisper CLI, OpenAI, and Gemini.

    Returns a list of one or more chunks. For API-based providers we return a
    single chunk; CLI could be extended to segment-level chunks later.
    """
    normalized_provider = (provider or "whisper").lower()

    if normalized_provider in {"gemini", "google", "google-genai"}:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set for Gemini ASR.")
        model_id = os.getenv("GEMINI_ASR_MODEL", os.getenv("GEMINI_DEFAULT_MODEL", "gemini-1.5-flash"))
        mime_type, _ = mimetypes.guess_type(file_path)
        mime_type = mime_type or "audio/webm"
        with open(file_path, "rb") as f:
            audio_bytes = f.read()
        try:
            from google.genai import Client  # lazy import
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("google-genai package is required for Gemini ASR.") from exc
        client = Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_id,
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": "Transcribe the following audio to text. Reply with plain text only."},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64.b64encode(audio_bytes).decode("utf-8"),
                            }
                        },
                    ],
                }
            ],
        )
        text = (getattr(response, "text", None) or "").strip()
        text = redact_pii(text)
        return [
            KnowledgeChunk(
                text=text,
                source_type="audio",
                source_uri=file_path,
                metadata={"source_type": "audio", "source_uri": file_path, "asr_provider": "gemini", "model": model_id},
            )
        ]

    if normalized_provider in {"openai", "openai-whisper", "openai-api", "openai-whisper-api"}:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set for OpenAI transcription.")
        model = os.getenv("OPENAI_ASR_MODEL", "gpt-4o-transcribe")
        try:
            import requests  # lazy import
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("The 'requests' package is required for OpenAI ASR.") from exc
        with open(file_path, "rb") as f:
            files = {"file": (os.path.basename(file_path), f, "application/octet-stream")}
            data = {"model": model}
            headers = {"Authorization": f"Bearer {api_key}"}
            resp = requests.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=headers,
                data=data,
                files=files,
                timeout=120,
            )
        if resp.status_code >= 300:
            raise RuntimeError(f"OpenAI transcription failed: {resp.status_code} {resp.text}")
        text = (resp.json() or {}).get("text", "").strip()
        text = redact_pii(text)
        return [
            KnowledgeChunk(
                text=text,
                source_type="audio",
                source_uri=file_path,
                metadata={"source_type": "audio", "source_uri": file_path, "asr_provider": "openai", "model": model},
            )
        ]

    # Prefer faster-whisper if available; else fall back to API
    try:
        from faster_whisper import WhisperModel  # type: ignore

        model_size = os.getenv("FASTER_WHISPER_MODEL", "base")  # Use smaller default model
        device = os.getenv("FASTER_WHISPER_DEVICE", "cpu")
        compute_type = os.getenv("FASTER_WHISPER_COMPUTE", "int8")
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        segments, _info = model.transcribe(file_path, language=os.getenv("WHISPER_LANG", "en"))
        chunks: List[KnowledgeChunk] = []
        for seg in segments:
            seg_text = redact_pii(seg.text.strip())
            if not seg_text:
                continue
            chunks.append(
                KnowledgeChunk(
                    text=seg_text,
                    source_type="audio",
                    source_uri=file_path,
                    metadata={
                        "source_type": "audio",
                        "source_uri": file_path,
                        "asr_provider": "faster-whisper",
                        "start": float(getattr(seg, "start", 0.0)),
                        "end": float(getattr(seg, "end", 0.0)),
                    },
                )
            )
        if chunks:
            return chunks
        # If faster-whisper yielded no chunks, fall through to API
    except Exception as e:
        print(f"faster-whisper failed: {e}")  # Debug logging
        # Fall back to OpenAI API if available
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            return transcribe_audio_to_text(file_path, "openai")
        # Fall back to Gemini API if available  
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            return transcribe_audio_to_text(file_path, "gemini")

    # No transcription method available
    raise RuntimeError(
        f"Audio transcription failed. The backend is not working and no API keys available. "
        f"Please ensure OPENAI_API_KEY or GEMINI_API_KEY is set, or log an issue on GitHub."
    )


