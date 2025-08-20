## LearningTool — AI Agent for Personal Knowledge Building

This project is a fullstack application that helps users build a personal knowledge base from their own inputs (voice, handwriting/photos, and documents), enrich it with deep web research when requested, and retrieve or export it in multiple formats. It combines a React/Vite frontend with a LangGraph/FastAPI backend, multi‑LLM support (Gemini, OpenAI, OpenRouter), and [LightRAG](https://github.com/HKUDS/LightRAG.git) for intelligent knowledge graph storage and retrieval.

**Status**: Core functionality fully operational with text/document ingestion, knowledge graph building, and intelligent assistant responses.

<img src="./app.png" title="App Overview" alt="App Overview" width="90%">

### Key Features
- **✅ Multimodal ingestion**: text and document parsing (PDF/DOCX/PPTX/TXT/MD) into normalized text chunks with provenance. Photo (OCR) and voice (ASR) require additional dependencies.
- **✅ Personal Knowledge Base**: stored in LightRAG as a knowledge graph with hybrid retrieval; per‑user isolation with entity and relationship extraction.
- **✅ Intelligent Assistant**: RAG-first responses using stored knowledge, with optional deep research mode for web-augmented answers.
- **✅ Multi‑LLM backbone**: provider‑agnostic model factory supports Gemini, OpenAI, and OpenRouter.
- **✅ Knowledge Graph**: automatic entity and relationship extraction with 16 entities, 13 relationships active.
- **✅ Modern UI**: chat interface with upload capabilities and real-time knowledge building.

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
# Core dependencies (required):
pip install lightrag-hku unstructured
# Optional for image/audio processing:
pip install pillow pytesseract openai-whisper
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

## Deployment Options

LearningTool is designed to support both **local privacy-focused deployment** and **cloud SaaS deployment**, giving users choice between complete data control and convenient online access.

### 🏠 Local/Self-Hosted Deployment (Privacy-First)

**Best for**: Users who want complete data control, privacy, and offline capability.

#### Option A: Docker Compose (Recommended)
```bash
# Clone the repository
git clone <your-repo-url>
cd LearningTool

# Set up environment variables
cp backend/env.example backend/env
# Edit backend/env with your API keys

# Build and deploy
docker build -t learningtool .
docker-compose up -d

# Access your private instance
open http://localhost:8123/app/
```

**Features**:
- ✅ Complete data privacy (local storage)
- ✅ Offline capability
- ✅ Full LightRAG knowledge graphs
- ✅ No subscription fees
- ✅ Redis + PostgreSQL for performance

#### Option B: Local Development
```bash
# Terminal 1: Backend
cd backend
pip install -e .
source venv/bin/activate
export $(grep -v '^#' env | xargs)
uvicorn src.agent.app:app --reload --port 2024

# Terminal 2: Frontend  
cd frontend
npm install
npm run dev

# Access: http://localhost:5173/app/
```

### ☁️ Cloud SaaS Deployment (Hosted Service)

**Best for**: Users who want convenience, accessibility, and automatic updates.

#### Option A: Railway (Easiest)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/...)

1. **One-Click Deploy**: Click the Railway button
2. **Set Environment Variables**:
   ```env
   GEMINI_API_KEY=your_key_here
   OPENAI_API_KEY=your_key_here
   OPENROUTER_API_KEY=your_key_here
   POSTGRES_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   ```
3. **Access**: Your app will be available at `https://your-app.railway.app`

#### Option B: Render
```bash
# 1. Fork this repository
# 2. Connect to Render
# 3. Create services:
#    - Web Service: Backend (auto-deploy from main branch)
#    - Static Site: Frontend (npm run build)
#    - PostgreSQL: Database
#    - Redis: Cache
```

#### Option C: Vercel + Backend Hosting
```bash
# Frontend on Vercel
cd frontend
npx vercel --prod

# Backend on Railway/Render/AWS
# Update frontend API_BASE_URL to point to backend
```

#### Option D: AWS/GCP/Azure (Enterprise)
```bash
# Use provided Dockerfile with:
# - AWS ECS/Fargate + RDS + ElastiCache
# - GCP Cloud Run + Cloud SQL + Memorystore  
# - Azure Container Instances + Azure Database
```

### 🔧 Production Configuration

#### Environment Variables
```env
# Core API Keys (Required)
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key

# Database (Cloud)
POSTGRES_URI=postgresql://user:pass@host:5432/db
REDIS_URI=redis://user:pass@host:6379

# Storage (Cloud)
LIGHTRAG_BASE_DIR=/app/data/lightrag
SQLITE_DB_PATH=/app/data/app.db

# Optional: Multi-tenancy
ENABLE_AUTH=true
JWT_SECRET=your_jwt_secret
```

#### Database Migration (SQLite → PostgreSQL)
```bash
# For cloud deployment, migrate from SQLite to PostgreSQL
python scripts/migrate_sqlite_to_postgres.py --source app.db --target $POSTGRES_URI
```

#### File Storage Options
```python
# Local deployment
LIGHTRAG_BASE_DIR=/data/lightrag

# Cloud deployment options
LIGHTRAG_BASE_DIR=s3://your-bucket/lightrag     # AWS S3
LIGHTRAG_BASE_DIR=gs://your-bucket/lightrag     # Google Cloud
LIGHTRAG_BASE_DIR=/app/persistent/lightrag      # Container volume
```

### 🔒 Multi-Tenancy & Authentication

For SaaS deployment, consider adding:
```python
# User isolation
@app.middleware("http")
async def add_user_context(request: Request, call_next):
    user_id = get_user_from_jwt(request.headers.get("authorization"))
    request.state.user_id = user_id
    return await call_next(request)

# Per-user LightRAG directories
LIGHTRAG_BASE_DIR=/data/lightrag/{user_id}
```

### 📊 Scaling Considerations

**Local Deployment**:
- Single-user optimized
- File-based storage (fast)
- Local LLM APIs reduce latency

**Cloud Deployment**:
- Multi-user with PostgreSQL
- Horizontal scaling with load balancers
- CDN for static assets
- Background job queues for heavy processing

---

## Backend overview

### Multi‑LLM provider abstraction
- File: `backend/src/services/llm_provider.py`
- Supports `provider = gemini | openai | openrouter` with model strings per node.
- The LangGraph nodes in `backend/src/agent/graph.py` call this factory.

### LightRAG knowledge storage
- File: `backend/src/services/lightrag_store.py`
- Per‑user working directory at `LIGHTRAG_BASE_DIR/<user_id>`.
- **Package**: `lightrag-hku` v1.4.6 (HKUDS official implementation)
- **Features**: Async operations, automatic entity/relationship extraction, hybrid retrieval
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
- `POST /ingest/text` — Form: `text`, `user_id` ✅ **WORKING**
- `POST /ingest/document` — File: `file`, Form: `user_id` ✅ **WORKING**
- `POST /ingest/image` — File: `file`, Form: `user_id` ⚠️ *Requires pillow + pytesseract*
- `POST /ingest/audio` — File: `file`, Form: `user_id` ⚠️ *Requires openai-whisper*

Response
```json
{ "inserted": 3, "ids": ["0", "1", "2"] }
```

### Assistant (RAG‑first with optional deep research) ✅ **WORKING**
- `POST /assistant/ask`
```json
{
  "user_id": "demo",
  "question": "What is LightRAG and what is it used for?",
  "effort": "medium",
  "provider": "gemini",
  "model": "gemini-2.5-pro",
  "deep_research": false
}
```
Response includes intelligent `answer` based on stored knowledge, optional `sources`, and `rag_preview`.

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
- Environment variables properly configured for secure key management.

---

## Roadmap

### Phase 1: Complete Core Features ✅
- [x] Core knowledge ingestion (text, documents)
- [x] LightRAG knowledge graph integration  
- [x] Intelligent assistant with RAG
- [x] Dual storage architecture (LightRAG + SQLite)
- [x] Docker deployment ready

### Phase 2: Enhanced Capabilities
1. **Multimodal Completion**: Add remaining ingestion dependencies (pillow, pytesseract, openai-whisper)
2. **Advanced Visualization**: Enhanced knowledge graph visualization and search
3. **Export Formats**: Markdown compilation with ToC, PDF exports
4. **Data Modeling**: Restore SQLModel relationships with proper annotations

### Phase 3: Production & Cloud Ready
5. **Authentication**: JWT-based multi-tenancy for SaaS deployment
6. **Cloud Storage**: S3/GCS integration for scalable file storage
7. **Database Migration**: SQLite → PostgreSQL migration tools
8. **Performance**: LightRAG optimization, caching layers, background job queues

### Phase 4: Enterprise Features
9. **Observability**: Monitoring, logging, analytics dashboard
10. **Scaling**: Load balancing, auto-scaling, CDN integration
11. **Security**: Rate limiting, input validation, audit logs
12. **Integration**: API webhooks, third-party connectors, mobile apps

### Deployment Ready Now ✅
- **Local Privacy**: Complete Docker Compose setup for self-hosting
- **Cloud SaaS**: Ready for Railway, Render, AWS deployment
- **Hybrid Options**: Mix local data processing with cloud convenience

---

## Technologies
**Frontend:**
- React (Vite), Tailwind, shadcn/ui
- TypeScript with clean compilation

**Backend:**
- FastAPI, LangGraph
- **Dual Storage Architecture:**
  - **LightRAG-HKU v1.4.6**: AI knowledge graphs with entity extraction, semantic search, hybrid retrieval ([LightRAG GitHub](https://github.com/HKUDS/LightRAG.git))
  - **SQLModel + SQLite**: Application metadata (notebooks, sources, chunks, research summaries, feed items)
- Async operations with proper error handling

**AI/ML:**
- Gemini / OpenAI / OpenRouter integration
- Unstructured for document parsing
- NLTK for text processing

**Infrastructure:**
- Docker support
- Environment-based configuration
- Per-user data isolation

## License
Apache-2.0. See [LICENSE](LICENSE).
