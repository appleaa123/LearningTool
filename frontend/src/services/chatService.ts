const API_BASE = import.meta.env.DEV ? "/api" : "";

// Chat message interfaces matching backend models
export interface ChatMessage {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  sources?: Array<{title: string, url?: string, content?: string}>;
  created_at: string;
}

// Chat session interface
export interface ChatSession {
  id: number;
  notebook_id: number;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

// Request/response interfaces matching backend API
export interface AskRequest {
  user_id: string;
  question: string;
  effort?: 'low' | 'medium' | 'high';
  provider?: string;
  model?: string;
  deep_research?: boolean;
  notebook_id?: number;
  session_id?: number;
}

export interface AskResponse {
  answer: string;
  sources: Array<{title: string, url?: string, content?: string}>;
  rag_preview?: string;
  session_id?: number;
  message_id?: number;
}

export interface SessionHistoryResponse {
  session_id: number;
  notebook_id: number;
  messages: ChatMessage[];
}

export interface SessionCreateRequest {
  user_id: string;
  notebook_id: number;
}

export interface SessionCreateResponse {
  session_id: number;
  notebook_id: number;
  created_at: string;
}

/**
 * Service for managing chat sessions and message history.
 * 
 * Provides integration with the enhanced assistant API while preserving
 * all existing LangGraph research functionality. Handles session persistence,
 * message history, and notebook isolation.
 */
export class ChatService {
  
  /**
   * Send a question to the assistant with session management.
   * 
   * Preserves all existing functionality:
   * - LightRAG knowledge queries
   * - Deep research with LangGraph agents
   * - Research summaries and feed items
   * 
   * Added functionality:
   * - Automatic session management
   * - Message persistence
   * - Chat history tracking
   * 
   * @param request - Chat request parameters
   * @returns Promise resolving to assistant response with session info
   */
  async ask(request: AskRequest): Promise<AskResponse> {
    const response = await fetch(`${API_BASE}/assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Assistant request failed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get or create chat session for a notebook.
   * 
   * @param userId - User identifier
   * @param notebookId - Notebook to create session for
   * @returns Promise resolving to session information
   */
  async getOrCreateSession(
    userId: string, 
    notebookId: number
  ): Promise<SessionCreateResponse> {
    const response = await fetch(`${API_BASE}/assistant/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        notebook_id: notebookId,
      } as SessionCreateRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Session creation failed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get chat history for a session.
   * 
   * @param sessionId - Session to get history for
   * @param userId - User ID for access control
   * @param limit - Optional limit on messages returned
   * @returns Promise resolving to session history
   */
  async getSessionHistory(
    sessionId: number,
    userId: string,
    limit?: number
  ): Promise<SessionHistoryResponse> {
    const params = new URLSearchParams({
      user_id: userId,
    });

    if (limit !== undefined) {
      params.append("limit", limit.toString());
    }

    const response = await fetch(
      `${API_BASE}/assistant/sessions/${sessionId}/history?${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch session history: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get chat session for a specific notebook.
   * 
   * This method attempts to get session history which will return
   * session info if it exists, or null if no session found.
   * 
   * @param userId - User identifier
   * @param notebookId - Notebook to find session for
   * @returns Promise resolving to session if exists, null otherwise
   */
  async getNotebookSession(
    userId: string,
    notebookId: number
  ): Promise<ChatSession | null> {
    try {
      // Try to create/get session - this will return existing if found
      const sessionResponse = await this.getOrCreateSession(userId, notebookId);
      
      return {
        id: sessionResponse.session_id,
        notebook_id: sessionResponse.notebook_id,
        created_at: sessionResponse.created_at,
        updated_at: sessionResponse.created_at, // Will be updated on messages
        last_message_at: undefined,
      };
    } catch (error) {
      // If notebook doesn't exist or other error, return null
      console.warn("Failed to get notebook session:", error);
      return null;
    }
  }

  /**
   * Load chat history for a notebook on app startup/notebook selection.
   * 
   * @param userId - User identifier
   * @param notebookId - Notebook to load history for
   * @returns Promise resolving to message history (empty if no session)
   */
  async loadNotebookHistory(
    userId: string,
    notebookId: number
  ): Promise<ChatMessage[]> {
    try {
      const session = await this.getNotebookSession(userId, notebookId);
      if (!session) {
        return [];
      }

      const history = await this.getSessionHistory(session.id, userId);
      return history.messages;
    } catch (error) {
      console.warn("Failed to load notebook history:", error);
      return [];
    }
  }

  /**
   * Health check for chat service endpoints.
   * 
   * @returns Promise resolving to service health status
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test with a simple session creation for health check
      // In a real app, this might be a dedicated health endpoint
      const response = await fetch(`${API_BASE}/assistant/sessions`, {
        method: "OPTIONS", // OPTIONS request for CORS preflight
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      return response.status < 500; // Service is healthy if not server error
    } catch {
      return false;
    }
  }

  /**
   * Clear chat history for a notebook (development/testing utility).
   * Note: This would require a delete endpoint on backend for full implementation.
   * 
   * @param userId - User identifier
   * @param notebookId - Notebook to clear history for
   * @returns Promise resolving when cleared
   */
  async clearNotebookHistory(
    _userId: string,
    _notebookId: number
  ): Promise<boolean> {
    // This would require backend implementation of DELETE session endpoint
    // For now, return false to indicate not implemented
    console.warn("Clear history not implemented - requires backend DELETE endpoint");
    return false;
  }

  /**
   * Format message for display in chat UI.
   * 
   * Helper method to ensure consistent message formatting
   * across the application.
   * 
   * @param message - Raw message from API
   * @returns Formatted message ready for UI display
   */
  formatMessageForDisplay(message: ChatMessage): ChatMessage {
    return {
      ...message,
      content: message.content.trim(),
      sources: message.sources?.map(source => ({
        title: source.title,
        url: source.url,
        content: source.content?.substring(0, 200) + (source.content && source.content.length > 200 ? "..." : "")
      })) || undefined,
      created_at: message.created_at,
    };
  }

  /**
   * Check if a message has research sources.
   * 
   * @param message - Message to check
   * @returns True if message has research sources
   */
  hasResearchSources(message: ChatMessage): boolean {
    return Boolean(message.sources && message.sources.length > 0);
  }

  /**
   * Get the last user message in a session.
   * 
   * @param messages - Array of messages
   * @returns Last user message or null if none found
   */
  getLastUserMessage(messages: ChatMessage[]): ChatMessage | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'user') {
        return messages[i];
      }
    }
    return null;
  }

  /**
   * Get the last assistant message in a session.
   * 
   * @param messages - Array of messages
   * @returns Last assistant message or null if none found
   */
  getLastAssistantMessage(messages: ChatMessage[]): ChatMessage | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'assistant') {
        return messages[i];
      }
    }
    return null;
  }
}

// Export singleton instance for consistent usage across the app
export const chatService = new ChatService();