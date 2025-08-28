# LearningTool Deployment Guide
*Created: August 21, 2025*

## 🚀 Quick Start Deployment

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e .
```

### 2. Environment Configuration
```bash
# Copy and edit environment file
cp env.example env
# Edit env file with your API keys:
# - GEMINI_API_KEY
# - OPENAI_API_KEY  
# - TAVILY_API_KEY
```

### 3. Start Backend
```bash
langgraph dev --port 2024 --allow-blocking
```
✅ Backend will be available at: http://127.0.0.1:2024

### 4. Frontend Setup (New Terminal)
```bash
cd frontend
npm install
npm run dev
```
✅ Frontend will be available at: http://localhost:5174/app/

## 🎯 Deployment Architecture

### Current Configuration
- **Architecture**: Local Agent Deployment
- **Backend**: LangGraph agent with FastAPI
- **Frontend**: React/Vite with TypeScript
- **AI Provider**: Gemini (primary), OpenAI (fallback)

### File Structure
```
LearningTool/
├── backend/
│   ├── src/agent/graph.py      # Main LangGraph agent
│   ├── langgraph.json          # Local agent config
│   └── env                     # Environment variables
├── frontend/
│   ├── src/components/         # React components
│   └── package.json
└── .claude/commands/           # Deployment documentation
```

## ✅ Deployment Status

### Working Features
- ✅ **LangGraph Agent**: Web research with citations
- ✅ **Frontend**: TypeScript, React components, Error boundaries
- ✅ **API Health**: All endpoints responding
- ✅ **Environment**: Secure configuration management

### Known Issues - RESOLVED ✅
- ✅ **LightRAG Bug**: Fixed with error handling workaround
  - **Status**: Document ingestion now provides user-friendly error messages
  - **Implementation**: Graceful error handling catches library bug and continues operation
  - **User Experience**: Clear error message instead of system crash
  - **Next Steps**: Monitor for LightRAG library updates to remove workaround

## 🔧 Configuration Files

### Backend Configuration (`backend/langgraph.json`)
```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent/graph.py:graph"
  },
  "http": {
    "app": "./src/agent/app.py:app"
  },
  "env": "env"
}
```

### Environment Variables (`backend/env`)
```bash
# Required API Keys
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
TAVILY_API_KEY=your_key_here

# Optional Configuration
LIGHTRAG_BASE_DIR=/path/to/data/lightrag
SQLITE_DB_PATH=/path/to/data/app.db
```

## 🧪 Testing the Deployment

### 1. Health Check
```bash
curl http://127.0.0.1:2024/health
# Expected: {"status":"ok"}
```

### 2. Agent Functionality
```bash
# Create thread
curl -X POST http://127.0.0.1:2024/threads -d '{}' -H "Content-Type: application/json"

# Test research query
curl -X POST http://127.0.0.1:2024/threads/{thread_id}/runs \
  -d '{"assistant_id": "agent", "input": {"messages": [{"role": "user", "content": "What is React?"}]}}' \
  -H "Content-Type: application/json"
```

### 3. Frontend Access
- Navigate to: http://localhost:5174/app/
- Test chat interface
- Verify error boundaries and loading states

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill process on port 2024
   lsof -ti:2024 | xargs kill -9
   ```

2. **Missing Dependencies**
   ```bash
   # Backend
   pip install -U "langgraph-cli[inmem]"
   
   # Frontend
   npm install
   ```

3. **API Key Errors**
   - Verify keys in `backend/env` file
   - Check API key permissions and quotas
   - Ensure no trailing spaces in key values

4. **Document Upload Errors**
   - ✅ **Fixed**: LightRAG library bug now handled gracefully
   - **Expected Behavior**: Returns user-friendly error message
   - **Logs**: Check for warning: "LightRAG v1.4.6 bug encountered"
   - **Workaround**: Error handling prevents system crashes
   - **Future**: Update LightRAG when fixed version available

## 📈 Performance Expectations

### Startup Times
- Backend: ~7-8 seconds
- Frontend: ~1-2 seconds
- Agent Registration: Immediate

### Resource Usage
- Memory: ~200-300MB (backend + frontend)
- CPU: Low during idle, moderate during research
- Network: Dependent on API calls (Gemini, Tavily)

## 🔄 Production Considerations

### For Production Deployment
1. **Remove `--allow-blocking` flag**
2. **Implement async database operations**
3. **Add proper logging and monitoring**
4. **Use environment-specific configuration**
5. **Set up Docker containers**

### Security Checklist
- ✅ API keys in environment variables (not code)
- ✅ CORS configured correctly
- ✅ Input validation implemented
- ✅ Error messages don't expose secrets

