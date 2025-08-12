from __future__ import annotations

import os
from typing import Dict


def get_ingestion_defaults() -> Dict[str, str]:
    """Return default ingestion providers/processors derived from environment.

    Environment variables:
      - INGEST_AUDIO_ASR: "whisper" | "openai" | "gemini" (default: "whisper")
      - INGEST_IMAGE_PROCESSOR: "ocr" | "gemini" (default: "ocr")
    """
    return {
        "audio_asr_provider": os.getenv("INGEST_AUDIO_ASR", "whisper").lower(),
        "image_processor": os.getenv("INGEST_IMAGE_PROCESSOR", "ocr").lower(),
    }


