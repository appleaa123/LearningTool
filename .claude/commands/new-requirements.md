# NEW REQUIREMENTS TEMPLATE

*Use this template for each new feature or enhancement requirement*

---

## File and Photo Upload Experience Enhancement

**Requirement ID**: [REQ-001]  
**Title**: File and Photo Upload Experience Enhancement 
**Priority**: Medium  
**Estimated Effort**: 4-6 hours

**Created**: August 29, 2025  
**Last Updated**: August 29, 2025 15:30 UTC 

---

## FUNCTIONAL REQUIREMENTS

### User Story
**As a user who uses the Learning Tool to store personal knowledge base locally, with the photo and file uploaded. I want to have a simply experience to upload my knowledge assets. I want the UI experience be simple with only the upload status showing and if the knowledge assets are uploaded successfully or failed. So that I simply know what's going on. I do not want to see the suggested deep research topic be showing on the file upload tab. I will check the deep research suggestions in research tab myself.

### Detailed Description
The file upload tab UI should be simple and easy to use. There are three file formats supported: picture, audio (later development), and files. When user click on upload, the user should see their folder window pop up and be able to choose the files they want to upload. After choosing the file, the user will hit upload to upload the file for the application to process. At this point, that's all the current experience, which currently runs smooth without problem. The new ask is, after users upload their files, simply indicate the upload status to show if files are successfully uploaded and processed by the application and ready for review. Do not show suggested deep research topic on this tab, where when users are simply uploading their files. The suggested deep research topics should be reviewed in the Deep Research tab, which is the current experience. 

### User Experience Flow
1. User clicks on upload button
2.1 If user wants to upload a picture, he will click on upload picture
2.2 If user wants to upload an audio file, he will click on upload audio
2.3 If user wants to upload a file, he will click on upload file
3. A finder window will show up for users to choose files in appropriate files types depends on their desire
3.1 For Audio file, when user clicks on the upload audio button, show a statement "Sorry, this feature is under development and will be live soon!" Message to show users this feature is not available yet.
4. After the user clicks on the file, hits upload
5. The application will process the file and upload it to knowledge base ready for other experience flows
6. Frontend upload tab UI shows a message indicate the files are uploaded and successfully being processed and ready for use

### Acceptance Criteria
- ✅ When user try to upload audio file, the UI shows a message say the feature is currently under development will be live soon
- ✅ When the application successfully uploaded the file, processed them and ready for use. UI shows the message to let the user know

---

## TECHNICAL REQUIREMENTS

### Architecture Impact
- **Frontend Changes**: Upload tab UI components, status indicators, file type validation, audio upload disabling
- **Backend Changes**: Upload status tracking endpoints, response formatting for frontend feedback
- **Database Changes**: Optional upload status tracking table (if persistent status needed)
- **Integration Points**: Existing file processing pipeline (/ingest/document, /ingest/image), current upload endpoints

### API Specifications (if applicable)
```typescript
// Enhanced response format for upload endpoints
POST /ingest/document
Response: {
  status: "success" | "processing" | "error",
  message: string,
  upload_id?: string,
  processing_status?: "queued" | "processing" | "completed" | "failed"
}

// New endpoint for upload status checking (optional)
GET /ingest/status/{upload_id}
Response: {
  upload_id: string,
  status: "processing" | "completed" | "failed",
  message: string,
  processed_at?: string
}

// Audio upload endpoint (disabled)
POST /ingest/audio
Response: {
  status: "unavailable",
  message: "Sorry, this feature is under development and will be live soon!"
}

Error Handling: 400 for invalid file types, 413 for oversized files, 500 for processing errors
```

### Data Models (if applicable)
```typescript
// Upload status tracking (optional persistent storage)
interface UploadStatus {
  id: string;
  user_id: string;
  filename: string;
  file_type: 'image' | 'document' | 'audio';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message: string;
  created_at: Date;
  processed_at?: Date;
}

// Enhanced upload response
interface UploadResponse {
  status: "success" | "processing" | "error";
  message: string;
  upload_id?: string;
  processing_status?: "queued" | "processing" | "completed" | "failed";
}
```