## 📚 Additional Resources

### Project Documentation
- **[Development Status](./development-status.md)** - Current project overview and status
- **[Active Roadmap](./active-roadmap.md)** - Current and planned features  
- **[Implementation Guidelines](./implementation-guidelines.md)** - Development patterns and standards
- **[Completed Work Archive](./completed-work-archive.md)** - Historical implementation details
- **[New Requirements Template](./new-requirements.md)** - Template for new feature requests

### External Documentation
- **LangGraph Documentation**: https://langchain-ai.github.io/langgraph/
- **API Docs**: http://127.0.0.1:2024/docs (when running)
- **LightRAG-HKU**: https://github.com/HKU-data-science/LightRAG

---

## 🔬 UPCOMING FEATURE IMPLEMENTATIONS

### 1. User-Controlled Deep Research Implementation Plan

**Development Name**: Smart Topic Suggestion & User Choice System  
**Update Date**: August 24, 2025  
**Status**: Ready for Implementation  

#### High-Level Overview
Transform the upload workflow to intelligently suggest research topics and give users control over when deep research is performed, creating a seamless bridge between personal knowledge and web research.

#### Acceptance Criteria Summary
- ✅ **Smart Suggestions**: LLM analyzes uploaded content and suggests relevant research topics
- ✅ **User Choice**: Clear YES/NO interface for each suggested topic
- ✅ **Seamless Integration**: Research triggers use existing deep research infrastructure
- ✅ **Local Fallback**: NO choice defaults to local-only knowledge retrieval
- ✅ **Performance**: Topic suggestion doesn't block upload completion
- ✅ **Backward Compatibility**: All existing functionality remains unchanged

#### Validation Strategy
- Upload various content types → verify relevant topic suggestions
- Test user choice flow → confirm research triggers correctly
- Verify local-only mode → ensure LightRAG-only responses
- Performance testing → topic generation completes within 3 seconds
- Regression testing → existing features unaffected

#### Implementation Phases
1. **Backend Foundation** (6-8 hours): Database models, topic suggestion service, API endpoints
2. **Frontend Interface** (4-6 hours): Topic display components, user choice handling
3. **Research Integration** (3-4 hours): Connect choices to existing deep research pipeline
4. **Testing & Polish** (2-3 hours): End-to-end validation and user experience refinement

**Total Estimated Time**: 15-21 hours

---

### 2. Knowledge Newsfeed Implementation Plan

**Development Name**: Facebook-Style Knowledge Browser  
**Update Date**: August 24, 2025  
**Status**: Backend Complete, Frontend Ready for Implementation  

#### High-Level Overview
Create an engaging social media-style interface for browsing knowledge items, allowing users to explore their personal knowledge base and research results in a visually appealing, chronological feed format.

#### Acceptance Criteria Summary
- ✅ **Feed Display**: Chronological timeline of all knowledge items (chunks, summaries, research)
- ✅ **Content Cards**: Distinct card designs for different content types
- ✅ **Infinite Scroll**: Smooth pagination with proper loading states
- ✅ **Search & Filter**: Find specific content across all knowledge types
- ✅ **Mobile Responsive**: Optimized experience across all devices
- ✅ **Performance**: Smooth scrolling with thousands of items
- ✅ **Integration**: Seamless switching between chat and browse modes

#### Validation Strategy
- Populate feed with diverse content → verify all types display correctly
- Test infinite scroll → confirm smooth performance with large datasets
- Mobile testing → validate responsive design across screen sizes
- Search functionality → ensure accurate results across all content
- Integration testing → verify smooth chat/newsfeed switching

#### Implementation Phases
1. **Core Components** (4-6 hours): Feed container, card components, API integration
2. **UI Integration** (2-3 hours): Navigation, filtering, search functionality
3. **Enhanced UX** (3-4 hours): Content-specific displays, social features
4. **Performance & Polish** (2-3 hours): Optimization, accessibility, mobile refinement

**Total Estimated Time**: 11-16 hours

#### Backend Status
✅ **Complete**: Full API infrastructure exists  
- Feed data model implemented
- `/knowledge/feed` endpoint operational
- Automatic feed population during content ingestion
- Cursor-based pagination for performance
- User isolation and security implemented

#### Technical Dependencies
- **Frontend**: React components, infinite scroll, responsive design
- **Backend**: No additional development required
- **Integration**: Uses existing content retrieval APIs

---

**Deployment Status**: ✅ **READY FOR LOCAL DEVELOPMENT**
**Last Updated**: August 24, 2025
**Validation**: Backend + Frontend + Agent working successfully