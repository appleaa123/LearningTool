from __future__ import annotations

import os
from typing import Dict
from dotenv import load_dotenv

# Ensure environment variables are loaded from the 'env' file
load_dotenv("env")


def get_ingestion_defaults() -> Dict[str, str]:
    """Return default ingestion providers/processors derived from environment.

    Environment variables:
      - INGEST_AUDIO_ASR: "whisper" | "openai" | "gemini" (default: "whisper")
      - INGEST_IMAGE_PROCESSOR: "gemini" (enforced - OCR removed for security)
      - INGEST_DOCUMENT_PROCESSOR: "unstructured" | "gemini" | "openai" (default: "unstructured")
    """
    result = {
        "audio_asr_provider": os.getenv("INGEST_AUDIO_ASR", "whisper").lower(),
        "image_processor": "gemini",  # Enforced - only Gemini Vision is supported
        "document_processor": os.getenv("INGEST_DOCUMENT_PROCESSOR", "unstructured").lower(),
    }
    print(f"DEBUG: get_ingestion_defaults() returning: {result}")
    return result


