# Performance Optimization End-to-End Test Plan

*Comprehensive testing strategy for Bundle Size Optimization and Caching & Performance Improvements*
*Created: September 2, 2025*
*Target: 585KB ’ <400KB bundle size with enhanced caching and performance*

---

## <¯ OVERVIEW

This test plan provides comprehensive end-to-end testing for Performance Optimization features while ensuring:
- **Zero functional regression** - All existing features work identically
- **Tech debt avoidance** - No blocking I/O operations or ASGI compliance issues
- **Performance targets achieved** - Bundle <400KB, improved load times, effective caching
- **User experience maintained** - No degradation in current workflows

---

## =Ê PHASE 1: PRE-IMPLEMENTATION BASELINE TESTING (1-2 hours)

### 1.1 Performance Baseline Measurements

**Bundle Analysis Tests**:
```bash
# Current bundle composition analysis
npm run build
npx webpack-bundle-analyzer dist/assets/

# Expected Results:
# - Current bundle size: ~585KB
# - Identify largest components for optimization
# - Document dependency breakdown
```

**Load Time Metrics**:
```typescript
// Automated performance baseline capture
describe('Performance Baseline', () => {
  it('should capture current performance metrics', async () => {
    const metrics = await page.evaluate(() => ({
      loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
      domContent: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      firstPaint: performance.getEntriesByType('paint')[0]?.startTime,
      firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime
    }));
    
    // Document baseline metrics
    console.log('Baseline Performance:', metrics);
  });
});
```

**API Response Time Baseline**:
```typescript
// Knowledge query performance baseline
describe('API Performance Baseline', () => {
  it('should measure current API response times', async () => {
    const testCases = [
      { endpoint: '/knowledge/feed', expectedTime: '<200ms' },
      { endpoint: '/assistant/ask', expectedTime: '<500ms' },
      { endpoint: '/topics/suggestions', expectedTime: '<200ms' }
    ];
    
    for (const test of testCases) {
      const startTime = performance.now();
      await apiClient.get(test.endpoint);
      const responseTime = performance.now() - startTime;
      
      // Document baseline response times
      expect(responseTime).toBeLessThan(2000); // Current acceptable threshold
    }
  });
});
```

**Memory Usage Profiling**:
```typescript
// Browser memory usage baseline
describe('Memory Usage Baseline', () => {
  it('should profile current memory usage patterns', async () => {
    // Simulate typical user session
    await page.goto('/');
    const initialMemory = await page.evaluate(() => performance.memory?.usedJSHeapSize);
    
    // Navigate through main features
    await page.click('[data-testid="knowledge-feed-tab"]');
    await page.click('[data-testid="research-topics-tab"]');
    await page.click('[data-testid="chat-tab"]');
    
    const finalMemory = await page.evaluate(() => performance.memory?.usedJSHeapSize);
    
    // Document memory usage patterns
    console.log('Memory Usage:', { initial: initialMemory, final: finalMemory });
  });
});
```

### 1.2 ASGI Compliance Verification

**Critical Tech Debt Check**:
```bash
# Verify no blocking I/O operations in current state
langgraph dev --allow-blocking 2>&1 | tee baseline-asgi-check.log

# Expected: No "Blocking call to..." warnings should appear
# This establishes our compliance baseline before optimization
```

**Functional Baseline Validation**:
```bash
# Run complete E2E test suite to establish functional baseline
npm run test:e2e
npm run test:integration
npm run test:components

# All tests must pass - this is our regression prevention baseline
```

---

## =æ PHASE 2: BUNDLE SIZE OPTIMIZATION TESTING (4-6 hours)

### 2.1 Dynamic Import Implementation Tests

**Target Components for Optimization**:
- `KnowledgeFeed.tsx` (347 lines, likely heavy)
- `TopicSuggestions.tsx` (219 lines)  
- `ChatMessagesView.tsx` (streaming functionality)
- Heavy UI libraries and components

