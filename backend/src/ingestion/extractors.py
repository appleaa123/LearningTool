from __future__ import annotations

import os
import subprocess
import base64
import mimetypes
from typing import List

from ingestion.models import KnowledgeChunk


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


def extract_text_from_image(file_path: str, provider: str | None = None) -> List[KnowledgeChunk]:
    """Extract text from image using either OCR or Gemini Vision (if configured).

    Args:
        file_path: Image path to process.
        provider: Optional override processor: "ocr" or "gemini".
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
        # Convert to base64-encoded WebP or PNG
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
                        {"text": "Extract any readable text from this image."},
                        {"inline_data": {"mime_type": "image/png", "data": encoded}},
                    ],
                }
            ],
        )
        text = getattr(response, "text", None) or ""
        return [
            KnowledgeChunk(
                text=text.strip(),
                source_type="image",
                source_uri=file_path,
                metadata={"vision_provider": "gemini", "model": model_id},
            )
        ]

    # Default OCR path
    try:
        from PIL import Image  # lazy import
        import pytesseract
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "`pillow` and `pytesseract` are required for image OCR."
        ) from exc

    img = Image.open(file_path)
    text = pytesseract.image_to_string(img)
    return [
        KnowledgeChunk(
            text=text.strip(),
            source_type="image",
            source_uri=file_path,
            metadata={"vision_provider": "ocr"},
        )
    ]


def transcribe_audio_to_text(file_path: str, provider: str = "whisper") -> List[KnowledgeChunk]:
    """Transcribe audio into text and return a single `KnowledgeChunk`.

    This currently supports the Whisper CLI path for determinism. The `provider`
    parameter is accepted for forward compatibility (e.g., "whisper", "gemini"),
    but non-whisper providers are not yet implemented here.

    Args:
        file_path: Path to the uploaded audio file to transcribe.
        provider: Requested ASR provider. Supported: "whisper" (default). Others raise.

    Returns:
        A list with one `KnowledgeChunk` containing the transcribed text.
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
        # Ask Gemini to transcribe the audio
        response = client.models.generate_content(
            model=model_id,
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": "Transcribe the following audio to text."},
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
        text = getattr(response, "text", None)
        if not text:
            raise RuntimeError("Gemini ASR did not return text content.")
        return [
            KnowledgeChunk(
                text=text.strip(),
                source_type="audio",
                source_uri=file_path,
                metadata={"asr_provider": "gemini", "model": model_id},
            )
        ]

    if normalized_provider in {"openai", "openai-whisper", "openai-api", "openai-whisper-api"}:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set for OpenAI transcription.")
        # Prefer GPT-4o Transcribe if available; fallback to whisper-1
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
        return [
            KnowledgeChunk(
                text=text,
                source_type="audio",
                source_uri=file_path,
                metadata={"asr_provider": "openai", "model": model},
            )
        ]

    # Default to Whisper CLI transcription
    output_dir = os.getenv("WHISPER_TMP", "/tmp")
    base = os.path.splitext(os.path.basename(file_path))[0]
    txt_path = os.path.join(output_dir, f"{base}.txt")

    try:
        subprocess.run(
            [
                "whisper",
                file_path,
                "--language",
                "en",
                "--model",
                "large-v3",
                "--output_format",
                "txt",
                "--output_dir",
                output_dir,
            ],
            check=True,
            capture_output=True,
        )
    except FileNotFoundError as exc:  # pragma: no cover
        raise RuntimeError(
            "`whisper` CLI not found. Install openai-whisper or switch to API-based ASR."
        ) from exc

    if not os.path.exists(txt_path):
        raise RuntimeError("Whisper did not produce a transcript file.")

    with open(txt_path, "r", encoding="utf-8") as f:
        text = f.read().strip()

    return [
        KnowledgeChunk(
            text=text,
            source_type="audio",
            source_uri=file_path,
            metadata={"asr_provider": normalized_provider},
        )
    ]