### Performance Requirements
- **Response Time**: Upload acknowledgment < 2 seconds, status updates < 1 second
- **Throughput**: Support concurrent uploads per user (max 5 simultaneous)
- **Scalability**: Handle file queue processing without blocking UI
- **Resource Usage**: Minimal memory overhead for status tracking, existing file processing limits maintained

### Security & Validation
- File type validation on both frontend and backend (images: jpg, png, gif; documents: pdf, docx, pptx, txt, md)
- File size limits enforced (images: 10MB, documents: 50MB)
- Sanitize uploaded filenames to prevent path traversal attacks
- User isolation: all uploads associated with authenticated user_id
- Audio upload explicitly disabled with user-friendly messaging

---

## IMPLEMENTATION GUIDANCE

### Suggested Approach
1. [Recommended implementation strategy]
2. [Key technical decisions and rationale]
3. [Potential challenges and mitigation strategies]

### File Structure Impact
```
Files to Create:
- frontend/src/components/[NewComponent].tsx
- backend/src/services/[new-service].py
- [Other new files]

Files to Modify:
- [List existing files that need changes]
- [Include specific functions or sections]
```

### Dependencies
- **Internal Dependencies**: [Existing features this relies on]
- **External Dependencies**: [New packages or services needed]
- **Blocking Requirements**: [What must be completed first]

### Development Phases
1. **Phase 1**: [Initial foundation - X hours]
2. **Phase 2**: [Core functionality - X hours]  
3. **Phase 3**: [Polish and optimization - X hours]

---

## TESTING & VALIDATION

### Test Scenarios
- **Unit Tests**: [Key functions/components to test]
- **Integration Tests**: [API endpoints and data flows]
- **E2E Tests**: [Critical user journeys]
- **Performance Tests**: [Load and stress testing needs]

### Validation Steps
1. [How to verify the requirement is met]
2. [Manual testing procedures]
3. [Automated test coverage]
4. [User acceptance testing criteria]

---

## CONTEXT & NOTES

### Business Context
[Why is this requirement important? What problem does it solve?]

### Technical Context
[How does this fit into the existing architecture? Any technical constraints?]

### Research & Discovery
[Any research findings, user feedback, or competitive analysis that influenced this requirement]

### Open Questions
- [Unresolved questions that need clarification]
- [Assumptions that need validation]
- [Decisions that need stakeholder input]

---

## RESOURCES & REFERENCES

### Design Resources
- [Mockups, wireframes, or design specifications]
- [Style guide references]
- [User experience documentation]

### Technical References
- [Documentation links]
- [Similar implementations or patterns]
- [External API documentation]

### Related Requirements
- [Links to other requirements this connects to]
- [Dependencies or follow-up requirements]

---

## COMPLETION CHECKLIST

**Development Complete**
- [ ] Code implementation finished
- [ ] Code review completed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Documentation updated

**Testing Complete**
- [ ] Manual testing completed
- [ ] E2E tests passing
- [ ] Performance requirements met
- [ ] Security review completed
- [ ] Accessibility review completed

**Deployment Ready**
- [ ] Database migrations ready (if applicable)
- [ ] Environment variables configured
- [ ] Feature flags configured (if applicable)
- [ ] Monitoring and logging implemented
- [ ] Rollback plan documented

---

## TEMPLATE USAGE NOTES

### For You (The User):
1. **Copy this entire template** for each new requirement
2. **Fill out all relevant sections** - skip sections that don't apply
3. **Be specific** in acceptance criteria - use testable statements
4. **Include context** - help me understand the "why" behind the requirement
5. **Update status** as work progresses

### For Me (Claude):
This template provides:
- **Clear scope** and acceptance criteria for implementation
- **Technical guidance** on architecture and file structure
- **Context** for making good technical decisions
- **Success metrics** to validate correct implementation
- **Test scenarios** to ensure quality and reliability

