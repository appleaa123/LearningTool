import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export interface TopicSuggestion {
  id: number;
  topic: string;
  context: string;
  priority_score: number;
  status: string;
  source_type: string;
  source_filename?: string;
  created_at: string;
}

interface TopicSuggestionsProps {
  topics: TopicSuggestion[];
  onAcceptTopic: (topicId: number) => Promise<void>;
  onRejectTopic: (topicId: number) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

/**
 * Component for displaying topic suggestions with accept/reject functionality.
 * Renders a list of suggested research topics generated from uploaded content.
 */
export const TopicSuggestions: React.FC<TopicSuggestionsProps> = ({
  topics,
  onAcceptTopic,
  onRejectTopic,
  loading = false,
  error = null,
}) => {
  const [processingTopics, setProcessingTopics] = useState<Set<number>>(new Set());

  const handleAcceptTopic = useCallback(async (topicId: number) => {
    setProcessingTopics(prev => new Set(prev).add(topicId));
    try {
      await onAcceptTopic(topicId);
    } catch (err) {
      console.error(`Failed to accept topic ${topicId}:`, err);
    } finally {
      setProcessingTopics(prev => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  }, [onAcceptTopic]);

  const handleRejectTopic = useCallback(async (topicId: number) => {
    setProcessingTopics(prev => new Set(prev).add(topicId));
    try {
      await onRejectTopic(topicId);
    } catch (err) {
      console.error(`Failed to reject topic ${topicId}:`, err);
    } finally {
      setProcessingTopics(prev => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  }, [onRejectTopic]);

  const formatPriorityScore = (score: number): string => {
    return (score * 100).toFixed(0) + "%";
  };

  const getSourceIcon = (sourceType: string): string => {
    switch (sourceType) {
      case "document": return "📄";
      case "image": return "🖼️";
      case "text": return "✏️";
      default: return "📝";
    }
  };

  const getSourceLabel = (sourceType: string, filename?: string): string => {
    if (filename) {
      return `${getSourceIcon(sourceType)} ${filename}`;
    }
    
    switch (sourceType) {
      case "document": return "📄 Document";
      case "image": return "🖼️ Image";
      case "text": return "✏️ Text";
      default: return "📝 Content";
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-neutral-900 border-neutral-700">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
          <span className="ml-3 text-neutral-300">Generating topic suggestions...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 bg-red-950/40 border-red-700">
        <div className="text-red-400 text-sm">
          <strong>Topic Generation Error:</strong> {error}
        </div>
      </Card>
    );
  }

  if (topics.length === 0) {
    return null; // Don't show anything if no topics
  }

  return (
    <Card className="p-6 bg-neutral-900 border-neutral-700">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-100">
            💡 Research Suggestions
          </h3>
          <Badge variant="secondary" className="bg-blue-900/30 text-blue-300">
            {topics.length} suggestion{topics.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        <p className="text-neutral-400 text-sm">
          Based on your uploaded content, here are some research topics that could enhance your knowledge:
        </p>

        <div className="space-y-4" data-testid="topic-suggestions">
          {topics.map((topic) => {
            const isProcessing = processingTopics.has(topic.id);
            
            return (
              <div
                key={topic.id}
                className="topic-card border border-neutral-700 rounded-lg p-4 bg-neutral-800 hover:bg-neutral-750 transition-colors"
              >
                <div className="space-y-3">
                  {/* Header with source info and priority */}
                  <div className="flex items-start justify-between">
                    <div className="text-xs text-neutral-500">
                      {getSourceLabel(topic.source_type, topic.source_filename)}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        topic.priority_score >= 0.8 
                          ? 'border-green-600 text-green-400' 
                          : topic.priority_score >= 0.6
                          ? 'border-yellow-600 text-yellow-400'
                          : 'border-neutral-600 text-neutral-400'
                      }`}
                    >
                      {formatPriorityScore(topic.priority_score)} relevance
                    </Badge>
                  </div>

                  {/* Topic title */}
                  <h4 className="font-medium text-neutral-100 leading-snug">
                    {topic.topic}
                  </h4>

                  {/* Context/explanation */}
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {topic.context}
                  </p>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptTopic(topic.id)}
                      disabled={isProcessing}
                      className="bg-green-900/30 text-green-300 hover:bg-green-900/50 border-green-700"
                      data-testid={`accept-topic-${topic.id}`}
                    >
                      {isProcessing ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span className="ml-1">Starting Research...</span>
                        </>
                      ) : (
                        <>
                          ✅ Research This
                        </>
                      )}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectTopic(topic.id)}
                      disabled={isProcessing}
                      className="border-neutral-600 text-neutral-400 hover:bg-neutral-800"
                      data-testid={`reject-topic-${topic.id}`}
                    >
                      {isProcessing ? "Processing..." : "❌ Not Interested"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-neutral-500 italic border-t border-neutral-700 pt-3 mt-4">
          💡 Tip: Accepting a topic will start deep web research and add the results to your knowledge base.
        </div>
      </div>
    </Card>
  );
};