**Test Case 1: Lazy Loading Functionality**
```typescript
describe('Dynamic Import Performance', () => {
  it('should lazy load KnowledgeFeed without blocking main thread', async () => {
    // Test lazy loading implementation
    const page = await browser.newPage();
    
    // Navigate to app without accessing Knowledge Feed initially
    await page.goto('/');
    
    // Measure initial bundle size loaded
    const initialScripts = await page.evaluate(() => 
      Array.from(document.querySelectorAll('script')).map(s => s.src)
    );
    
    // Click Knowledge Feed tab to trigger lazy loading
    const loadStartTime = performance.now();
    await page.click('[data-testid="knowledge-feed-tab"]');
    
    // Wait for component to load and render
    await page.waitForSelector('[data-testid="knowledge-feed-component"]');
    const loadTime = performance.now() - loadStartTime;
    
    // Verify new chunks loaded for the component
    const finalScripts = await page.evaluate(() => 
      Array.from(document.querySelectorAll('script')).map(s => s.src)
    );
    
    // Assertions
    expect(finalScripts.length).toBeGreaterThan(initialScripts.length);
    expect(loadTime).toBeLessThan(2000); // Component loads within 2 seconds
    
    // Verify Suspense fallback worked
    // (Should be captured in loading state testing)
  });

  it('should maintain component functionality after lazy loading', async () => {
    await page.goto('/');
    await page.click('[data-testid="knowledge-feed-tab"]');
    
    // Wait for component to fully load
    await page.waitForSelector('[data-testid="knowledge-feed-component"]');
    
    // Test all component functionality
    const searchInput = await page.$('[data-testid="feed-search-input"]');
    await searchInput.type('test query');
    
    const filterButton = await page.$('[data-testid="feed-filter-research"]');
    await filterButton.click();
    
    // Verify functionality identical to non-lazy version
    const feedItems = await page.$$('[data-testid="feed-item"]');
    expect(feedItems.length).toBeGreaterThan(0);
    
    // Test infinite scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    const moreFeedItems = await page.$$('[data-testid="feed-item"]');
    expect(moreFeedItems.length).toBeGreaterThanOrEqual(feedItems.length);
  });
});
```

**Test Case 2: Loading States Quality**
```typescript
describe('Dynamic Import Loading States', () => {
  it('should display proper loading states during component loading', async () => {
    await page.goto('/');
    
    // Click tab and immediately check for loading state
    await Promise.all([
      page.click('[data-testid="knowledge-feed-tab"]'),
      page.waitForSelector('[data-testid="component-loading-spinner"]', { timeout: 1000 })
    ]);
    
    // Verify loading spinner displays
    const spinner = await page.$('[data-testid="component-loading-spinner"]');
    expect(spinner).toBeTruthy();
    
    // Wait for component to load
    await page.waitForSelector('[data-testid="knowledge-feed-component"]');
    
    // Verify loading spinner disappears
    const spinnerAfterLoad = await page.$('[data-testid="component-loading-spinner"]');
    expect(spinnerAfterLoad).toBeNull();
  });
});
```

### 2.2 Route-Based Code Splitting Tests

**Test Case 3: Route Chunk Loading**
```typescript
describe('Route-Based Code Splitting', () => {
  it('should load routes on-demand without affecting navigation', async () => {
    const page = await browser.newPage();
    
    // Track network requests to see chunk loading
    const loadedChunks = [];
    page.on('response', response => {
      if (response.url().includes('.js') && response.url().includes('chunk')) {
        loadedChunks.push(response.url());
      }
    });
    
    // Navigate between all routes
    await page.goto('/');
    const initialChunks = [...loadedChunks];
    
    // Navigate to different routes
    const routes = [
      { tab: 'knowledge-feed-tab', component: 'knowledge-feed-component' },
      { tab: 'research-topics-tab', component: 'topic-suggestions-component' },
      { tab: 'chat-tab', component: 'chat-messages-view' }
    ];
    
    for (const route of routes) {
      await page.click(`[data-testid="${route.tab}"]`);
      await page.waitForSelector(`[data-testid="${route.component}"]`);
      
      // Verify new chunks loaded for this route
      expect(loadedChunks.length).toBeGreaterThan(initialChunks.length);
    }
    
    // Test navigation performance
    const navStartTime = performance.now();
    await page.click('[data-testid="knowledge-feed-tab"]');
    await page.waitForSelector('[data-testid="knowledge-feed-component"]');
    const navTime = performance.now() - navStartTime;
    
    expect(navTime).toBeLessThan(1000); // Navigation within 1 second
  });

  it('should maintain browser back/forward functionality', async () => {
    await page.goto('/');
    
    // Navigate through routes
    await page.click('[data-testid="knowledge-feed-tab"]');
    await page.waitForSelector('[data-testid="knowledge-feed-component"]');
    
    await page.click('[data-testid="research-topics-tab"]');
    await page.waitForSelector('[data-testid="topic-suggestions-component"]');
    
    // Test browser back button
    await page.goBack();
    await page.waitForSelector('[data-testid="knowledge-feed-component"]');
    
    // Test browser forward button
    await page.goForward();
    await page.waitForSelector('[data-testid="topic-suggestions-component"]');
    
    // All navigation should work without errors
  });
});
```