### Priority Guidelines:
- **Critical**: System stability, security issues, blocking other work
- **High**: Core user functionality, significant business value
- **Medium**: Feature enhancements, user experience improvements
- **Low**: Nice-to-have features, minor optimizations

### Estimation Guidelines:
- **1-2 hours**: Small UI tweaks, configuration changes, minor bug fixes
- **1-2 days**: New components, API endpoints, database changes
- **1-2 weeks**: Complex features, major integrations, architectural changes

---

## Research Topic Tab Enhancement

**Requirement ID**: [REQ-002]  
**Title**: Research Topic Tab Enhancement
**Priority**: Medium
**Estimated Effort**: 6-8 hours

**Created**: August 29, 2025  
**Last Updated**: August 29, 2025 15:30 UTC 

---

## FUNCTIONAL REQUIREMENTS

### User Story
**As a user who uses the Learning Tool to store personal knowledge base locally, with the photo and file uploaded. I want to be able to choose the relevant research topics to expand my knowledge based on the files I uploaded. After finishing uploading files via upload file tab, I click on research topic tab, the tab should show some relevant topics based on relevancy percentage. Then I choose "Research" or "Not Interested" button to choose the topic I want the application to research. While I click on "Research" button on the previous topic, I should still be able to see the next suggested topic and choose whether to perform research or not.

### Detailed Description
The current Research Topic Tab works with only basic functionalities. When a user clicks on interested, while the application does the research on backend, the frontend should still allow users to choose the next topics while the user is waiting for the research to be complete. For the topic that's under research, show a message saying "Searching relevant knowledge" while the application is processing the research. Once the research is completed, show a message say "Research complete" so the users know the topics are ready for review in other tabs. 

### User Experience Flow
1. User clicks on Research Topic tab
2. The tab should show some relevant topics based on relevancy score, a percentage
3. Users will scan the topics choose either "Interested":they are interested in the topic, or "Not Relevant": to discard the topic
4.1 If the user chooses "Interested". The application runs deep research on this topic
4.2 If the user chooses "Not Interested". The application discard the topic then do nothing
5. After user clicks on either option on a previous card, while processing the request, still show the rest of the suggestion cards below and allow the user to perform actions, either interested or not interested
6. Once all suggested topics are processed by the user. Show a message says something like "Thanks for let me know your interests, I will process your research request and show the knowledge in Chat or Knowledge Feed tabs for your reference :)"
7.1 If the user chooses to stay on the Research Topic tab, keep showing the message from step 6. Then show a successful message once all research is done
7.2 If the user chooses to leave the Research Topic tab, keep the research running in backend until is done

### Acceptance Criteria
- ✅ Users should be able to see all the suggested research topics, with a relevant percentage shown in each card
- ✅ While the user choose one card, the rest of the suggested card should still be visible
- ✅ User should be able to see the message once he finish choosing all the topics
- ✅ User should be able to see the successful message if he choose to stay on the tab until the research is finished. If the user choose to leave the tab, keep researching in background until its done and get them ready for chatting or knowledge newsfeed

---

## TECHNICAL REQUIREMENTS

### Architecture Impact
- **Frontend Changes**: Research topic tab UI, async topic processing, background task indicators, topic relevancy display
- **Backend Changes**: Enhanced research topic suggestion endpoints, background processing for research tasks, status tracking
- **Database Changes**: Research topic status tracking, user topic preferences storage
- **Integration Points**: Existing LangGraph research pipeline, topic suggestion system, knowledge base integration

