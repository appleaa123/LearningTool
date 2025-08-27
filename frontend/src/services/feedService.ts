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
  content?: any; // Fetched content varies by type
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
   * 
   * @param options - Feed retrieval options including cursor position
   * @returns Promise resolving to paginated feed response
   */
  async getFeed(options: FeedOptions): Promise<FeedResponse> {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch feed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get full content for a specific feed item with topic context.
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
    const params = new URLSearchParams({
      user_id: userId,
      include_topic_context: includeTopicContext.toString(),
    });

    const response = await fetch(`${API_BASE}/knowledge/feed/${itemId}/content?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch feed item content: ${errorText}`);
    }

    return response.json();
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
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const feedService = new FeedService();