### 2.3 Dependency Analysis & Tree Shaking Tests

**Test Case 4: Bundle Composition Analysis**
```bash
#!/bin/bash
# Bundle analysis script

# Build optimized bundle
npm run build

# Generate bundle analysis
npx webpack-bundle-analyzer dist/assets/ --report --mode static --report-filename bundle-analysis-post-optimization.html

# Compare with baseline
node scripts/compare-bundle-sizes.js baseline-bundle.json current-bundle.json

# Verify target achieved
BUNDLE_SIZE=$(du -k dist/assets/*.js | awk '{sum += $1} END {print sum}')
if [ $BUNDLE_SIZE -gt 400 ]; then
  echo "FAIL: Bundle size $BUNDLE_SIZE KB exceeds 400KB target"
  exit 1
else
  echo "PASS: Bundle size $BUNDLE_SIZE KB meets <400KB target"
fi
```

**Test Case 5: Unused Code Detection**
```typescript
describe('Tree Shaking Effectiveness', () => {
  it('should eliminate unused code from final bundle', async () => {
    // This would be implemented as a build-time analysis
    const bundleAnalysis = await analyzeBundleComposition();
    
    // Check for common unused dependencies
    const unnecessaryDeps = [
      'lodash', // Should be replaced with individual function imports
      'moment', // Should be replaced with date-fns
      'unused-ui-components'
    ];
    
    for (const dep of unnecessaryDeps) {
      expect(bundleAnalysis.dependencies).not.toContain(dep);
    }
    
    // Verify no duplicate dependencies
    const duplicates = findDuplicateDependencies(bundleAnalysis);
    expect(duplicates).toHaveLength(0);
  });
});
```

**Bundle Size Acceptance Criteria**:
-  Final bundle size <400KB (down from 585KB)
-  Main chunk <200KB for faster initial load
-  Route-specific chunks <100KB each
-  No unused dependencies in final bundle
-  No duplicate dependency instances

---

## =€ PHASE 3: CACHING & PERFORMANCE IMPROVEMENTS TESTING (6-8 hours)

### 3.1 API Response Caching Implementation Tests

**Critical Tech Debt Avoidance Pattern**:
```typescript
// MUST follow this pattern to avoid blocking I/O
const cacheImplementation = {
  async get(key: string) {
    // Use async patterns only
    return await asyncio.to_thread(() => {
      // Any synchronous cache operations here
      return cache.get(key);
    });
  },
  
  async set(key: string, value: any) {
    return await asyncio.to_thread(() => {
      return cache.set(key, value);
    });
  }
};
```

**Test Case 6: API Caching System**
```typescript
describe('API Response Caching', () => {
  it('should cache knowledge queries without blocking I/O', async () => {
    const testQuery = { user_id: 'test-user', query: 'test knowledge query' };
    
    // First request - should hit database
    const startTime1 = performance.now();
    const response1 = await apiClient.post('/knowledge/query', testQuery);
    const firstRequestTime = performance.now() - startTime1;
    
    expect(response1.status).toBe(200);
    
    // Second identical request - should hit cache
    const startTime2 = performance.now();
    const response2 = await apiClient.post('/knowledge/query', testQuery);
    const secondRequestTime = performance.now() - startTime2;
    
    expect(response2.status).toBe(200);
    expect(response2.data).toEqual(response1.data);
    
    // Cache hit should be significantly faster
    expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5);
    
    // CRITICAL: Verify no blocking I/O operations logged
    const logs = await getServerLogs();
    const blockingIOErrors = logs.filter(log => 
      log.includes('Blocking call to') || 
      log.includes('io.BufferedReader') ||
      log.includes('sqlite3.Cursor.execute')
    );
    
    expect(blockingIOErrors).toHaveLength(0);
  });

  it('should invalidate cache appropriately on data changes', async () => {
    const testQuery = { user_id: 'test-user', query: 'knowledge query' };
    
    // Initial cached request
    const response1 = await apiClient.post('/knowledge/query', testQuery);
    
    // Upload new content that should affect query results
    await apiClient.post('/ingest/text', {
      text: 'New knowledge content that affects query',
      user_id: 'test-user'
    });
    
    // Query again - should get fresh data (cache invalidated)
    const response2 = await apiClient.post('/knowledge/query', testQuery);
    
    // Results should be different (new content included)
    expect(response2.data.results.length).toBeGreaterThanOrEqual(response1.data.results.length);
  });

  it('should handle cache failures gracefully', async () => {
    // Simulate cache failure
    await mockCacheFailure();
    
    const testQuery = { user_id: 'test-user', query: 'test query' };
    const response = await apiClient.post('/knowledge/query', testQuery);
    
    // Should still return valid response even with cache failure
    expect(response.status).toBe(200);
    expect(response.data.results).toBeDefined();
  });
});
```

