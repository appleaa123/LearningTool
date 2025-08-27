import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { useState, useEffect, useRef, useCallback } from "react";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { LangGraphEvent, ProviderAvailability } from "@/types/langgraph";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { ChatMessagesView } from "@/components/ChatMessagesView";
import { KnowledgeFeed } from "@/components/KnowledgeFeed";
import { TopicSuggestions } from "@/components/TopicSuggestions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MediaUploader } from "@/components/MediaUploader";
import { AudioRecorder } from "@/components/AudioRecorder";
import { DocumentUploader } from "@/components/DocumentUploader";
import { NotebookSelector } from "@/components/NotebookSelector";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MessageCircle, Grid, Target, Plus } from 'lucide-react';
import { topicService } from "@/services/topicService";

export default function App() {
  const [processedEventsTimeline, setProcessedEventsTimeline] = useState<
    ProcessedEvent[]
  >([]);
  const [historicalActivities, setHistoricalActivities] = useState<
    Record<string, ProcessedEvent[]>
  >({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasFinalizeEventOccurredRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isKnowledgeDrawerOpen, setIsKnowledgeDrawerOpen] = useState(false);
  const [lastIngestIds, setLastIngestIds] = useState<string[] | null>(null);
  const [availableProviders, setAvailableProviders] = useState<ProviderAvailability>({});
  const [notebookId, setNotebookId] = useState<number | null>(null);
  
  // Navigation and view state
  const [activeView, setActiveView] = useState<'chat' | 'feed' | 'topics'>('chat');
  const [pendingTopicsCount, setPendingTopicsCount] = useState(0);
  const [recentFeedItemsCount, setRecentFeedItemsCount] = useState(0);
  const [hasDeepResearchContent, setHasDeepResearchContent] = useState(false);
  
  // Topics state for Topics view
  const [topics, setTopics] = useState<any[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  
  // User ID for consistent data access (derived from thread or default)
  const userId = "anon"; // Default user - in production this would come from authentication
  const thread = useStream<{
    messages: Message[];
    initial_search_query_count: number;
    max_research_loops: number;
    reasoning_model: string;
  }>({
    apiUrl: import.meta.env.DEV
      ? "http://localhost:2024"
      : "http://localhost:8123",
    assistantId: "agent",
    messagesKey: "messages",
    onUpdateEvent: (event: LangGraphEvent) => {
      let processedEvent: ProcessedEvent | null = null;
      // Legacy backend events
      if (event.generate_query) {
        processedEvent = {
          title: "Generating Search Queries",
          data: event.generate_query?.search_query?.join(", ") || "",
        };
      } else if (event.web_research) {
        const sources = event.web_research.sources_gathered || [];
        const numSources = sources.length;
        const uniqueLabels = [
          ...new Set(sources.map((s) => (s as Record<string, unknown>)?.label).filter(Boolean)),
        ];
        const exampleLabels = uniqueLabels.slice(0, 3).join(", ");
        processedEvent = {
          title: "Web Research",
          data: `Gathered ${numSources} sources. Related to: ${
            exampleLabels || "N/A"
          }.`,
        };
      } else if (event.reflection) {
        processedEvent = {
          title: "Reflection",
          data: "Analysing Web Research Results",
        };
      } else if (event.finalize_answer) {
        processedEvent = {
          title: "Finalizing Answer",
          data: "Composing and presenting the final answer.",
        };
        hasFinalizeEventOccurredRef.current = true;
      }

      // ODR events
      else if (event.clarify_with_user) {
        processedEvent = { title: "Clarifying Scope", data: "Checking if clarification is needed." };
      } else if (event.write_research_brief) {
        processedEvent = { title: "Writing Research Brief", data: "Outlining research plan." };
      } else if (event.research_supervisor) {
        processedEvent = { title: "Research Supervisor", data: "Delegating and coordinating research." };
      } else if (event.researcher || event.researcher_tools) {
        processedEvent = { title: "Researching", data: "Gathering info via tools and web search." };
      } else if (event.compress_research) {
        processedEvent = { title: "Compressing Findings", data: "Synthesizing researcher notes." };
      } else if (event.final_report_generation) {
        processedEvent = { title: "Finalizing Answer", data: "Generating final report." };
        hasFinalizeEventOccurredRef.current = true;
      }

      if (processedEvent) {
        setProcessedEventsTimeline((prevEvents) => [...prevEvents, processedEvent!]);
      }
    },
    onError: (error: unknown) => {
      setError((error as Error).message);
    },
  });

  useEffect(() => {
    // Fetch provider availability once for enabling UI options
    const apiBase = import.meta.env.DEV ? "/api" : "";
    fetch(`${apiBase}/config/providers`).then(async (r) => {
      try {
        const data = await r.json();
        setAvailableProviders({ openai: !!data.openai, gemini: !!data.gemini });
      } catch {
        // Silently handle parsing errors
      }
    }).catch(() => {});
  }, []);

  // Update topic and feed counts periodically
  useEffect(() => {
    const updateCounts = async () => {
      try {
        setTopicsLoading(true);
        setTopicsError(null);
        
        // Get pending topics count and full topics list
        const topicsList = await topicService.getTopicSuggestions(userId, notebookId ?? undefined, 50);
        setPendingTopicsCount(topicsList.filter(t => t.status === 'pending').length);
        setTopics(topicsList);
        
        // Update deep research content indicator
        const hasResearch = topicsList.some(t => t.status === 'accepted' || t.status === 'researched');
        setHasDeepResearchContent(hasResearch);
      } catch (error) {
        console.warn('Failed to update counts:', error);
        setTopicsError(error instanceof Error ? error.message : 'Failed to load topics');
      } finally {
        setTopicsLoading(false);
      }
    };

    updateCounts();
    // Update every 30 seconds
    const interval = setInterval(updateCounts, 30000);
    
    return () => clearInterval(interval);
  }, [userId, notebookId]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [thread.messages]);

  useEffect(() => {
    if (
      hasFinalizeEventOccurredRef.current &&
      !thread.isLoading &&
      thread.messages.length > 0
    ) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      if (lastMessage && lastMessage.type === "ai" && lastMessage.id) {
        setHistoricalActivities((prev) => ({
          ...prev,
          [lastMessage.id!]: [...processedEventsTimeline],
        }));
      }
      hasFinalizeEventOccurredRef.current = false;
    }
  }, [thread.messages, thread.isLoading, processedEventsTimeline]);

  const handleSubmit = useCallback(
    (submittedInputValue: string) => {
      if (!submittedInputValue.trim()) return;
      setProcessedEventsTimeline([]);
      hasFinalizeEventOccurredRef.current = false;

      const newMessages: Message[] = [
        ...(thread.messages || []),
        {
          type: "human",
          content: submittedInputValue,
          id: Date.now().toString(),
        },
      ];
      // Pass optional provider keys via configurable when enabled on backend
      (thread.submit as (config: Record<string, unknown>) => void)({
        messages: newMessages,
        configurable: {
          apiKeys: {
            OPENAI_API_KEY: (window as unknown as Record<string, unknown>)?.OPENAI_API_KEY,
            ANTHROPIC_API_KEY: (window as unknown as Record<string, unknown>)?.ANTHROPIC_API_KEY,
            GOOGLE_API_KEY: (window as unknown as Record<string, unknown>)?.GOOGLE_API_KEY,
            TAVILY_API_KEY: (window as unknown as Record<string, unknown>)?.TAVILY_API_KEY,
          },
        },
      });
    },
    [thread]
  );

  const handleCancel = useCallback(() => {
    thread.stop();
    window.location.reload();
  }, [thread]);

  // Topic management handlers
  const handleAcceptTopic = useCallback(async (topicId: number) => {
    try {
      await topicService.acceptTopic(topicId, userId, notebookId ?? undefined);
      // Refresh pending topics count and topics list
      const updatedTopics = await topicService.getTopicSuggestions(userId, notebookId ?? undefined, 50);
      setPendingTopicsCount(updatedTopics.filter(t => t.status === 'pending').length);
      setTopics(updatedTopics);
      
      // Show notification that research started
      console.log('Research started for topic:', topicId);
    } catch (error) {
      console.error('Failed to accept topic:', error);
      setTopicsError(error instanceof Error ? error.message : 'Failed to accept topic');
    }
  }, [userId, notebookId]);

  const handleRejectTopic = useCallback(async (topicId: number) => {
    try {
      await topicService.rejectTopic(topicId, userId, notebookId ?? undefined);
      // Refresh pending topics count and topics list
      const updatedTopics = await topicService.getTopicSuggestions(userId, notebookId ?? undefined, 50);
      setPendingTopicsCount(updatedTopics.filter(t => t.status === 'pending').length);
      setTopics(updatedTopics);
    } catch (error) {
      console.error('Failed to reject topic:', error);
      setTopicsError(error instanceof Error ? error.message : 'Failed to reject topic');
    }
  }, [userId, notebookId]);

  const handleTopicClick = useCallback((topicId: number) => {
    // Navigate to topics view and highlight specific topic
    setActiveView('topics');
    console.log('Navigate to topic:', topicId);
  }, []);

  return (
    <div className="flex h-screen bg-neutral-800 text-neutral-100 font-sans antialiased">
      <main className="h-full w-full max-w-6xl mx-auto flex flex-col">
        {/* Enhanced Navigation Bar */}
        <div className="border-b border-neutral-700 bg-neutral-900/50 backdrop-blur">
          <div className="p-3 flex items-center justify-between">
            {/* Left side - Navigation tabs */}
            <div className="flex items-center gap-1">
              <Button
                variant={activeView === 'chat' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('chat')}
                className="flex items-center gap-2"
              >
                <MessageCircle size={16} />
                <span className="hidden sm:inline">Chat</span>
              </Button>
              
              <Button
                variant={activeView === 'feed' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('feed')}
                className="flex items-center gap-2"
              >
                <Grid size={16} />
                <span className="hidden sm:inline">Knowledge Feed</span>
                {recentFeedItemsCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {recentFeedItemsCount}
                  </Badge>
                )}
              </Button>

              <Button
                variant={activeView === 'topics' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('topics')}
                className="flex items-center gap-2"
              >
                <Target size={16} />
                <span className="hidden sm:inline">Research Topics</span>
                {pendingTopicsCount > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs">
                    {pendingTopicsCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Middle - Notebook selector */}
            <div className="flex-1 flex justify-center">
              <NotebookSelector onChange={setNotebookId} />
            </div>

            {/* Right side - Actions and status */}
            <div className="flex items-center gap-3">
              {/* Content source indicator */}
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  hasDeepResearchContent ? 'border-blue-500 text-blue-300' : 'border-gray-500 text-gray-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  hasDeepResearchContent ? 'bg-blue-500' : 'bg-gray-400'
                }`} />
                {hasDeepResearchContent ? 'Deep Research Available' : 'Local Knowledge Only'}
              </Badge>
              
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setIsKnowledgeDrawerOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add Knowledge</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Area with View Switching */}
        <div className="flex-1 overflow-hidden">
          {activeView === 'chat' && (
            <>
              {thread.messages.length === 0 ? (
                <ErrorBoundary>
                  <div className="h-full flex items-center justify-center">
                    <WelcomeScreen
                      handleSubmit={handleSubmit}
                      isLoading={thread.isLoading}
                      onCancel={handleCancel}
                    />
                  </div>
                </ErrorBoundary>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <h1 className="text-2xl text-red-400 font-bold">Error</h1>
                    <p className="text-red-400">{JSON.stringify(error)}</p>
                    <Button
                      variant="destructive"
                      onClick={() => window.location.reload()}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <ErrorBoundary>
                  <div className="h-full flex flex-col">
                    {hasDeepResearchContent && (
                      <div className="mx-4 mt-4 p-3 bg-blue-950/30 border border-blue-800 rounded-lg">
                        <p className="text-blue-300 text-sm">
                          💡 Your knowledge base includes deep research results. Ask questions to leverage both uploaded content and researched insights.
                        </p>
                      </div>
                    )}
                    <ChatMessagesView
                      messages={thread.messages}
                      isLoading={thread.isLoading}
                      scrollAreaRef={scrollAreaRef}
                      onSubmit={handleSubmit}
                      onCancel={handleCancel}
                      liveActivityEvents={processedEventsTimeline}
                      historicalActivities={historicalActivities}
                    />
                  </div>
                </ErrorBoundary>
              )}
            </>
          )}

          {activeView === 'feed' && (
            <ErrorBoundary>
              <div className="h-full overflow-auto">
                <KnowledgeFeed
                  userId={userId}
                  notebookId={notebookId ?? undefined}
                  className="px-4 py-6"
                  showFilters={true}
                  onTopicClick={handleTopicClick}
                />
              </div>
            </ErrorBoundary>
          )}

          {activeView === 'topics' && (
            <ErrorBoundary>
              <div className="h-full overflow-auto">
                <div className="max-w-4xl mx-auto px-4 py-6">
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-2">Research Topics</h1>
                    <p className="text-muted-foreground">
                      Manage your research topics and view suggestions from uploaded content.
                    </p>
                  </div>
                  
                  <TopicSuggestions
                    topics={topics}
                    onAcceptTopic={handleAcceptTopic}
                    onRejectTopic={handleRejectTopic}
                    loading={topicsLoading}
                    error={topicsError}
                  />
                </div>
              </div>
            </ErrorBoundary>
          )}
        </div>
          {isKnowledgeDrawerOpen && (
            <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsKnowledgeDrawerOpen(false)} />
          )}
          <div
            className={`fixed right-0 top-0 h-full w-full max-w-xl z-50 transform transition-transform duration-200 ${
              isKnowledgeDrawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
            aria-hidden={!isKnowledgeDrawerOpen}
          >
            <div className="h-full bg-neutral-900 border-l border-neutral-700 p-4 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Add to Knowledge</h2>
                <Button variant="ghost" onClick={() => setIsKnowledgeDrawerOpen(false)}>Close</Button>
              </div>
              <ErrorBoundary>
                <Card className="p-3 bg-neutral-900 border-neutral-700">
                  <p className="text-sm text-neutral-300 mb-2">Photo upload</p>
                  <MediaUploader
                    providers={availableProviders}
                    notebookId={notebookId ?? undefined}
                    onSuccess={(ids) => setLastIngestIds(ids)}
                    onError={(msg) => console.warn(msg)}
                  />
                </Card>
              </ErrorBoundary>
              <ErrorBoundary>
                <Card className="p-3 bg-neutral-900 border-neutral-700">
                  <p className="text-sm text-neutral-300 mb-2">Voice input</p>
                  <AudioRecorder
                    providers={availableProviders}
                    notebookId={notebookId ?? undefined}
                    onSuccess={(ids) => setLastIngestIds(ids)}
                    onError={(msg) => console.warn(msg)}
                  />
                </Card>
              </ErrorBoundary>
              <ErrorBoundary>
                <Card className="p-3 bg-neutral-900 border-neutral-700">
                  <p className="text-sm text-neutral-300 mb-2">Document upload</p>
                  <DocumentUploader
                    notebookId={notebookId ?? undefined}
                    onSuccess={(ids) => setLastIngestIds(ids)}
                    onError={(msg) => console.warn(msg)}
                  />
                </Card>
              </ErrorBoundary>
              {lastIngestIds && (
                <div className="text-green-400 text-sm bg-green-950/40 border border-green-700 rounded p-2">
                  Created chunks. IDs: {lastIngestIds.join(", ")}
                </div>
              )}
            </div>
          </div>
      </main>
    </div>
  );
}
