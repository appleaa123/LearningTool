# ASGI Compliance Migration Guide

## Overview
The LearningTool backend is being migrated from blocking synchronous database operations to async patterns for full ASGI compliance. This resolves the "Blocking call to sqlite3.Cursor.execute" errors in Deep Research functionality.

## Problem Statement
LangGraph development server identified blocking SQLite operations causing ASGI event loop blocking:
```
Topic Generation Error: Failed to fetch topic suggestions: {"detail":"Failed to retrieve topic suggestions: Blocking call to sqlite3.Cursor.execute..."}
```

## Migration Status

### ✅ Phase A: Immediate Fixes (COMPLETED)
1. **Topic Suggestion Service** - Fully converted to async patterns
   - All `session.exec()` calls wrapped with `asyncio.to_thread()`
   - All `session.add()` and `session.commit()` operations made async
   - Added helper methods for sync operations in threads

2. **Background Transformations** - Made non-blocking
   - Converted `_task()` to async pattern with `asyncio.to_thread()`  
   - Separated database operations into sync helper functions
   - Maintained LightRAG async compatibility

3. **Development Workaround** - Immediate functionality restore
   - Created `start_dev_with_blocking.sh` with `--allow-blocking` flag
   - Added production environment variable `BG_JOB_ISOLATED_LOOPS=true`
   - Documented migration status in startup script

### 🔄 Phase B: Systematic ASGI Compliance (PENDING)
Services requiring async conversion:
- `src/routers/knowledge.py`: All database queries need async wrapping
- `src/routers/notebooks.py`: CRUD operations need async patterns  
- `src/routers/topics.py`: Topic management queries need async wrapping
- `src/services/chat_service.py`: Chat operations need async conversion

### 🧪 Phase C: Testing & Validation (PENDING)
- Test Deep Research without `--allow-blocking` flag
- Validate all upload and topic generation flows  
- Performance testing for async operations
- Error handling validation

## Usage Instructions

### Development (Current)
```bash
cd backend
./start_dev_with_blocking.sh
```

### Production Deployment
Set environment variable instead of command flag:
```bash
export BG_JOB_ISOLATED_LOOPS=true
langgraph dev
```

### Testing Deep Research
1. Start backend with workaround script
2. Upload content or add text
3. Check for topic suggestions
4. Test deep research functionality

## Technical Implementation

### AsyncIO Thread Pattern
```python
# Before (blocking)
topics = session.exec(select(SuggestedTopic).where(...)).all()

# After (non-blocking)  
topics = await asyncio.to_thread(
    lambda: session.exec(select(SuggestedTopic).where(...)).all()
)
```

### Background Task Pattern
```python
# Before (blocking background task)
def _task():
    with session_scope() as session:
        session.add(item)
        session.commit()

# After (async background task)
async def _async_task():
    await asyncio.to_thread(_store_sync, items)

def _task():
    asyncio.run(_async_task())
```

## File Changes Made

### Modified Files
- `src/services/topic_suggestion.py`: Full async conversion
- `src/ingestion/transformations.py`: Background task async patterns
- `env`: Added production deployment config
- `start_dev_with_blocking.sh`: Development workaround script

### Helper Functions Added
- `TopicSuggestionService._store_topics_sync()`
- `TopicSuggestionService._create_preferences_sync()`  
- `TopicSuggestionService._commit_and_refresh()`
- `transformations._store_artifacts_sync()`

## Next Steps
1. Complete Phase B: Convert remaining service layers
2. Remove `--allow-blocking` development dependency
3. Comprehensive testing and validation
4. Performance benchmarking of async operations

## Benefits After Migration
- ✅ Deep Research functionality restored
- ✅ Improved scalability and performance  
- ✅ ASGI compliance for production deployment
- ✅ No event loop blocking under load
- ✅ Better error handling and monitoring