**Test Case 7: Memory Management**
```typescript
describe('Cache Memory Management', () => {
  it('should not cause memory leaks with extensive caching', async () => {
    const initialMemory = process.memoryUsage();
    
    // Perform 100 cached requests
    for (let i = 0; i < 100; i++) {
      await apiClient.post('/knowledge/query', {
        user_id: 'test-user',
        query: `test query ${i}`
      });
    }
    
    // Force garbage collection
    if (global.gc) global.gc();
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Memory increase should be reasonable (less than 50MB for 100 requests)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});
```

### 3.2 Optimistic UI Updates Testing

**Test Case 8: Chat Optimistic Updates**
```typescript
describe('Optimistic UI Updates', () => {
  it('should provide immediate feedback in chat while maintaining consistency', async () => {
    await page.goto('/chat');
    
    const messageInput = '[data-testid="chat-input"]';
    const sendButton = '[data-testid="chat-send-button"]';
    const messagesContainer = '[data-testid="chat-messages"]';
    
    // Type and send message
    await page.fill(messageInput, 'Test optimistic update');
    
    // Message should appear immediately (optimistically)
    await Promise.all([
      page.click(sendButton),
      page.waitForSelector(`${messagesContainer} [data-testid="user-message"]:last-child`)
    ]);
    
    const optimisticMessage = await page.textContent(`${messagesContainer} [data-testid="user-message"]:last-child`);
    expect(optimisticMessage).toContain('Test optimistic update');
    
    // Assistant response should appear
    await page.waitForSelector(`${messagesContainer} [data-testid="assistant-message"]:last-child`, {
      timeout: 10000
    });
    
    // Verify final state consistency
    const allMessages = await page.$$eval(`${messagesContainer} [data-testid*="message"]`, 
      elements => elements.map(el => el.textContent)
    );
    
    expect(allMessages).toContain('Test optimistic update');
    expect(allMessages.length).toBeGreaterThanOrEqual(2); // User + assistant message
  });

  it('should handle optimistic update failures gracefully', async () => {
    // Simulate network failure
    await page.setOfflineMode(true);
    
    await page.goto('/chat');
    await page.fill('[data-testid="chat-input"]', 'Test failure handling');
    await page.click('[data-testid="chat-send-button"]');
    
    // Should show retry option or error state
    await page.waitForSelector('[data-testid="message-retry-button"]');
    
    // Restore network and retry
    await page.setOfflineMode(false);
    await page.click('[data-testid="message-retry-button"]');
    
    // Should eventually succeed
    await page.waitForSelector('[data-testid="assistant-message"]:last-child', {
      timeout: 10000
    });
  });
});
```

**Test Case 9: Research Topic Selection Optimistic Updates**
```typescript
describe('Research Topic Optimistic Updates', () => {
  it('should immediately update topic state while processing in background', async () => {
    await page.goto('/research-topics');
    
    // Click "Research This" on a topic
    await page.click('[data-testid="topic-research-button"]:first-child');
    
    // Topic should immediately show "researching" state
    await page.waitForSelector('[data-testid="topic-researching-indicator"]');
    
    // User should be able to continue with other topics
    const remainingButtons = await page.$$('[data-testid="topic-research-button"]');
    expect(remainingButtons.length).toBeGreaterThan(0);
    
    // Background research should eventually complete
    // (This would be validated through API polling or WebSocket updates)
  });
});
```

### 3.3 Service Worker & Offline Functionality Tests