### API Specifications (if applicable)
```typescript
// Enhanced topic suggestion endpoint
GET /research/topics/suggestions?user_id={user_id}
Response: {
  topics: Array<{
    id: string,
    title: string,
    relevancy_percentage: number,
    status: "pending" | "researching" | "completed" | "rejected",
    context: string
  }>,
  total_count: number
}

// Topic action endpoint
POST /research/topics/{topic_id}/action
Request: {
  action: "interested" | "not_interested",
  user_id: string
}
Response: {
  status: "accepted" | "rejected",
  message: string,
  research_id?: string
}

// Research status endpoint
GET /research/status/{research_id}
Response: {
  research_id: string,
  topic: string,
  status: "searching" | "completed" | "failed",
  progress_message: string,
  completed_at?: string
}

Error Handling: 404 for non-existent topics, 400 for invalid actions, 500 for research processing errors
```

### Data Models (if applicable)
```typescript
// Research topic model
interface ResearchTopic {
  id: string;
  user_id: string;
  title: string;
  context: string;
  relevancy_percentage: number;
  status: "pending" | "researching" | "completed" | "rejected";
  created_at: Date;
  updated_at: Date;
}

// Research task tracking
interface ResearchTask {
  id: string;
  topic_id: string;
  user_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress_message: string;
  started_at: Date;
  completed_at?: Date;
  results?: any;
}
```

### Performance Requirements
- **Response Time**: Topic loading < 2 seconds, action responses < 1 second, background research progress updates every 5-10 seconds
- **Throughput**: Support multiple concurrent research tasks per user (max 3 simultaneous)
- **Scalability**: Handle topic generation for multiple uploaded files simultaneously
- **Resource Usage**: Efficient topic relevancy calculation, optimized research pipeline usage

### Security & Validation
- User isolation: all topics and research tasks associated with authenticated user_id
- Input validation for topic selection actions ("interested"/"not_interested" only)
- Rate limiting on research initiation to prevent abuse
- Sanitization of user-generated topic context data

---


## Knowledge Feed

**Requirement ID**: [REQ-005]  
**Title**: Knowledge Feed Debug
**Priority**: High
**Estimated Effort**: 1-2 days

**Created**: August 29, 2025  
**Last Updated**: August 29, 2025 15:30 UTC 

---

## FUNCTIONAL REQUIREMENTS

### User Story
**As a user who uses the Learning Tool to store personal knowledge base locally, with the photo and file uploaded. I want to be able to review the knowledge feed with different type of posts to enhance my memory for the topic I'm interested in.

### Detailed Description
When user clicks on the Knowledge Feed tab, he will see a Facebook-like newsfeed where the user can scroll	through different types of posts based on the knowledge the user upload and ask the application to research. There are five types of posts: Research, Flash Card, Q & A, Chunk, and Summary. Each type of card has unique usage and experience. 
Research (need fix) shows the research summary from the topics the user chooses to research, the link will be in Sources section of the card. Only the summarized words will ben shown in the Summary part of the Research post. 
Flash card (need fix) will show some LLM-generated title based on the topic, once user chooses to reveal the knowledge, the knowledge text chunk will be shown to the user. 
Q&A (currently working) shows some lLM-generated questions base on the topic, once user chooses to reveal the answer, the answer will be shown to the user.
Chunk (currently working) shows a small chunk of text either directly from the knowledge the user uploads, or from the the research content. Chunk should only be exact quote from the content without any LLM adjustments
Summary (need fix) shows a small text chunk of summary of knowledge points based on the knowledge base and research. It is a small LLM-generated text chunk based on the knowledge base, no need to be exact quote from the knowledge.

### User Experience Flow
1. Users click on Knowledge Feed tab
2. Users scrolls up and down on the knowledge feed, seeing different types of cards
3.1 Research (need fix) shows the research summary from the topics the user chooses to research, the link will be in Sources section of the card. Only the summarized words will ben shown in the Summary part of the Research post. 
3.2 Flash card (need fix) will show some LLM-generated title based on the topic, once user chooses to reveal the knowledge, the knowledge text chunk will be shown to the user. 
3.3 Q&A (currently working) shows some lLM-generated questions base on the topic, once user chooses to reveal the answer, the answer will be shown to the user.
3.4 Chunk (currently working) shows a small chunk of text either directly from the knowledge the user uploads, or from the the research content. Chunk should only be exact quote from the content without any LLM adjustments
3.5 Summary (need fix) shows a small text chunk of summary of knowledge points based on the knowledge base and research. It is a small LLM-generated text chunk based on the knowledge base, no need to be exact quote from the knowledge.


