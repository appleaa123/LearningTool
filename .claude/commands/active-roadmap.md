# ACTIVE DEVELOPMENT ROADMAP

*Last Updated: August 30, 2025 11:18 UTC*
*For completed work, see: [completed-work-archive.md](./completed-work-archive.md)*

---

## 🎯 NEW REQUIREMENTS PRIORITY ORDER

### Critical Priority (Immediate - Next 1-2 weeks)
*No critical issues remaining - REQ-004 completed August 30, 2025*

### High Priority (Following Critical - Next 2-3 weeks)  
1. **REQ-005: Knowledge Feed Debug** - Fix broken Research/Flash Card/Summary card types in existing feed

### Medium Priority (Next 4-6 weeks)
2. **REQ-001: File Upload Experience Enhancement** - Simple upload status indicators, disable audio with message
3. **REQ-002: Research Topic Tab Enhancement** - Improved UX for topic selection and background processing

### Existing High Priority Features (Parallel Development)
4. **Knowledge Newsfeed Frontend** - Social media-style knowledge browser (backend complete)
5. **Smart Topic Suggestions** - User-controlled deep research system  
6. **Enhanced Research UX** - Seamless frontend research experience

### Medium Priority Enhancements (1-2 months)
7. **Performance Optimization** - Bundle size reduction and caching
8. **Advanced Error Monitoring** - Production telemetry and analytics
9. **User Experience Polish** - Accessibility and mobile improvements

---

## 📰 KNOWLEDGE NEWSFEED IMPLEMENTATION

### Current Status
- **Backend**: ✅ COMPLETE - Full API infrastructure exists
- **Frontend**: ❌ MISSING - UI components needed
- **Priority**: High
- **Estimated Effort**: 15-20 hours

### Backend Infrastructure (Already Complete)
- `FeedItem` model with support for all content types ✅
- `/knowledge/feed` API with cursor-based pagination ✅  
- Automatic feed population during ingestion ✅
- Content retrieval by feed item type ✅

### Frontend Implementation Needed

#### Phase 1: Core Feed Display (5-7 hours)
**Files to Create:**
- `frontend/src/components/KnowledgeFeed.tsx` - Main feed container
- `frontend/src/components/feed/FeedItemCard.tsx` - Base card component
- `frontend/src/components/feed/ChunkCard.tsx` - Document chunk display
- `frontend/src/components/feed/SummaryCard.tsx` - AI summary display
- `frontend/src/components/feed/QACard.tsx` - Q&A pair display
- `frontend/src/components/feed/ResearchCard.tsx` - Research result display
- `frontend/src/services/feedService.ts` - API integration

**Key Features:**
- Infinite scroll with cursor-based pagination
- Content-specific card designs for each feed item type
- Loading states and error handling
- Mobile-responsive design

#### Phase 2: UI Integration (3-4 hours)
**Files to Modify:**
- `frontend/src/App.tsx` - Add feed navigation tab
- `frontend/src/components/ui/` - New UI components as needed

**Features:**
- Navigation between chat and feed views
- Filter system for content types
- Search functionality within feed
- Refresh and real-time updates

#### Phase 3: Advanced Features (4-5 hours)
- Content interaction features (bookmarking)
- Export functionality
- Performance optimization for large feeds
- Enhanced filtering and sorting options

#### Phase 4: Polish & Testing (3-4 hours)
- Accessibility improvements
- Performance testing with large datasets
- E2E test coverage
- Bug fixes and UX refinements

### Acceptance Criteria
- ✅ Feed displays all knowledge items in chronological order
- ✅ Different content types render with appropriate card designs  
- ✅ Infinite scroll works smoothly with proper loading states
- ✅ Search and filtering work across all feed content
- ✅ Mobile responsive design works on all devices
- ✅ Performance remains smooth with 1000+ feed items

---

## 🎯 SMART TOPIC SUGGESTIONS SYSTEM