**Test Case 10: Service Worker Implementation**
```typescript
describe('Service Worker Performance', () => {
  it('should register and activate service worker correctly', async () => {
    await page.goto('/');
    
    // Wait for service worker registration
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.ready;
          return true;
        } catch (error) {
          return false;
        }
      }
      return false;
    });
    
    expect(swRegistered).toBe(true);
  });

  it('should serve cached content when offline', async () => {
    // Visit page while online to populate cache
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await page.setOfflineMode(true);
    
    // Refresh page - should load from cache
    await page.reload();
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Verify core functionality available offline
    const appTitle = await page.textContent('[data-testid="app-title"]');
    expect(appTitle).toBeTruthy();
    
    // Test cached API responses
    await page.click('[data-testid="knowledge-feed-tab"]');
    
    // Should show cached feed items or appropriate offline message
    const feedContent = await page.locator('[data-testid="knowledge-feed-component"]').isVisible();
    expect(feedContent).toBe(true);
  });

  it('should sync data when coming back online', async () => {
    // Simulate offline interaction
    await page.setOfflineMode(true);
    await page.goto('/chat');
    
    // Try to send message offline
    await page.fill('[data-testid="chat-input"]', 'Offline message');
    await page.click('[data-testid="chat-send-button"]');
    
    // Should queue for sync
    await page.waitForSelector('[data-testid="message-queued-indicator"]');
    
    // Come back online
    await page.setOfflineMode(false);
    
    // Should sync queued message
    await page.waitForSelector('[data-testid="assistant-message"]:last-child', {
      timeout: 15000
    });
  });
});
```

### 3.4 Image Optimization & Lazy Loading Tests

**Test Case 11: Image Performance**
```typescript
describe('Image Optimization', () => {
  it('should lazy load images without blocking render', async () => {
    await page.goto('/knowledge-feed');
    
    // Track image loading
    const imageRequests = [];
    page.on('request', request => {
      if (request.resourceType() === 'image') {
        imageRequests.push(request.url());
      }
    });
    
    // Initial load should not load all images
    await page.waitForLoadState('domcontentloaded');
    const initialImageCount = imageRequests.length;
    
    // Scroll down to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    const finalImageCount = imageRequests.length;
    
    // More images should load on scroll
    expect(finalImageCount).toBeGreaterThan(initialImageCount);
  });

  it('should show proper placeholders during image loading', async () => {
    await page.goto('/knowledge-feed');
    
    // Look for image placeholder elements
    const placeholders = await page.$$('[data-testid="image-placeholder"]');
    expect(placeholders.length).toBeGreaterThan(0);
    
    // Wait for images to load
    await page.waitForLoadState('networkidle');
    
    // Placeholders should be replaced with actual images
    const images = await page.$$('[data-testid="feed-image"]');
    expect(images.length).toBeGreaterThan(0);
  });
});
```

---

## = PHASE 4: COMPREHENSIVE REGRESSION TESTING (2-3 hours)

### 4.1 ASGI Compliance Validation

**CRITICAL Tech Debt Prevention**:
```bash
#!/bin/bash
# ASGI Compliance Test Script

echo "Testing ASGI compliance after optimizations..."

# Start development server in strict mode
langgraph dev --strict-asgi > asgi-compliance-test.log 2>&1 &
SERVER_PID=$!

sleep 10  # Allow server to fully start

# Run comprehensive test suite
npm run test:e2e:full

# Check for any blocking I/O errors
BLOCKING_ERRORS=$(grep -c "Blocking call to" asgi-compliance-test.log)
IO_ERRORS=$(grep -c "io.BufferedReader" asgi-compliance-test.log)
SQLITE_ERRORS=$(grep -c "sqlite3.Cursor.execute" asgi-compliance-test.log)

kill $SERVER_PID

if [ $BLOCKING_ERRORS -gt 0 ] || [ $IO_ERRORS -gt 0 ] || [ $SQLITE_ERRORS -gt 0 ]; then
    echo "FAIL: Blocking I/O operations detected"
    echo "Blocking errors: $BLOCKING_ERRORS"
    echo "IO errors: $IO_ERRORS"
    echo "SQLite errors: $SQLITE_ERRORS"
    cat asgi-compliance-test.log
    exit 1
else
    echo "PASS: No blocking I/O operations detected"
fi
```

**Test Case 12: Async Operation Validation**
```typescript
describe('ASGI Compliance After Optimization', () => {
  it('should maintain non-blocking patterns in all async operations', async () => {
    // Test all major async operations that could introduce blocking I/O
    const operations = [
      { name: 'Knowledge Feed Load', endpoint: '/knowledge/feed' },
      { name: 'File Upload', endpoint: '/ingest/document' },
      { name: 'Research Query', endpoint: '/assistant/ask' },
      { name: 'Topic Suggestions', endpoint: '/topics/suggestions' }
    ];
    
    for (const op of operations) {
      const startTime = performance.now();
      
      try {
        const response = await apiClient.get(op.endpoint);
        const duration = performance.now() - startTime;
        
        expect(response.status).toBe(200);
        
        // No operation should take excessively long (indicating blocking)
        expect(duration).toBeLessThan(5000);
        
      } catch (error) {
        console.error(`Operation ${op.name} failed:`, error);
        throw error;
      }
    }
    
    // Verify server logs show no blocking operations
    const serverLogs = await getServerLogs();
    const blockingErrors = serverLogs.filter(log => 
      log.includes('Blocking call to') ||
      log.includes('asyncio') && log.includes('error')
    );
    
    expect(blockingErrors).toHaveLength(0);
  });
});
```

