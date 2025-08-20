# LearningTool Deployment Guide

This guide provides detailed instructions for deploying LearningTool in various environments, from local privacy-focused setups to scalable cloud SaaS deployments.

## Quick Start

| Deployment Type | Best For | Time to Deploy | Command |
|----------------|----------|----------------|---------|
| **Local Docker** | Privacy, Control | 5 minutes | `docker-compose up -d` |
| **Railway** | Cloud SaaS | 3 minutes | Click deploy button |
| **Local Dev** | Development | 2 minutes | `make dev` |

---

## 🏠 Local/Self-Hosted Deployment

### Option 1: Docker Compose (Production Ready)

**Perfect for**: Users who want complete privacy and data control.

#### Prerequisites
- Docker & Docker Compose installed
- 2GB RAM minimum
- 10GB storage space

#### Step-by-Step Setup

1. **Clone Repository**
   ```bash
   git clone https://github.com/your-username/LearningTool.git
   cd LearningTool
   ```

2. **Configure Environment**
   ```bash
   # Copy environment template
   cp backend/env.example backend/env
   
   # Edit with your API keys
   nano backend/env
   ```
   
   Required variables:
   ```env
   GEMINI_API_KEY=your_gemini_key_here
   OPENAI_API_KEY=your_openai_key_here
   OPENROUTER_API_KEY=your_openrouter_key_here
   TAVILY_API_KEY=your_tavily_key_here
   ```

3. **Build and Deploy**
   ```bash
   # Build the application
   docker build -t learningtool .
   
   # Start all services
   docker-compose up -d
   
   # Check status
   docker-compose ps
   ```

4. **Access Your Application**
   - **Web App**: http://localhost:8123/app/
   - **API Docs**: http://localhost:8123/docs
   - **Health Check**: http://localhost:8123/health

5. **Data Persistence**
   Your data is stored in Docker volumes:
   ```bash
   # Backup your data
   docker run --rm -v learningtool_lightrag-data:/data alpine tar czf - /data > backup.tar.gz
   
   # Restore data
   docker run --rm -v learningtool_lightrag-data:/data alpine tar xzf - < backup.tar.gz
   ```

### Option 2: Local Development

**Perfect for**: Developers and customization.

```bash
# Terminal 1: Backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e .
export $(grep -v '^#' env | xargs)  # Load environment
uvicorn src.agent.app:app --reload --port 2024

# Terminal 2: Frontend
cd frontend
npm install
npm run dev

# Access: http://localhost:5173/app/
```

---

## ☁️ Cloud SaaS Deployment

### Option 1: Railway (Recommended for SaaS)

**Perfect for**: Quick cloud deployment with automatic scaling.

#### One-Click Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/...)

#### Manual Setup
1. **Create Railway Project**
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   ```

2. **Add Services**
   ```bash
   # Add PostgreSQL
   railway add postgresql
   
   # Add Redis  
   railway add redis
   
   # Deploy application
   railway up
   ```

3. **Configure Environment**
   ```bash
   railway variables set GEMINI_API_KEY=your_key
   railway variables set OPENAI_API_KEY=your_key
   railway variables set POSTGRES_URL=${{Postgres.DATABASE_URL}}
   railway variables set REDIS_URL=${{Redis.REDIS_URL}}
   railway variables set LIGHTRAG_BASE_DIR=/app/data/lightrag
   ```

4. **Access Your App**
   ```bash
   railway open
   ```

### Option 2: Render

**Perfect for**: Cost-effective cloud hosting.

#### Setup Instructions
1. **Fork Repository** on GitHub
2. **Create Render Account** and connect GitHub
3. **Create Services**:

   **Web Service (Backend)**:
   ```yaml
   Name: learningtool-backend
   Environment: Docker
   Branch: main
   Build Command: docker build -t backend .
   Start Command: uvicorn src.agent.app:app --host 0.0.0.0 --port $PORT
   ```

   **Static Site (Frontend)**:
   ```yaml
   Name: learningtool-frontend
   Environment: Node
   Build Command: npm install && npm run build
   Publish Directory: dist
   ```

   **PostgreSQL Database**:
   ```yaml
   Name: learningtool-db
   Plan: Free tier
   ```

4. **Environment Variables**:
   ```env
   GEMINI_API_KEY=your_key
   OPENAI_API_KEY=your_key
   DATABASE_URL=${{learningtool-db.DATABASE_URL}}
   ```

### Option 3: Vercel + Backend Hosting

**Perfect for**: Optimized frontend with flexible backend.

#### Frontend on Vercel
```bash
cd frontend
npm install -g vercel
vercel --prod
```

#### Backend on Railway/Render
Deploy backend separately and update frontend configuration:
```env
VITE_API_BASE_URL=https://your-backend.railway.app
```

### Option 4: AWS/GCP/Azure (Enterprise)

**Perfect for**: Enterprise deployments with full control.

#### AWS Setup
```bash
# Use AWS ECS with Fargate
aws ecs create-cluster --cluster-name learningtool

# Deploy with provided Dockerfile
aws ecs create-service \
  --cluster learningtool \
  --service-name learningtool-service \
  --task-definition learningtool:1 \
  --desired-count 2
```

#### GCP Setup
```bash
# Deploy to Cloud Run
gcloud run deploy learningtool \
  --image gcr.io/your-project/learningtool \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🔧 Production Configuration

### Environment Variables Reference

