## LearningTool — AI Agent for Personal Knowledge Building

This project is a fullstack application that helps users build a personal knowledge base from their own inputs (voice, handwriting/photos, and documents), enrich it with deep web research when requested, and retrieve or export it in multiple formats. It combines a React/Vite frontend with a LangGraph/FastAPI backend, multi‑LLM support (Gemini, OpenAI, OpenRouter), and [LightRAG](https://github.com/HKUDS/LightRAG.git) for fast knowledge storage and retrieval.

<img src="./app.png" title="App Overview" alt="App Overview" width="90%">

### Key Features
- **Multimodal ingestion**: photo (OCR), voice (ASR), and document parsing (PDF/DOCX/PPTX/TXT/MD) into normalized text chunks with provenance.
- **Personal Knowledge Base**: stored in LightRAG as a knowledge graph with hybrid retrieval; per‑user isolation.
- **Deep Research tool**: a Gemini-driven LangGraph workflow that does iterative web research with citations; callable on demand.
- **Multi‑LLM backbone**: provider‑agnostic model factory supports Gemini, OpenAI, and OpenRouter.
- **Flexible outputs**: export Markdown, view Knowledge Graph, or browse a Newsfeed of chunks.
- **Modern UI**: chat with research timeline, plus upload and export flows.

---

## Environment configuration

Create `backend/env` (preferred for local dev) with your keys:

```dotenv
# Whether to accept per-request keys via LangGraph configurable input
GET_API_KEYS_FROM_CONFIG=true

# Google / Gemini
GEMINI_API_KEY=...

# OpenAI (direct) OR OpenRouter (OpenAI-compatible)
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Optional providers
ANTHROPIC_API_KEY=
GROQ_API_KEY=
DEEPSEEK_API_KEY=

# Web search (optional if using Google GENAI search tools)
TAVILY_API_KEY=tvly-...

# Tracing (optional)
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=

# LightRAG storage
LIGHTRAG_BASE_DIR=/data/lightrag
```

You can also pass per-request keys from the frontend via LangGraph configurable input when `GET_API_KEYS_FROM_CONFIG=true`.

---

## Project structure
- `frontend/`: React + Vite UI (chat, timeline, uploads, graph, export)
- `backend/`: FastAPI + LangGraph agent, ingestion pipeline, and APIs
  - `src/agent/`: research LangGraph and prompts
  - `src/services/`: provider factory, deep research tool, LightRAG adapter
  - `src/ingestion/`: extractors (OCR/ASR/docs), models, pipeline, router
  - `src/routers/`: assistant and knowledge endpoints

---

## Getting started

### 1) Install dependencies

Backend:
```bash
cd backend
pip install .
# If not auto-installed, also:
pip install lightrag unstructured pillow pytesseract langchain-openai
```

Frontend:
```bash
cd frontend
npm install
```

### 2) Run in development

```bash
make dev
```
Frontend: `http://localhost:5173` (or `/app` when served by backend). Backend API: `http://127.0.0.1:2024`.

### 3) Run with Docker Compose (prod-like)

```bash
docker build -t gemini-fullstack-langgraph -f Dockerfile .
GEMINI_API_KEY=... OPENAI_API_KEY=... OPENROUTER_API_KEY=... docker-compose up
```
App: `http://localhost:8123/app/`. API: `http://localhost:8123`.

---

## Backend overview

### Multi‑LLM provider abstraction
- File: `backend/src/services/llm_provider.py`
- Supports `provider = gemini | openai | openrouter` with model strings per node.
- The LangGraph nodes in `backend/src/agent/graph.py` call this factory.

### LightRAG knowledge storage
- File: `backend/src/services/lightrag_store.py`
- Per‑user working directory at `LIGHTRAG_BASE_DIR/<user_id>`.
- API provides insert/query/export_graph. See LightRAG project: [LightRAG GitHub](https://github.com/HKUDS/LightRAG.git)

### Deep research tool
- File: `backend/src/services/deep_research.py`
- Wraps the research LangGraph for programmatic invocation with effort controls.

### Ingestion pipeline
- Files: `backend/src/ingestion/*`
  - `extractors.py`: `unstructured` for docs, `pytesseract` OCR for images, Whisper‑CLI placeholder for audio (switchable to OpenAI/Gemini ASR).
  - `models.py`: normalized `KnowledgeChunk` format.
  - `router.py`: FastAPI routes below.

---

## API reference (stable)

### Ingestion
- `POST /ingest/text` — Form: `text`, `user_id`
- `POST /ingest/document` — File: `file`, Form: `user_id`
- `POST /ingest/image` — File: `file`, Form: `user_id`
- `POST /ingest/audio` — File: `file`, Form: `user_id`

Response
```json
{ "inserted": 3, "ids": ["0", "1", "2"] }
```

### Assistant (RAG‑first with optional deep research)
- `POST /assistant/ask`
```json
{
  "user_id": "demo",
  "question": "Summarize my notes on transformers and extend with 2025 trends",
  "effort": "medium",
  "provider": "gemini",
  "model": "gemini-2.5-pro",
  "deep_research": true
}
```
Response includes `answer`, optional `sources`, and `rag_preview`.

### Knowledge
- `GET /knowledge/graph?user_id=demo` → graph JSON
- `GET /knowledge/export/markdown?user_id=demo` → compiled Markdown
- `GET /knowledge/feed?user_id=demo&cursor=0&limit=50` → paginated items (feed initially returns an empty list until persistence is enabled)

---

## Frontend
- Chat UI with effort and model selectors.
- Research timeline visualizing graph node progress.
- Upload components (photo/voice/doc) post to `/ingest/*` (UI in progress).
- Views for Graph and Newsfeed (coming next).

---

## Security & privacy
- File validation (MIME/size), temporary storage, per‑user isolation (`user_id`).
- Optional redaction for PII during ingestion.
- Rate limits/quotas recommended for uploads and deep research.

---

## Roadmap
1. Complete frontend upload components and wire to ingestion routes.
2. Implement knowledge feed persistence (Postgres table) and UI infinite scroll.
3. Graph visualization page (Cytoscape) and search.
4. Markdown export compilation with sections and ToC.
5. Confidence scoring for RAG‑first → deep‑research escalation; persist research summaries back to LightRAG.
6. Switch ASR from Whisper CLI to OpenAI/Gemini APIs behind a feature flag.
7. Auth/tenancy, quotas, and observability.

---

## Technologies
- React (Vite), Tailwind, shadcn/ui
- FastAPI, LangGraph
- Gemini / OpenAI / OpenRouter
- LightRAG for storage and retrieval ([LightRAG GitHub](https://github.com/HKUDS/LightRAG.git))

## License
Apache-2.0. See [LICENSE](LICENSE).