### 4.2 End-to-End User Flow Performance Testing

**Test Case 13: Complete User Journey Performance**
```typescript
describe('E2E Performance Validation', () => {
  it('should complete full user workflow within performance targets', async () => {
    const performanceMetrics = {};
    
    // Start timing
    const journeyStartTime = performance.now();
    
    // Step 1: Upload file
    const uploadStartTime = performance.now();
    await page.goto('/');
    await page.setInputFiles('[data-testid="file-upload-input"]', './test-files/sample.pdf');
    await page.waitForSelector('[data-testid="upload-success-message"]');
    performanceMetrics.upload = performance.now() - uploadStartTime;
    
    // Step 2: View generated topics
    const topicsStartTime = performance.now();
    await page.click('[data-testid="research-topics-tab"]');
    await page.waitForSelector('[data-testid="topic-card"]:first-child');
    performanceMetrics.topicsLoad = performance.now() - topicsStartTime;
    
    // Step 3: Research a topic
    const researchStartTime = performance.now();
    await page.click('[data-testid="topic-research-button"]:first-child');
    await page.waitForSelector('[data-testid="topic-researching-indicator"]');
    performanceMetrics.researchInitiate = performance.now() - researchStartTime;
    
    // Step 4: View knowledge feed
    const feedStartTime = performance.now();
    await page.click('[data-testid="knowledge-feed-tab"]');
    await page.waitForSelector('[data-testid="feed-item"]:first-child');
    performanceMetrics.feedLoad = performance.now() - feedStartTime;
    
    // Step 5: Chat interaction
    const chatStartTime = performance.now();
    await page.click('[data-testid="chat-tab"]');
    await page.fill('[data-testid="chat-input"]', 'Tell me about the uploaded content');
    await page.click('[data-testid="chat-send-button"]');
    await page.waitForSelector('[data-testid="assistant-message"]:last-child');
    performanceMetrics.chatResponse = performance.now() - chatStartTime;
    
    const totalJourneyTime = performance.now() - journeyStartTime;
    
    // Performance Assertions
    expect(performanceMetrics.upload).toBeLessThan(5000); // 5s for upload
    expect(performanceMetrics.topicsLoad).toBeLessThan(2000); // 2s for topics
    expect(performanceMetrics.researchInitiate).toBeLessThan(1000); // 1s to initiate
    expect(performanceMetrics.feedLoad).toBeLessThan(3000); // 3s for feed
    expect(performanceMetrics.chatResponse).toBeLessThan(10000); // 10s for chat
    expect(totalJourneyTime).toBeLessThan(30000); // 30s total journey
    
    console.log('Performance Metrics:', performanceMetrics);
  });
});
```

### 4.3 Memory Leak & Resource Management Tests

**Test Case 14: Extended Usage Memory Testing**
```typescript
describe('Memory Management After Optimization', () => {
  it('should not introduce memory leaks with caching and lazy loading', async () => {
    const memorySnapshots = [];
    
    // Take initial memory snapshot
    await page.goto('/');
    memorySnapshots.push(await page.evaluate(() => performance.memory?.usedJSHeapSize));
    
    // Simulate extended usage
    for (let i = 0; i < 10; i++) {
      // Navigate between all tabs
      await page.click('[data-testid="knowledge-feed-tab"]');
      await page.waitForSelector('[data-testid="knowledge-feed-component"]');
      
      await page.click('[data-testid="research-topics-tab"]');
      await page.waitForSelector('[data-testid="topic-suggestions-component"]');
      
      await page.click('[data-testid="chat-tab"]');
      await page.waitForSelector('[data-testid="chat-messages-view"]');
      
      // Perform search operations
      await page.fill('[data-testid="chat-input"]', `Test query ${i}`);
      await page.click('[data-testid="chat-send-button"]');
      await page.waitForSelector('[data-testid="assistant-message"]:last-child');
      
      // Take memory snapshot
      const memoryUsage = await page.evaluate(() => performance.memory?.usedJSHeapSize);
      memorySnapshots.push(memoryUsage);
    }
    
    // Analyze memory growth
    const initialMemory = memorySnapshots[0];
    const finalMemory = memorySnapshots[memorySnapshots.length - 1];
    const memoryGrowth = finalMemory - initialMemory;
    
    // Memory growth should be reasonable (less than 50MB over 10 iterations)
    expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    
    // Check for memory leaks pattern (continuous growth)
    const growthTrend = memorySnapshots.slice(1).map((current, index) => 
      current - memorySnapshots[index]
    );
    
    // Not every iteration should increase memory (some should be flat or decrease due to GC)
    const alwaysIncreasing = growthTrend.every(growth => growth > 0);
    expect(alwaysIncreasing).toBe(false);
  });
});
```

