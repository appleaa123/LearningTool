# REQ-004 CHAT CORE FUNCTION TEST PLAN

*Last Updated: August 30, 2025*  
*Created for: LearningTool Chat Enhancement Implementation*  
*Requirement: REQ-004 from new-requirements.md*

---

## <¯ CORE PRINCIPLE: ZERO DISRUPTION TO EXISTING ARCHITECTURE

**Critical Constraint**: Preserve LangGraph research pipeline, LightRAG knowledge storage, and deep research functionality. Only enhance chat UX and persistence.

---

## =Ë TEST CATEGORY 1: UI BUTTON TEXT FIX

### Test 1.1: Button Text Verification
**Target File**: `frontend/src/components/InputForm.tsx:89`
**Change**: "Search" ’ "Send"

**Pass Criteria**:
-  Button text displays "Send" in all states (enabled/disabled)
-  No other UI elements change
-  Form submission behavior remains identical
-  Keyboard shortcuts (Ctrl+Enter/Cmd+Enter) still work
-  Button styling and positioning unchanged

**Technical Verification**:
```bash
# Verify button text change
grep -n "Search" frontend/src/components/InputForm.tsx
# Should return 0 matches after fix

grep -n "Send" frontend/src/components/InputForm.tsx  
# Should show the button text on line ~89

# Verify no other changes to InputForm
git diff HEAD~1 frontend/src/components/InputForm.tsx
# Should show only the button text change
```

**Manual Test Steps**:
1. Open chat interface
2. Verify button shows "Send" text
3. Type message and verify button enables/disables correctly
4. Test Ctrl+Enter keyboard shortcut
5. Verify button click submits form

---

## =Ë TEST CATEGORY 2: CHAT SESSION MANAGEMENT (PRESERVE LANGGRAPH)

### Test 2.1: Session Creation Without Breaking LangGraph
**Objective**: Add chat sessions while keeping LangGraph research intact

**Pass Criteria**:
-  New chat sessions auto-create per notebook
-  **LangGraph streaming still works exactly the same**
-  **Research timeline still displays during processing**
-  **ActivityTimeline component shows research progress**
-  Session data saves to local SQLite (not external DB)

**Technical Verification**:
```sql
-- Verify session creation in local SQLite
SELECT * FROM chat_sessions WHERE notebook_id = 1;
-- Should show session with user_id, notebook_id, timestamps

-- Verify LangGraph pipeline unchanged
-- Should still see research events in browser console:
-- "Generating Search Queries", "Web Research", "Reflection", etc.
```

**Integration Test**:
```bash
# Verify LangGraph agent files unchanged
git diff HEAD~1 backend/src/agent/
# Should show no changes

git diff HEAD~1 backend/src/services/deep_research.py
# Should show no changes

git diff HEAD~1 backend/src/services/lightrag_store.py  
# Should show no changes
```

### Test 2.2: Message Persistence Around LangGraph Calls
**Objective**: Wrap LangGraph processing with message storage

**Pass Criteria**:
-  User messages save BEFORE LangGraph processing
-  AI responses save AFTER LangGraph processing
-  **LangGraph agent workflow completely unchanged**
-  **Deep research functionality preserved**
-  **Research sources still included in responses**

**API Flow Test**:
```
Enhanced /assistant/ask workflow:
1. Receive user question
2. Save user message to chat_messages table (NEW)
3. Pass to existing LangGraph pipeline (UNCHANGED)
4. LangGraph processes with research agents (UNCHANGED)
5. LangGraph returns answer + sources (UNCHANGED)
6. Save AI response to chat_messages table (NEW)  
7. Return response in existing format (UNCHANGED)
```

**Backend Test Verification**:
```python
# Test the enhanced assistant endpoint
response = client.post("/assistant/ask", json={
    "question": "Test question",
    "user_id": "test_user",
    "notebook_id": 1,
    "deep_research": True
})

# Verify response format unchanged
assert "answer" in response.json()
assert "sources" in response.json()

# Verify messages saved
messages = session.exec(select(ChatMessage)).all()
assert len(messages) == 2  # User + Assistant
assert messages[0].type == "user"
assert messages[1].type == "assistant"
```

---

## =Ë TEST CATEGORY 3: CHAT HISTORY DISPLAY (PRESERVE RESEARCH UI)

### Test 3.1: History Loading Without Breaking Research Features
**Objective**: Add chat history while preserving all research UI elements

**Pass Criteria**:
-  Chat history loads on notebook selection
-  **Research timeline/ActivityTimeline still shows during processing**
-  **Copy buttons and markdown rendering preserved**
-  **Source links in responses still work**
-  **Loading spinner shows "Processing..." during LangGraph execution**

**Component Verification**:
```typescript
// ChatMessagesView.tsx should still render all existing features:
// - ActivityTimeline component 
// - Research source badges   
// - Copy functionality 
// - Markdown formatting 
// - Loading states during research 
// + Chat history from database 
```

