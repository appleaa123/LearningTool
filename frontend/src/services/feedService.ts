import { apiCache } from '@/utils/apiCache';
import { featureFlags } from '@/utils/featureFlags';
import { performanceMonitor } from '@/utils/performanceMonitor';

const API_BASE = import.meta.env.DEV ? "/api" : "";

// Feed item types based on backend FeedKind enum
export type FeedItemKind = 'chunk' | 'summary' | 'qa' | 'flashcard' | 'research';

// Core feed item interface matching backend response
export interface FeedItem {
  id: number;
  kind: FeedItemKind;
  ref_id: number;
  created_at: string;
  notebook_id?: number;
}

// Enhanced feed item with content and topic context
export interface FeedItemData extends FeedItem {
  content?: {
    // Common fields
    text?: string;
    type?: string;
    metadata?: Record<string, any>;
    
    // Summary specific
    summary?: string;
    key_points?: string[];
    confidence_score?: number;
    
    // Q&A specific
    question?: string;
    answer?: string;
    category?: string;
    sources?: Array<{title: string; content: string}>;
    
    // Flashcard specific
    front?: string;
    back?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
    total_cards?: number;
    study_count?: number;
    last_studied?: string;
    
    // Research specific
    report?: string;
    keywords?: string[];
    citations?: Array<{
      title: string;
      url: string;
      excerpt?: string;
      relevance?: number;
      source_type?: string;
      published_date?: string;
    }>;
    research_date?: string;
    completed_at?: string;
    confidence?: number;
    
    // Chunk specific
    source_document?: string;
    
    // Additional fields for backward compatibility
    content?: string;
    original_text?: string;
    source_content?: string;
  };
  topic_context?: {
    topic_id: number;
    topic: string;
    context: string;
    user_initiated: boolean;
  };
  source_metadata?: {
    source: 'user_upload' | 'topic_research';
    user_initiated: boolean;
  };
}

// API response interfaces
export interface FeedResponse {
  items: FeedItem[];
  next_cursor: number | null;
  total?: number;
}

export interface FeedContentResponse {
  feed_item: FeedItem;
  content: any;
  topic_context?: {
    topic_id: number;
    topic: string;
    context: string;
    user_initiated: boolean;
  };
  user_choice_metadata?: {
    source: 'user_upload' | 'topic_research';
    user_initiated: boolean;
  };
}

// Feed options for API calls
export interface FeedOptions {
  userId: string;
  notebookId?: number;
  cursor?: number;
  limit?: number;
  filter?: string;
  search?: string;
}

/**
 * Service for managing knowledge feed data.
 * Handles API communication for the Facebook-style knowledge browser.
 * 
 * Implements cursor-based pagination for smooth infinite scroll performance.
 */
export class FeedService {
  
  /**
   * Get feed items with cursor-based pagination.
   * Enhanced with retry logic, caching, and better error handling.
   * 
   * @param options - Feed retrieval options including cursor position
   * @returns Promise resolving to paginated feed response
   */
  async getFeed(options: FeedOptions): Promise<FeedResponse> {
    // Generate cache key for this specific request
    const cacheKey = this.generateFeedCacheKey(options);
    const requestId = `getFeed-${Date.now()}-${Math.random()}`;
    
    // Try cache first (only for initial loads, not pagination)
    if (featureFlags.isEnabled('enableApiCaching') && options.cursor === undefined) {
      const cached = apiCache.get<FeedResponse>(cacheKey);
      if (cached) {
        performanceMonitor.endAPIRequest(requestId, '/knowledge/feed', 'GET', true);
        return cached;
      }
    }

    performanceMonitor.startAPIRequest(requestId, '/knowledge/feed', 'GET');

    return this.withRetry(async () => {
      const params = new URLSearchParams({
        user_id: options.userId,
        cursor: (options.cursor || 0).toString(),
        limit: (options.limit || 20).toString(),
      });
      
      if (options.notebookId !== undefined) {
        params.append("notebook_id", options.notebookId.toString());
      }
      
      if (options.filter && options.filter !== 'all') {
        params.append("filter", options.filter);
      }
      
      if (options.search) {
        params.append("search", options.search);
      }

      const response = await fetch(`${API_BASE}/knowledge/feed?${params}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15000), // 15 second timeout for feed loading
      });

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        throw new Error(`Failed to fetch feed: ${errorData.message}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid feed response structure');
      }
      
      // Cache successful response (only initial loads, not pagination)
      if (featureFlags.isEnabled('enableApiCaching') && options.cursor === undefined) {
        apiCache.set(cacheKey, data, {
          ttl: 3 * 60 * 1000, // 3 minutes for feed data
        });
      }
      
      performanceMonitor.endAPIRequest(requestId, '/knowledge/feed', 'GET', false);
      return data;
    });
  }