```env
# === Core API Keys (Required) ===
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key
TAVILY_API_KEY=your_tavily_key

# === Database Configuration ===
# Local deployment
SQLITE_DB_PATH=/data/app.db

# Cloud deployment
POSTGRES_URI=postgresql://user:pass@host:5432/database
REDIS_URI=redis://user:pass@host:6379/0

# === Storage Configuration ===
# Local storage
LIGHTRAG_BASE_DIR=/data/lightrag

# Cloud storage (future)
LIGHTRAG_BASE_DIR=s3://your-bucket/lightrag
LIGHTRAG_BASE_DIR=gs://your-bucket/lightrag

# === Application Settings ===
PORT=8000
HOST=0.0.0.0
DEBUG=false
LOG_LEVEL=INFO

# === Multi-tenancy (SaaS) ===
ENABLE_AUTH=true
JWT_SECRET=your-very-long-random-secret
JWT_ALGORITHM=HS256
JWT_EXPIRATION=86400

# === Performance ===
MAX_UPLOAD_SIZE=50MB
RATE_LIMIT_PER_MINUTE=60
BACKGROUND_WORKERS=4
```

### Database Migration (SQLite → PostgreSQL)

For scaling from local to cloud deployment:

```bash
# Install migration dependencies
pip install psycopg2-binary

# Run migration script
python scripts/migrate_sqlite_to_postgres.py \
  --source /data/app.db \
  --target postgresql://user:pass@host:5432/db
```

### Multi-User Setup

For SaaS deployment, implement user isolation:

```python
# backend/src/middleware/auth.py
from fastapi import Request, HTTPException
import jwt

@app.middleware("http")
async def add_user_context(request: Request, call_next):
    auth_header = request.headers.get("authorization")
    if auth_header:
        try:
            token = auth_header.replace("Bearer ", "")
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            request.state.user_id = payload["user_id"]
        except jwt.InvalidTokenError:
            raise HTTPException(401, "Invalid token")
    else:
        request.state.user_id = "anonymous"
    
    return await call_next(request)
```

---

## 📊 Monitoring & Scaling

### Health Checks

```bash
# Application health
curl https://your-app.com/health

# Component health
curl https://your-app.com/health/detailed
```

### Performance Monitoring

Add to your production environment:

```python
# Application metrics
from prometheus_client import Counter, Histogram
from fastapi import Request
import time

REQUEST_COUNT = Counter('requests_total', 'Total requests')
REQUEST_DURATION = Histogram('request_duration_seconds', 'Request duration')

@app.middleware("http")
async def add_metrics(request: Request, call_next):
    start_time = time.time()
    REQUEST_COUNT.inc()
    
    response = await call_next(request)
    
    REQUEST_DURATION.observe(time.time() - start_time)
    return response
```

### Scaling Guidelines

**Local Deployment**:
- Recommended: 4GB RAM, 4 CPU cores
- Storage: 50GB+ for knowledge graphs
- Network: Local network only

**Cloud Deployment**:
- Minimum: 2GB RAM, 1 CPU core
- Recommended: 8GB RAM, 2 CPU cores  
- Auto-scaling: Scale based on CPU/memory usage
- Load balancing: Use cloud provider load balancers

---

## 🔒 Security Considerations

### Local Deployment
- Firewall configuration to block external access
- Regular backups of knowledge data
- API key rotation

### Cloud Deployment
- HTTPS termination (handled by cloud providers)
- Rate limiting and DDoS protection
- Regular security updates
- User authentication and authorization
- Data encryption at rest and in transit

### Data Privacy
- **Local**: Complete data privacy, no external data transmission
- **Cloud**: Implement data encryption, user consent, GDPR compliance

---

## 🆘 Troubleshooting

### Common Issues

**Docker Container Won't Start**:
```bash
# Check logs
docker-compose logs app

# Check environment variables
docker-compose exec app env | grep API_KEY
```

**Database Connection Issues**:
```bash
# Test PostgreSQL connection
docker-compose exec app python -c "
import psycopg2
conn = psycopg2.connect('$POSTGRES_URI')
print('Database connected successfully')
"
```

**LightRAG Storage Issues**:
```bash
# Check storage permissions
docker-compose exec app ls -la /data/lightrag/

# Test LightRAG initialization
docker-compose exec app python -c "
from src.services.lightrag_store import LightRAGStore
store = LightRAGStore('test')
print('LightRAG initialized successfully')
"
```

**API Key Issues**:
```bash
# Verify API keys are loaded
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

### Performance Issues

**Slow Response Times**:
1. Check database query performance
2. Monitor LightRAG vector database size
3. Implement Redis caching
4. Scale compute resources

**High Memory Usage**:
1. Monitor LightRAG memory usage
2. Implement data cleanup routines
3. Scale memory allocation
4. Use efficient data structures

---

## 🔄 Updates & Maintenance

### Local Deployment Updates
```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker-compose down
docker build -t learningtool .
docker-compose up -d
```

### Cloud Deployment Updates
- **Railway/Render**: Automatic deployment on git push
- **Manual**: Update container images and restart services

### Data Backup
```bash
# Backup LightRAG data
docker run --rm -v learningtool_lightrag-data:/data \
  alpine tar czf - /data > lightrag-backup-$(date +%Y%m%d).tar.gz

# Backup SQLite database
docker run --rm -v learningtool_lightrag-data:/data \
  alpine cp /data/app.db /backup/app-backup-$(date +%Y%m%d).db
```

---

## 📞 Support

- **Documentation**: [README.md](README.md)
- **Issues**: [GitHub Issues](https://github.com/your-username/LearningTool/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/LearningTool/discussions)

---

*Happy deploying! 🚀*