**Frontend Test**:
```javascript
// Test chat history loading
await chatService.getOrCreateSession("test_notebook");
const history = await chatService.getSessionHistory(sessionId);

// Verify history structure matches existing message format
history.messages.forEach(msg => {
    expect(msg).toHaveProperty('type'); // 'user' | 'assistant'
    expect(msg).toHaveProperty('content');
    expect(msg).toHaveProperty('id');
    // Research messages should still have sources
    if (msg.type === 'assistant' && msg.sources) {
        expect(Array.isArray(msg.sources)).toBe(true);
    }
});
```

### Test 3.2: Session Persistence Across App Restarts
**Pass Criteria**:
-  Close app, reopen, select same notebook
-  Previous chat messages display correctly
-  **Can immediately start new research queries**
-  **LangGraph streaming works on new queries**
-  **Research effort levels (low/medium/high) still functional**

**Persistence Test**:
```bash
# Start app, create chat session, send message with research
npm run dev
# ... interact with chat, enable deep research
# Close app (Ctrl+C)

# Restart app
npm run dev
# Select same notebook
# Verify: Previous messages visible, new research queries work
```

---

## =Ë TEST CATEGORY 4: EXISTING FEATURE INTEGRATION (ZERO REGRESSION)

### Test 4.1: Deep Research Function Completely Unchanged
**Critical Requirement**: All research functionality must work identically

**Pass Criteria**:
-  Deep research toggle still works
-  Research effort levels (low/medium/high) preserved
-  **LangGraph agent execution identical**
-  **Tavily web search integration unchanged**
-  Research summaries save to ResearchSummary table (unchanged)
-  Feed items still generate for research results
-  **Activity timeline shows real-time research progress**

**Backend Integration Test**:
```python
# Test /assistant/ask with deep_research=True
response = client.post("/assistant/ask", json={
    "question": "Latest AI developments",
    "user_id": "test_user", 
    "deep_research": True,
    "effort": "medium",
    "notebook_id": 1
})

# Verify research pipeline execution
assert response.status_code == 200
data = response.json()

# Verify existing response structure preserved
assert "answer" in data
assert "sources" in data
assert "rag_preview" in data

# Verify research summary still saves
research_summaries = session.exec(select(ResearchSummary)).all()
assert len(research_summaries) > 0

# Verify feed item created for research
feed_items = session.exec(select(FeedItem).where(FeedItem.kind == FeedKind.research)).all()
assert len(feed_items) > 0
```

### Test 4.2: Knowledge Feed Integration Preserved
**Pass Criteria**:
-  Research results still appear in Knowledge Feed
-  Feed card types (research/summary/QA/chunk/flashcard) unchanged
-  **No disruption to existing feed API endpoints**
-  **Feed service functionality identical**

**Feed Integration Test**:
```typescript
// Verify feed still works after chat enhancement
const feedResponse = await feedService.getFeed({
    userId: "test_user",
    notebookId: 1,
    limit: 20
});

// Should still return research cards from LangGraph research
expect(feedResponse.items).toContainEqual(
    expect.objectContaining({ kind: 'research' })
);
```

### Test 4.3: Topic Suggestions Completely Unchanged
**Pass Criteria**:
-  Topic suggestion system works identically
-  Topic acceptance triggers same LangGraph research pipeline
-  **Research Topics tab functionality preserved**
-  **Background research processing unchanged**

---

## =Ë TEST CATEGORY 5: LOCAL-FIRST ARCHITECTURE COMPLIANCE

### Test 5.1: Local Data Storage Only
**Pass Criteria**:
-  Chat sessions/messages save to local SQLite database
-  No external API calls for chat history
-  **LangGraph research still uses configured APIs (Gemini/OpenAI/Tavily)**
-  **LightRAG knowledge graph remains local**

**Local Storage Verification**:
```bash
# Verify chat data in local SQLite
sqlite3 /path/to/local/app.db
.tables
# Should show: chat_sessions, chat_messages + existing tables

SELECT COUNT(*) FROM chat_sessions;
SELECT COUNT(*) FROM chat_messages;
# Should show saved chat data

# Verify LightRAG still local
ls -la /path/to/lightrag/user_data/
# Should show existing LightRAG directories unchanged
```

### Test 5.2: Network Isolation for Chat vs Research
**Pass Criteria**:
-  Chat history: No network requests
-  **Research queries: Network requests to Tavily/LLM APIs (unchanged)**
-  **Knowledge queries: Local LightRAG only (unchanged)**

---

## =Ë TEST CATEGORY 6: COMPONENT INTEGRATION (PRESERVE ALL UI)

### Test 6.1: Existing UI Components Unchanged
**Pass Criteria**:
-  **WelcomeScreen still displays on empty chat**
-  **KnowledgeFeed tab works identically**
-  **Research Topics tab preserved**
-  **Add Knowledge drawer unchanged**
-  **Notebook selector functionality identical**

### Test 6.2: Navigation and State Management
**Pass Criteria**:
-  Tab switching (Chat/Feed/Topics) works identically
-  **Research badge indicators unchanged**
-  **Deep Research Available indicator preserved**
-  Navigation state preserved during research

---

