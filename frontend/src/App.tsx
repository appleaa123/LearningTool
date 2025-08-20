import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { useState, useEffect, useRef, useCallback } from "react";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { ChatMessagesView } from "@/components/ChatMessagesView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MediaUploader } from "@/components/MediaUploader";
import { AudioRecorder } from "@/components/AudioRecorder";
import { DocumentUploader } from "@/components/DocumentUploader";
import { NotebookSelector } from "@/components/NotebookSelector";

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
  const [availableProviders, setAvailableProviders] = useState<{ openai?: boolean; gemini?: boolean }>({});
  const [notebookId, setNotebookId] = useState<number | null>(null);
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
    onUpdateEvent: (event: any) => {
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
          ...new Set(sources.map((s: any) => s.label).filter(Boolean)),
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
    onError: (error: any) => {
      setError(error.message);
    },
  });

  useEffect(() => {
    // Fetch provider availability once for enabling UI options
    const apiBase = import.meta.env.DEV ? "/api" : "";
    fetch(`${apiBase}/config/providers`).then(async (r) => {
      try {
        const data = await r.json();
        setAvailableProviders({ openai: !!data.openai, gemini: !!data.gemini });
      } catch (_) {}
    }).catch(() => {});
  }, []);

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
    (submittedInputValue: string, _effort: string, _model: string) => {
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
      (thread.submit as any)({
        messages: newMessages,
        configurable: {
          apiKeys: {
            OPENAI_API_KEY: (window as any)?.OPENAI_API_KEY,
            ANTHROPIC_API_KEY: (window as any)?.ANTHROPIC_API_KEY,
            GOOGLE_API_KEY: (window as any)?.GOOGLE_API_KEY,
            TAVILY_API_KEY: (window as any)?.TAVILY_API_KEY,
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

  return (
    <div className="flex h-screen bg-neutral-800 text-neutral-100 font-sans antialiased">
      <main className="h-full w-full max-w-4xl mx-auto">
          <div className="p-2 flex justify-between items-center gap-2">
            <NotebookSelector onChange={setNotebookId} />
            <Button variant="secondary" onClick={() => setIsKnowledgeDrawerOpen(true)}>
              Add to Knowledge
            </Button>
          </div>
          {thread.messages.length === 0 ? (
            <WelcomeScreen
              handleSubmit={handleSubmit}
              isLoading={thread.isLoading}
              onCancel={handleCancel}
            />
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
            <ChatMessagesView
              messages={thread.messages}
              isLoading={thread.isLoading}
              scrollAreaRef={scrollAreaRef}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              liveActivityEvents={processedEventsTimeline}
              historicalActivities={historicalActivities}
            />
          )}
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
              <Card className="p-3 bg-neutral-900 border-neutral-700">
                <p className="text-sm text-neutral-300 mb-2">Photo upload</p>
                <MediaUploader
                  providers={availableProviders}
                  notebookId={notebookId ?? undefined}
                  onSuccess={(ids) => setLastIngestIds(ids)}
                  onError={(msg) => console.warn(msg)}
                />
              </Card>
              <Card className="p-3 bg-neutral-900 border-neutral-700">
                <p className="text-sm text-neutral-300 mb-2">Voice input</p>
                <AudioRecorder
                  providers={availableProviders}
                  notebookId={notebookId ?? undefined}
                  onSuccess={(ids) => setLastIngestIds(ids)}
                  onError={(msg) => console.warn(msg)}
                />
              </Card>
              <Card className="p-3 bg-neutral-900 border-neutral-700">
                <p className="text-sm text-neutral-300 mb-2">Document upload</p>
                <DocumentUploader
                  notebookId={notebookId ?? undefined}
                  onSuccess={(ids) => setLastIngestIds(ids)}
                  onError={(msg) => console.warn(msg)}
                />
              </Card>
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