  /**
   * Get full content for a specific feed item with topic context.
   * Enhanced with caching for better performance.
   * 
   * @param itemId - Feed item ID
   * @param userId - User ID for access control
   * @param includeTopicContext - Whether to include topic context data
   * @returns Promise resolving to complete content data
   */
  async getFeedItemContent(
    itemId: number, 
    userId: string, 
    includeTopicContext: boolean = true
  ): Promise<FeedContentResponse> {
    // Generate cache key for this specific content request
    const cacheKey = `feed-content:${itemId}:${userId}:${includeTopicContext}`;
    
    // Try cache first
    if (featureFlags.isEnabled('enableApiCaching')) {
      const cached = apiCache.get<FeedContentResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const params = new URLSearchParams({
      user_id: userId,
      include_topic_context: includeTopicContext.toString(),
    });

    try {
      const response = await fetch(`${API_BASE}/knowledge/feed/${itemId}/content?${params}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        // Add timeout for better UX
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        throw new Error(`Failed to fetch feed item content: ${errorData.message}`);
      }

      const data = await response.json();
      
      // Enhanced content processing and validation
      const processedData = this.processContentResponse(data);
      
      // Cache successful response
      if (featureFlags.isEnabled('enableApiCaching')) {
        apiCache.set(cacheKey, processedData, {
          ttl: 5 * 60 * 1000, // 5 minutes for content data
        });
      }
      
      return processedData;
      
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Request timed out. Please try again.');
      } else if (error instanceof TypeError) {
        throw new Error('Network error. Please check your connection.');
      }
      throw error;
    }
  }

  /**
   * Refresh the feed cache for a user.
   * 
   * @param userId - User ID to refresh feed for
   * @returns Promise resolving when refresh is complete
   */
  async refreshFeed(userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/knowledge/feed/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh feed: ${errorText}`);
    }
  }

  /**
   * Get feed items for a specific topic.
   * 
   * @param topicId - Topic ID to get feed for
   * @param userId - User ID for access control
   * @returns Promise resolving to topic-specific feed
   */
  async getTopicFeed(topicId: number, userId: string): Promise<FeedResponse> {
    const params = new URLSearchParams({
      user_id: userId,
    });

    const response = await fetch(`${API_BASE}/topics/${topicId}/feed?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch topic feed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Search across all feed content.
   * 
   * @param query - Search query string
   * @param userId - User ID for access control
   * @param limit - Maximum number of results
   * @returns Promise resolving to search results
   */
  async searchFeed(query: string, userId: string, limit: number = 50): Promise<FeedResponse> {
    const params = new URLSearchParams({
      q: query,
      user_id: userId,
      limit: limit.toString(),
    });

    const response = await fetch(`${API_BASE}/knowledge/feed/search?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to search feed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Check feed service health.
   * 
   * @returns Promise resolving to service health status
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/knowledge/feed/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000), // 5 second timeout for health check
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Process and validate content response from backend.
   * Ensures consistent data structure for frontend consumption.
   * 
   * @private
   * @param data - Raw response data from backend
   * @returns Processed and validated content response
   */
  private processContentResponse(data: any): FeedContentResponse {
    // Ensure content exists and is properly structured
    if (data.content) {
      // Handle backward compatibility - ensure structured access
      const content = data.content;
      
      // For summary cards, ensure key_points is an array
      if (data.feed_item?.kind === 'summary') {
        content.key_points = Array.isArray(content.key_points) ? content.key_points : [];
        content.confidence_score = typeof content.confidence_score === 'number' ? content.confidence_score : 0.5;
      }
      
      // For flashcard cards, ensure front/back exist
      if (data.feed_item?.kind === 'flashcard') {
        content.front = content.front || 'No question available';
        content.back = content.back || 'No answer available';
        content.difficulty = content.difficulty || 'medium';
        content.tags = Array.isArray(content.tags) ? content.tags : [];
      }
      
      // For research cards, ensure sources is an array
      if (data.feed_item?.kind === 'research') {
        content.sources = Array.isArray(content.sources) ? content.sources : [];
        content.keywords = Array.isArray(content.keywords) ? content.keywords : [];
      }
      
      // For Q&A cards, ensure question/answer exist
      if (data.feed_item?.kind === 'qa') {
        content.question = content.question || 'No question available';
        content.answer = content.answer || 'No answer available';
        content.sources = Array.isArray(content.sources) ? content.sources : [];
      }
    }
    
    return data;
  }

  /**
   * Parse error response from API with fallback handling.
   * 
   * @private
   * @param response - Failed response object
   * @returns Error information object
   */
  private async parseErrorResponse(response: Response): Promise<{message: string; code?: string}> {
    try {
      const errorData = await response.json();
      return {
        message: errorData.detail || errorData.message || `HTTP ${response.status}`,
        code: errorData.code
      };
    } catch {
      // Fallback to status text if JSON parsing fails
      return {
        message: response.statusText || `HTTP ${response.status}`,
        code: `HTTP_${response.status}`
      };
    }
  }
  
  /**
   * Generate cache key for feed requests
   * 
   * @private
   * @param options - Feed options to generate key for
   * @returns Cache key string
   */
  private generateFeedCacheKey(options: FeedOptions): string {
    const keyParts = [
      'feed',
      options.userId,
      options.notebookId?.toString() || 'all',
      options.filter || 'all',
      options.search || 'none',
      options.limit?.toString() || '20'
    ];
    return keyParts.join(':');
  }

  /**
   * Invalidate feed cache for a specific user/notebook
   * 
   * @param userId - User ID to invalidate cache for
   * @param notebookId - Optional notebook ID for targeted invalidation
   */
  invalidateFeedCache(userId: string, notebookId?: number): void {
    if (featureFlags.isEnabled('enableApiCaching')) {
      const pattern = notebookId 
        ? `feed:${userId}:${notebookId}:`
        : `feed:${userId}:`;
      apiCache.invalidatePattern(pattern);
    }
  }

  /**
   * Enhanced error handling for feed operations with retry logic.
   * 
   * @private
   * @param operation - Function to retry
   * @param maxRetries - Maximum number of retry attempts
   * @param delay - Delay between retries in milliseconds
   * @returns Promise resolving to operation result
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
        }
      }
    }
    
    throw lastError!;
  }
}

// Export singleton instance
export const feedService = new FeedService();