## =€ ACCEPTANCE TEST SCENARIOS

### Scenario 1: Basic Chat Enhancement
```
1. Select notebook ’ History loads (if exists)
2. Type "What is machine learning?" 
3. Click "Send" button (not "Search")
4. Verify "Generating response" shows
5. Verify LightRAG response appears
6. Verify message saves to history
7. Close/reopen app ’ History persists
```

### Scenario 2: Research Integration Preserved
```
1. Type "Latest AI trends in 2025"
2. Enable deep research toggle
3. Click "Send" 
4. Verify LangGraph research timeline shows:
   - "Generating Search Queries"
   - "Web Research" 
   - "Reflection"
   - "Finalizing Answer"
5. Verify research sources in response
6. Verify ResearchSummary created
7. Verify Feed item created
8. Check Knowledge Feed ’ Research card appears
```

### Scenario 3: Multi-Session Isolation
```
1. Notebook A: Send "Question A" ’ Get Response A
2. Switch to Notebook B: Send "Question B" ’ Get Response B  
3. Switch back to Notebook A ’ Verify only "Question A" history visible
4. Switch back to Notebook B ’ Verify only "Question B" history visible
```

---

##   FAILURE CONDITIONS

**Immediate Failure** (Implementation rejected):
- Any LangGraph agent functionality breaks
- Deep research pipeline stops working
- Research timeline/activity doesn't show
- Knowledge Feed stops receiving research results
- Topic suggestions system breaks
- LightRAG queries fail

**Critical Warnings**:
- Response time increases significantly
- Memory usage increases substantially  
- Any existing API endpoint changes behavior
- Frontend research UI elements disappear

---

## >ê AUTOMATED TEST COMMANDS

### Backend Tests
```bash
cd backend

# Test existing functionality preserved
pytest tests/test_assistant.py -v
pytest tests/test_research.py -v  
pytest tests/test_lightrag.py -v

# Test new chat functionality
pytest tests/test_chat_sessions.py -v

# Integration test - research pipeline + chat
pytest tests/test_chat_research_integration.py -v
```

### Frontend Tests  
```bash
cd frontend

# Test UI changes
npm test -- --testNamePattern="InputForm.*Send button"

# Test chat integration
npm test -- --testNamePattern="Chat.*history"

# E2E tests for research functionality preservation
npm run test:e2e -- tests/research-flow.spec.ts
```

### System Integration Test
```bash
# Full workflow test
make test-full-workflow

# Performance regression test
make test-performance-baseline
```

---

## =Ê SUCCESS METRICS

### Quantitative Metrics
- **Response Time**: Chat responses d current "Search" performance
- **Memory Usage**: d 5% increase from baseline
- **Database Size**: Chat tables < 10MB after 1000 messages
- **Error Rate**: 0% increase in existing functionality

### Qualitative Metrics
- **User Experience**: Button text clarity improved
- **Chat Continuity**: Seamless conversation flow
- **Research Integration**: No disruption to research workflow
- **Local-First**: All chat data remains local

---

## =' IMPLEMENTATION VERIFICATION CHECKLIST

### Pre-Implementation Baseline
- [ ] Record current performance metrics
- [ ] Document existing API response formats
- [ ] Capture LangGraph event flow
- [ ] Test research functionality end-to-end

### During Implementation
- [ ] Each commit preserves all existing tests
- [ ] No changes to LangGraph agent files
- [ ] No changes to LightRAG integration
- [ ] No changes to deep research pipeline

### Post-Implementation Validation
- [ ] All existing tests pass
- [ ] New chat tests pass
- [ ] Performance within acceptable range
- [ ] Manual research workflow verification
- [ ] Chat history persistence verification

---

## <¯ CRITICAL SUCCESS FACTORS

1. **Architecture Preservation**: LangGraph + LightRAG + Deep Research unchanged
2. **Local-First Compliance**: Chat data stored locally in SQLite
3. **Zero Feature Regression**: All existing functionality works identically
4. **Enhanced UX**: Chat history + "Send" button improve user experience
5. **Session Management**: Proper notebook-chat isolation

---

## =Ý TEST EXECUTION LOG

### Phase 1: Backend Infrastructure
- [ ] Chat models added to `backend/src/services/models.py`
- [ ] Chat service created at `backend/src/services/chat_service.py`
- [ ] Assistant endpoint enhanced in `backend/src/routers/assistant.py`
- [ ] Database migrations applied
- [ ] Backend tests passing

### Phase 2: Frontend Integration  
- [ ] Chat service created at `frontend/src/services/chatService.ts`
- [ ] InputForm updated with "Send" button
- [ ] App.tsx enhanced with session management
- [ ] ChatMessagesView updated for history loading
- [ ] Frontend tests passing

### Phase 3: Integration Testing
- [ ] End-to-end chat flow working
- [ ] Research functionality preserved
- [ ] Performance benchmarks met
- [ ] All acceptance criteria verified

---

*This test plan ensures REQ-004 implementation enhances chat functionality while preserving the entire existing LangGraph research architecture and local-first data approach.*