### Current Status
- **Backend**: 📋 DESIGNED - Comprehensive implementation plan ready
- **Frontend**: 📋 DESIGNED - Detailed UI specifications ready
- **Priority**: High (enables user-controlled research)
- **Estimated Effort**: 20-25 hours total

### Backend Implementation Needed

#### Phase 1: Database Models (2-3 hours)
**Files to Create:**
- Enhanced `backend/src/services/models.py` with SuggestedTopic model

```python
class TopicStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"  
    rejected = "rejected"
    researched = "researched"

class SuggestedTopic(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, max_length=255)
    topic: str = Field(max_length=1000)
    context: str = Field(max_length=2000)
    priority_score: float = Field(default=0.5)
    status: TopicStatus = Field(default=TopicStatus.pending)
    # ... additional fields
```

#### Phase 2: Topic Generation Service (3-4 hours)
**Files to Create:**
- `backend/src/services/topic_suggestion.py` - LLM-powered topic analysis

**Key Features:**
- Generate 1-3 relevant topics from uploaded content
- Context-aware topic suggestions with priority scoring
- Background processing to avoid blocking uploads
- Integration with existing LLM infrastructure

#### Phase 3: API Endpoints (2-3 hours)
**Files to Create:**
- `backend/src/routers/topics.py` - Topic management API

**Endpoints:**
- `GET /topics/suggestions` - Get pending topics for user
- `POST /topics/suggestions/{id}/accept` - Accept topic for research
- `POST /topics/suggestions/{id}/reject` - Reject topic
- `GET /topics/research/{id}` - Get research results

#### Phase 4: Research Integration (2-3 hours)
**Files to Create:**
- `backend/src/services/research_integration.py` - Connect topics to LangGraph agent

**Features:**
- Trigger research when topics are accepted
- Store research results linked to topics
- Create feed items for research results
- Update topic status tracking

#### Phase 5: Enhanced Ingestion (1-2 hours)
**Files to Modify:**
- `backend/src/routers/ingestion.py` - Add topic suggestion to upload flow

### Frontend Implementation Needed

#### Phase 1: Topic Display Components (4-6 hours)
**Files to Create:**
- `frontend/src/components/TopicSuggestions.tsx` - Main topic display
- `frontend/src/components/ResearchProgress.tsx` - Progress tracking
- `frontend/src/services/topicApi.ts` - Topic management API

#### Phase 2: Upload Flow Integration (3-4 hours)
**Files to Modify:**
- `frontend/src/components/DocumentUploader.tsx` - Add topic suggestions
- `frontend/src/components/MediaUploader.tsx` - Add topic integration
- `frontend/src/App.tsx` - Topic state management

#### Phase 3: Smart Suggestions (2-3 hours)
**Files to Create:**
- `frontend/src/components/SmartSuggestions.tsx` - Context-aware research hints
- Enhanced user experience with research recommendations

### Acceptance Criteria
- ✅ Topics are automatically generated from uploaded content
- ✅ Users can accept/reject topics with clear feedback
- ✅ Accepted topics trigger research using existing pipeline
- ✅ Research results appear in knowledge feed automatically
- ✅ Topic context is preserved and displayed with results
- ✅ System handles topic generation failures gracefully

---

## 🔧 HIGH PRIORITY: KNOWLEDGE FEED DEBUG (REQ-005)

### Current Status
- **Backend**: ❌ NEEDS FIXES - Research/Flash Card/Summary card generation broken
- **Frontend**: ❌ NEEDS FIXES - Card rendering issues for broken types
- **Priority**: High (Existing feature broken)
- **Estimated Effort**: 1-2 days

### Implementation Plan

#### Phase 1: Backend Card Generation Fixes (4-6 hours)
**Files to Modify:**
- `backend/src/services/lightrag_service.py` - Fix card content generation
- `backend/src/routers/knowledge.py` - Enhanced feed endpoint responses