---

## =È PHASE 5: PERFORMANCE VALIDATION & METRICS (1 hour)

### 5.1 Performance Metrics Validation

**Success Criteria Validation**:
```typescript
describe('Performance Targets Achievement', () => {
  it('should meet all performance targets after optimization', async () => {
    // Bundle Size Target: <400KB
    const bundleStats = await getBundleStats();
    expect(bundleStats.totalSize).toBeLessThan(400 * 1024);
    
    // Initial Load Time: Maintained or improved
    const loadMetrics = await measureLoadTime();
    expect(loadMetrics.loadTime).toBeLessThan(3000); // 3 seconds
    expect(loadMetrics.firstContentfulPaint).toBeLessThan(1500); // 1.5 seconds
    
    // API Response Time: <200ms maintained
    const apiMetrics = await measureAPIResponseTimes();
    expect(apiMetrics.knowledgeQuery).toBeLessThan(200);
    expect(apiMetrics.feedLoad).toBeLessThan(200);
    expect(apiMetrics.topicSuggestions).toBeLessThan(200);
    
    // Memory Usage: No significant increase
    const memoryUsage = await measureMemoryUsage();
    expect(memoryUsage.baseline).toBeLessThan(memoryUsage.optimized * 1.2); // Max 20% increase
    
    // Cache Hit Ratio: >80% for repeated queries
    const cacheMetrics = await measureCacheEffectiveness();
    expect(cacheMetrics.hitRatio).toBeGreaterThan(0.8);
  });
});
```

### 5.2 User Experience Validation

**Test Case 15: UX Quality Assurance**
```typescript
describe('User Experience After Optimization', () => {
  it('should maintain or improve user experience quality', async () => {
    // Test perceived performance
    await page.goto('/');
    
    // Measure time to interactive elements
    const interactiveTime = await page.evaluate(async () => {
      const startTime = performance.now();
      
      // Wait for main interactive elements to be available
      while (!document.querySelector('[data-testid="upload-button"]') ||
             !document.querySelector('[data-testid="knowledge-feed-tab"]')) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      return performance.now() - startTime;
    });
    
    expect(interactiveTime).toBeLessThan(2000); // Interactive within 2 seconds
    
    // Test loading states quality
    await page.click('[data-testid="knowledge-feed-tab"]');
    
    // Should show loading indicator immediately
    const loadingIndicator = await page.waitForSelector('[data-testid="component-loading-spinner"]', {
      timeout: 500
    });
    expect(loadingIndicator).toBeTruthy();
    
    // Component should load smoothly
    await page.waitForSelector('[data-testid="knowledge-feed-component"]');
    
    // No flash of unstyled content or layout shifts
    const layoutShifts = await page.evaluate(() => {
      // This would measure Cumulative Layout Shift
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.value) {
            clsValue += entry.value;
          }
        }
      }).observe({type: 'layout-shift', buffered: true});
      
      return clsValue;
    });
    
    expect(layoutShifts).toBeLessThan(0.1); // Good CLS score
  });

  it('should preserve accessibility features', async () => {
    await page.goto('/');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.dataset?.testid);
    expect(focusedElement).toBeTruthy();
    
    // Test ARIA labels
    const ariaLabels = await page.$$eval('[aria-label]', elements => elements.length);
    expect(ariaLabels).toBeGreaterThan(10);
    
    // Test semantic HTML
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements => elements.length);
    expect(headings).toBeGreaterThan(5);
    
    // Run automated accessibility checks
    const accessibilityViolations = await runAxeCheck(page);
    expect(accessibilityViolations.serious).toHaveLength(0);
    expect(accessibilityViolations.critical).toHaveLength(0);
  });
});
```