### Acceptance Criteria
- User will be able to see different type of cards when clicking on the Knowledge Feed
- Research cards show the research summary from the topics the user chooses to research, the link will be in Sources section of the card. Only the summarized words will ben shown in the Summary part of the Research post. 
3.2 Flash cards will show some LLM-generated title based on the topic, once user chooses to reveal the knowledge, the knowledge text chunk will be shown to the user. 
3.3 Q&A cards show some lLM-generated questions base on the topic, once user chooses to reveal the answer, the answer will be shown to the user.
3.4 Chunk cards show a small chunk of text either directly from the knowledge the user uploads, or from the the research content. Chunk should only be exact quote from the content without any LLM adjustments
3.5 Summary show a small text chunk of summary of knowledge points based on the knowledge base and research. It is a small LLM-generated text chunk based on the knowledge base, no need to be exact quote from the knowledge.

---

## TECHNICAL REQUIREMENTS

### Architecture Impact
- **Frontend Changes**: Knowledge Feed card components fixes, Research/Flash Card/Summary card rendering, card interaction states
- **Backend Changes**: Feed item generation fixes, card content processing, source link handling for Research cards
- **Database Changes**: Feed item content validation, card type metadata enhancements
- **Integration Points**: Existing knowledge feed API (/knowledge/feed), LightRAG content processing, research result integration

### API Specifications (if applicable)
```typescript
// Enhanced knowledge feed endpoint
GET /knowledge/feed?user_id={user_id}&types={card_types}&limit={limit}
Response: {
  items: Array<{
    id: string,
    type: "research" | "flashcard" | "qa" | "chunk" | "summary",
    title: string,
    content: string,
    sources?: Array<{title: string, url: string}>, // For Research cards
    reveal_content?: string, // For Flash cards
    question?: string, // For Q&A cards
    answer?: string, // For Q&A cards (hidden until revealed)
    metadata: {
      created_at: string,
      topic: string,
      relevancy_score?: number
    }
  }>,
  has_more: boolean,
  cursor?: string
}

// Card interaction endpoint
POST /knowledge/feed/{item_id}/reveal
Request: {
  user_id: string
}
Response: {
  revealed_content: string,
  interaction_logged: boolean
}

Error Handling: 404 for non-existent feed items, 400 for invalid card types, 500 for content generation errors
```

### Data Models (if applicable)
```typescript
// Enhanced feed item model
interface FeedItem {
  id: string;
  user_id: string;
  type: "research" | "flashcard" | "qa" | "chunk" | "summary";
  title: string;
  content: string;
  sources?: Array<{title: string, url: string}>;
  reveal_content?: string; // For interactive cards
  question?: string;
  answer?: string;
  metadata: {
    topic: string;
    relevancy_score?: number;
    source_content_id?: string;
  };
  created_at: Date;
}

// Card interaction tracking
interface CardInteraction {
  id: string;
  user_id: string;
  feed_item_id: string;
  interaction_type: "view" | "reveal" | "bookmark";
  timestamp: Date;
}
```

### Performance Requirements
- **Response Time**: Feed loading < 3 seconds, card reveal interactions < 1 second
- **Throughput**: Support infinite scroll with pagination (20-50 items per request)
- **Scalability**: Efficient content generation for all 5 card types simultaneously
- **Resource Usage**: Optimized LLM usage for content generation, efficient feed caching

### Security & Validation
- User isolation: all feed items and interactions associated with authenticated user_id
- Content validation for generated text (prevent harmful content)
- Source link validation for Research cards (ensure URLs are accessible)
- Rate limiting on card generation to prevent abuse
- Secure handling of user knowledge content in card generation

---



*Template Version: 1.0*  
*Created: August 28, 2025*  
*Compatible with: LearningTool project structure and development practices*