**Key Fixes:**
- Research cards: Fix summary generation and source links
- Flash cards: Fix LLM-generated titles and reveal content
- Summary cards: Fix LLM-generated summaries from knowledge base

#### Phase 2: Frontend Card Rendering Fixes (3-4 hours)
**Files to Modify:**
- `frontend/src/components/KnowledgeFeed.tsx` - Card type handling
- `frontend/src/components/feed/ResearchCard.tsx` - Research card fixes
- `frontend/src/components/feed/FlashCard.tsx` - Flash card fixes  
- `frontend/src/components/feed/SummaryCard.tsx` - Summary card fixes

**Key Features:**
- Research cards show summary with source links in Sources section
- Flash cards show title with reveal functionality
- Summary cards display LLM-generated content
- All cards maintain consistent styling

### Acceptance Criteria
- ✅ Research cards show research summary with proper source links
- ✅ Flash cards display LLM-generated titles with reveal functionality  
- ✅ Summary cards show LLM-generated knowledge summaries
- ✅ All card types render consistently in the feed
- ✅ Card interactions work smoothly

---

## 📤 MEDIUM PRIORITY: FILE UPLOAD ENHANCEMENT (REQ-001)

### Current Status
- **Backend**: ✅ WORKING - Current upload functionality works
- **Frontend**: ❌ NEEDS ENHANCEMENT - Missing upload status feedback, audio handling
- **Priority**: Medium (UX improvement)
- **Estimated Effort**: 4-6 hours

### Implementation Plan

#### Phase 1: Upload Status Indicators (2-3 hours)
**Files to Modify:**
- `frontend/src/components/Upload.tsx` - Add status indicators
- `backend/src/routers/knowledge.py` - Enhanced upload responses

**Key Features:**
- Upload success/failure status messages
- Processing status indicators
- File ready confirmation

#### Phase 2: Audio Upload Handling (1-2 hours)
**Files to Modify:**
- `frontend/src/components/Upload.tsx` - Audio upload button with disabled state
- `backend/src/routers/knowledge.py` - Audio endpoint with unavailable response

**Key Features:**
- Audio upload button shows "Sorry, this feature is under development and will be live soon!"
- Clean user-friendly messaging

### Acceptance Criteria
- ✅ Upload status shows success/failure clearly
- ✅ Audio upload shows development message
- ✅ Users see when files are ready for use

---

## 🔬 MEDIUM PRIORITY: RESEARCH TOPIC ENHANCEMENT (REQ-002)

### Current Status  
- **Backend**: ❌ NEEDS ENHANCEMENT - Basic functionality exists, needs background processing
- **Frontend**: ❌ NEEDS ENHANCEMENT - Missing async processing, progress indicators
- **Priority**: Medium (UX improvement)
- **Estimated Effort**: 6-8 hours

### Implementation Plan

#### Phase 1: Background Processing (3-4 hours)
**Files to Modify:**
- `backend/src/services/research_service.py` - Add background task processing
- `frontend/src/components/ResearchTopics.tsx` - Async processing UI

**Key Features:**
- Background research processing
- Multiple topic selection while research runs
- Progress indicators and status messages

#### Phase 2: Enhanced UX (2-3 hours)
**Key Features:**
- Show remaining topics while processing
- "Thanks for letting me know your interests" message
- Completion status tracking

### Acceptance Criteria
- ✅ Users can select multiple topics while research processes
- ✅ Progress messages show research status
- ✅ Background processing continues if user leaves tab
- ✅ Completion notifications work properly

---

## 🚀 PERFORMANCE & OPTIMIZATION

### Bundle Size Optimization (Medium Priority)
**Current Issue**: Frontend bundle is 585KB (exceeds warning threshold)
**Target**: Reduce to <400KB
**Estimated Effort**: 4-6 hours

