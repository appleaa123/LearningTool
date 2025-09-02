import { TopicSuggestion } from "@/components/TopicSuggestions";

const API_BASE = import.meta.env.DEV ? "/api" : "";

export interface TopicPreferences {
  auto_suggest_enabled: boolean;
  suggestion_count: number;
  min_priority_score: number;
  preferred_domains: string[];
}

export interface TopicActionResult {
  success: boolean;
  message: string;
  topic?: TopicSuggestion;
}

/**
 * Service for managing topic suggestions and preferences.
 * Handles API communication for the topic suggestion system.
 */
export class TopicService {
  
  /**
   * Get pending topic suggestions for a user.
   */
  async getTopicSuggestions(
    userId: string,
    notebookId?: number,
    limit: number = 10
  ): Promise<TopicSuggestion[]> {
    const params = new URLSearchParams({
      user_id: userId,
      status: "pending",
      limit: limit.toString(),
    });
    
    if (notebookId !== undefined) {
      params.append("notebook_id", notebookId.toString());
    }

    const response = await fetch(`${API_BASE}/topics/suggestions?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch topic suggestions: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Accept a topic suggestion and trigger research.
   */
  async acceptTopic(
    topicId: number,
    userId: string,
    notebookId?: number
  ): Promise<TopicActionResult> {
    const params = new URLSearchParams({
      user_id: userId,
    });
    
    if (notebookId !== undefined) {
      params.append("notebook_id", notebookId.toString());
    }

    const response = await fetch(
      `${API_BASE}/topics/suggestions/${topicId}/accept?${params}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to accept topic: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Reject a topic suggestion.
   */
  async rejectTopic(
    topicId: number,
    userId: string,
    notebookId?: number
  ): Promise<TopicActionResult> {
    const params = new URLSearchParams({
      user_id: userId,
    });
    
    if (notebookId !== undefined) {
      params.append("notebook_id", notebookId.toString());
    }

    const response = await fetch(
      `${API_BASE}/topics/suggestions/${topicId}/reject?${params}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to reject topic: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get user's topic suggestion preferences.
   */
  async getPreferences(
    userId: string,
    notebookId?: number
  ): Promise<TopicPreferences> {
    const params = new URLSearchParams({
      user_id: userId,
    });
    
    if (notebookId !== undefined) {
      params.append("notebook_id", notebookId.toString());
    }

    const response = await fetch(`${API_BASE}/topics/preferences?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch preferences: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Update user's topic suggestion preferences.
   */
  async updatePreferences(
    preferences: Partial<TopicPreferences>,
    userId: string,
    notebookId?: number
  ): Promise<TopicPreferences> {
    const params = new URLSearchParams({
      user_id: userId,
    });
    
    if (notebookId !== undefined) {
      params.append("notebook_id", notebookId.toString());
    }

    const response = await fetch(`${API_BASE}/topics/preferences?${params}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferences),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update preferences: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Poll for topic suggestions after content upload.
   * Useful for checking if topic generation has completed.
   */
  async pollForTopics(
    userId: string,
    notebookId?: number,
    maxAttempts: number = 10,
    intervalMs: number = 1000
  ): Promise<TopicSuggestion[]> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const topics = await this.getTopicSuggestions(userId, notebookId);
        
        if (topics.length > 0) {
          return topics;
        }
        
        attempts++;
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        console.warn(`Polling attempt ${attempts + 1} failed:`, error);
        attempts++;
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
    }
    
    // Return empty array if no topics found after polling
    return [];
  }

  /**
   * Check service health.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/topics/health`, {
        method: "GET",
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export a singleton instance
export const topicService = new TopicService();