---

## =á TEST AUTOMATION STRATEGY

### Continuous Performance Monitoring

**Performance Budget Configuration**:
```javascript
// webpack.config.js performance budgets
module.exports = {
  performance: {
    maxAssetSize: 300000, // 300KB per asset
    maxEntrypointSize: 400000, // 400KB for main entry
    hints: 'error' // Fail build if exceeded
  }
};
```

**Automated Bundle Analysis**:
```bash
#!/bin/bash
# scripts/performance-check.sh

# Build and analyze
npm run build
npx webpack-bundle-analyzer dist/assets/ --report --mode json --report-filename bundle-stats.json

# Check bundle size
node scripts/check-bundle-size.js

# Run performance tests
npm run test:performance

# Check for performance regressions
node scripts/performance-regression-check.js
```

### CI/CD Integration

**GitHub Actions Performance Pipeline**:
```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run performance tests
        run: |
          npm run test:performance
          npm run test:bundle-size
          npm run test:e2e:performance
      
      - name: Upload performance artifacts
        uses: actions/upload-artifact@v3
        with:
          name: performance-reports
          path: |
            bundle-analysis.html
            performance-metrics.json
            lighthouse-report.html
```

---

## =¨ RISK MITIGATION & ROLLBACK STRATEGY

### Feature Flag Implementation
```typescript
// Feature flags for gradual rollout
const featureFlags = {
  bundleOptimization: process.env.ENABLE_BUNDLE_OPTIMIZATION === 'true',
  apiCaching: process.env.ENABLE_API_CACHING === 'true',
  imageLazyLoading: process.env.ENABLE_IMAGE_LAZY_LOADING === 'true',
  serviceWorker: process.env.ENABLE_SERVICE_WORKER === 'true'
};
```

### Rollback Procedures
```bash
#!/bin/bash
# scripts/rollback-optimizations.sh

echo "Rolling back performance optimizations..."

# Restore original webpack config
git checkout HEAD~1 -- webpack.config.js

# Disable feature flags
export ENABLE_BUNDLE_OPTIMIZATION=false
export ENABLE_API_CACHING=false
export ENABLE_IMAGE_LAZY_LOADING=false
export ENABLE_SERVICE_WORKER=false

# Rebuild with original configuration
npm run build

echo "Rollback completed. Please test functionality."
```

### Monitoring & Alerting
```javascript
// Performance monitoring setup
const performanceMonitor = {
  bundleSize: {
    threshold: 400 * 1024, // 400KB
    alert: 'Bundle size exceeded 400KB threshold'
  },
  loadTime: {
    threshold: 3000, // 3 seconds
    alert: 'Page load time exceeded 3 second threshold'
  },
  apiResponseTime: {
    threshold: 200, // 200ms
    alert: 'API response time exceeded 200ms threshold'
  }
};
```

---

##  ACCEPTANCE CRITERIA SUMMARY

### Bundle Size Optimization
-  **Bundle size reduced from 585KB to <400KB**
-  **Main chunk <200KB for faster initial load**
-  **Route-specific chunks <100KB each**
-  **Dynamic imports work without blocking main thread**
-  **Loading states display properly during lazy loading**
-  **All component functionality preserved after optimization**
-  **No console errors or warnings introduced**

### Caching & Performance Improvements
-  **API response caching achieves >80% hit ratio**
-  **Cache operations use non-blocking patterns only**
-  **No blocking I/O operations detected in ASGI mode**
-  **Optimistic UI updates provide immediate feedback**
-  **Service worker enables basic offline functionality**
-  **Image lazy loading improves initial load performance**
-  **Memory usage increase <20% over baseline**

### Regression Prevention
-  **All existing E2E tests pass**
-  **No functionality regressions detected**
-  **ASGI compliance maintained (no blocking I/O)**
-  **API response times maintained (<200ms)**
-  **User workflows work identically**
-  **Accessibility features preserved**
-  **Mobile responsiveness unchanged**

### Performance Targets
-  **Initial page load <3 seconds**
-  **Time to Interactive <2 seconds**
-  **API response times <200ms maintained**
-  **Cache hit ratio >80% for repeated queries**
-  **Memory growth <50MB over extended usage**
-  **No memory leak patterns detected**

---

*This comprehensive test plan ensures zero functional regression while achieving aggressive performance targets and maintaining strict compliance with ASGI requirements to avoid all documented tech debt issues.*