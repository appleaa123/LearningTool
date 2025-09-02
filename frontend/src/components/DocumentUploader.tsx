import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AudioRecordingError } from "@/types/langgraph";
import { TopicSuggestions, TopicSuggestion } from "./TopicSuggestions";
import { topicService } from "@/services/topicService";

type DocumentUploaderProps = {
  userId?: string;
  notebookId?: number;
  onSuccess?: (ids: string[]) => void;
  onError?: (message: string) => void;
  enableTopicSuggestions?: boolean;
};

/**
 * Document uploader for PDF/DOCX/PPTX/TXT/MD that posts to /ingest/document.
 */
export function DocumentUploader({
  userId = "anon",
  notebookId,
  onSuccess,
  onError,
  enableTopicSuggestions = false,
}: DocumentUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ids, setIds] = useState<string[] | null>(null);
  
  // Topic suggestion state
  const [topicSuggestions, setTopicSuggestions] = useState<TopicSuggestion[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  
  const apiBase = import.meta.env.DEV ? "/api" : "";

  async function handleUpload() {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setIds(null);
    setTopicError(null);
    setShowTopicSuggestions(false);
    
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("user_id", userId);
      if (notebookId != null) form.append("notebook_id", String(notebookId));
      
      // Keep topic generation in background but hide from upload UI
      // Topics will appear in Research Topics tab instead of upload interface
      form.append("suggest_topics", "true");
      
      const res = await fetch(`${apiBase}/ingest/document`, {
        method: "POST",
        body: form,
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed with status ${res.status}`);
      }
      
      const data: { inserted: number; ids: string[]; status?: string; message?: string } = await res.json();
      setIds(data.ids);
      onSuccess?.(data.ids);
      
      // Topic suggestions disabled in upload UI
      // Topics are generated in background and appear in Research Topics tab
      
    } catch (e: unknown) {
      const msg = (e as AudioRecordingError)?.message || "Failed to upload document";
      setError(msg);
      onError?.(msg);
    } finally {
      setIsUploading(false);
    }
  }

  const pollForTopicSuggestions = useCallback(async () => {
    setLoadingTopics(true);
    setTopicError(null);
    
    try {
      // Poll for topics with timeout
      const topics = await topicService.pollForTopics(
        userId,
        notebookId,
        8, // max attempts
        2000 // 2 second intervals
      );
      
      setTopicSuggestions(topics);
      setShowTopicSuggestions(topics.length > 0);
      
      if (topics.length === 0) {
        setTopicError("No topic suggestions were generated for this content.");
      }
    } catch (err) {
      console.error("Failed to poll for topic suggestions:", err);
      setTopicError("Failed to generate topic suggestions. The content may not contain enough information for meaningful research topics.");
    } finally {
      setLoadingTopics(false);
    }
  }, [userId, notebookId]);

  const handleAcceptTopic = useCallback(async (topicId: number) => {
    try {
      const result = await topicService.acceptTopic(topicId, userId, notebookId);
      
      if (result.success) {
        // Remove the accepted topic from the list
        setTopicSuggestions(prev => prev.filter(t => t.id !== topicId));
        
        // Show success message (you might want to add a toast here)
        console.log("Research started:", result.message);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      console.error("Failed to accept topic:", err);
      throw err; // Re-throw for component to handle
    }
  }, [userId, notebookId]);

  const handleRejectTopic = useCallback(async (topicId: number) => {
    try {
      const result = await topicService.rejectTopic(topicId, userId, notebookId);
      
      if (result.success) {
        // Remove the rejected topic from the list
        setTopicSuggestions(prev => prev.filter(t => t.id !== topicId));
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      console.error("Failed to reject topic:", err);
      throw err; // Re-throw for component to handle
    }
  }, [userId, notebookId]);

  return (
    <Card className="p-4 bg-neutral-900 border-neutral-700">
      <div className="space-y-3">
        <input
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-neutral-200 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-neutral-700 file:text-neutral-100 hover:file:bg-neutral-600"
        />
        {error && (
          <div className="text-red-400 text-sm bg-red-950/40 border border-red-700 rounded p-2">{error}</div>
        )}
        {ids && (
          <div className="text-green-400 text-sm bg-green-950/40 border border-green-700 rounded p-2">
            {file?.name} uploaded and ready for use!
          </div>
        )}
        <div className="flex gap-2">
          <Button disabled={!file || isUploading} onClick={handleUpload}>
            {isUploading ? "Uploading..." : "Upload Document"}
          </Button>
          {error && (
            <Button variant="destructive" onClick={handleUpload} disabled={isUploading}>
              Retry
            </Button>
          )}
        </div>
        
        {/* Topic Suggestions */}
        {enableTopicSuggestions && (showTopicSuggestions || loadingTopics) && (
          <div className="mt-4">
            <TopicSuggestions
              topics={topicSuggestions}
              onAcceptTopic={handleAcceptTopic}
              onRejectTopic={handleRejectTopic}
              loading={loadingTopics}
              error={topicError}
            />
          </div>
        )}
      </div>
    </Card>
  );
}