#### Implementation Plan:
1. **Code Splitting** (2-3 hours)
   - Implement dynamic imports for heavy components
   - Route-based code splitting
   - Lazy loading for non-critical features

2. **Dependency Optimization** (2-3 hours)
   - Analyze bundle composition
   - Replace heavy dependencies with lighter alternatives
   - Tree-shaking optimization

### Caching & Performance (Low Priority)
**Estimated Effort**: 6-8 hours

#### Implementation Areas:
- API response caching for knowledge queries
- Optimistic UI updates for better perceived performance
- Service worker for offline functionality
- Image optimization and lazy loading

---

## 🔧 ENHANCED ERROR MONITORING

### Production Telemetry (Medium Priority)
**Current Status**: Basic error boundaries implemented
**Target**: Comprehensive production monitoring
**Estimated Effort**: 4-6 hours

#### Implementation Plan:
1. **Error Tracking Integration** (2-3 hours)
   - Integrate Sentry or similar service
   - Structured error reporting
   - Performance monitoring

2. **User Analytics** (2-3 hours)
   - Usage tracking for feature optimization
   - Performance metrics collection
   - User journey analysis

---

## 📱 USER EXPERIENCE ENHANCEMENTS

### Accessibility Improvements (Medium Priority)
**Estimated Effort**: 6-8 hours

#### Implementation Areas:
- WCAG 2.1 AA compliance audit
- Keyboard navigation improvements
- Screen reader optimization
- High contrast mode support

### Mobile Experience (Low Priority)
**Current Status**: Basic responsive design implemented
**Target**: Native-app-like mobile experience
**Estimated Effort**: 8-10 hours

#### Features:
- Touch gestures for feed navigation
- Mobile-optimized upload interface
- Progressive Web App features
- Offline functionality

---

## 🧪 TESTING & VALIDATION

### Test Coverage Expansion (Medium Priority)
**Estimated Effort**: 8-10 hours

#### Areas to Expand:
- Unit test coverage for critical components
- Integration tests for API endpoints
- Performance testing with large datasets
- Accessibility testing automation

### End-to-End Test Enhancement (Low Priority)
**Current Status**: Basic E2E tests implemented
**Target**: Comprehensive user flow coverage
**Estimated Effort**: 6-8 hours

---

## 📊 SUCCESS METRICS & VALIDATION

### Feature Completion Targets
- **Knowledge Feed**: 100% functional with smooth UX
- **Topic Suggestions**: 90% user satisfaction with suggestions
- **Performance**: <3s load time on standard connections
- **Accessibility**: WCAG 2.1 AA compliance

### Technical Metrics
- **Bundle Size**: <400KB (from current 585KB)
- **Error Rate**: <1% for core user flows
- **Test Coverage**: >80% for critical components
- **API Response Time**: <200ms for standard queries

---

## 🔄 ITERATION STRATEGY

### Weekly Milestones
- **Week 1**: Knowledge Feed Phase 1-2 complete
- **Week 2**: Knowledge Feed Phase 3-4 + Topic Suggestions Phase 1
- **Week 3**: Topic Suggestions Phase 2-3 complete
- **Week 4**: Polish, testing, and performance optimization

### Review & Adjustment Points
- After each major feature completion
- Weekly progress reviews with priority adjustments
- User feedback integration points
- Performance metric evaluations

---

## 📋 NEXT ACTIONS

### Immediate Next Steps (This Week)
1. **Knowledge Feed Frontend** - Begin Phase 1 implementation
2. **Topic Suggestions Backend** - Database models and service layer
3. **Planning Refinement** - Break down tasks into smaller chunks

### Dependencies to Resolve
1. **UI Design Decisions** - Finalize feed card designs
2. **Topic Generation Strategy** - Refine LLM prompts for topic quality
3. **Performance Benchmarks** - Set specific targets for optimization

---

*This roadmap focuses on active development only. For implementation patterns and guidelines, see [implementation-guidelines.md](./implementation-guidelines.md)*