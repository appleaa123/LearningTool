import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Sparkles, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedItemData } from '@/services/feedService';

interface SummaryCardProps {
  item: FeedItemData;
  onViewDetails?: () => void;
  className?: string;
}

/**
 * SummaryCard displays AI-generated content summaries.
 * 
 * Features:
 * - Collapsible sections for key points
 * - Source content reference
 * - AI generation indicator
 * - Structured summary layout
 */
export const SummaryCard: React.FC<SummaryCardProps> = ({ 
  item, 
  onViewDetails,
  className 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Extract summary data
  const summary = item.content?.summary || item.content?.content || 'No summary available';
  const keyPoints = item.content?.key_points || [];
  const sourceContent = item.content?.source_content || item.content?.original_text;
  const confidence = item.content?.confidence_score;
  
  const isLongSummary = summary.length > 400;
  const displaySummary = isExpanded || !isLongSummary 
    ? summary 
    : summary.substring(0, 400) + '...';
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* AI Generation indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-blue-500" />
          <span className="text-xs text-muted-foreground">AI-Generated Summary</span>
        </div>
        
        {confidence && (
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs",
              confidence > 0.8 ? "border-green-500 text-green-600" :
              confidence > 0.6 ? "border-yellow-500 text-yellow-600" :
              "border-red-500 text-red-600"
            )}
          >
            {Math.round(confidence * 100)}% confidence
          </Badge>
        )}
      </div>
      
      {/* Summary content */}
      <div className="space-y-3">
        <div className="prose prose-sm max-w-none">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {displaySummary}
          </p>
        </div>
        
        {/* Key points if available */}
        {keyPoints.length > 0 && (
          <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <FileText size={14} />
              Key Points
            </h4>
            <ul className="space-y-1">
              {keyPoints.map((point: string, index: number) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-blue-500 font-bold mt-0.5">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          {isLongSummary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-0"
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={14} className="mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown size={14} className="mr-1" />
                  Read Full Summary
                </>
              )}
            </Button>
          )}
          
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewDetails}
              className="text-xs text-muted-foreground hover:text-foreground px-2"
            >
              View Details
            </Button>
          )}
        </div>
        
        {/* Word count */}
        <span className="text-xs text-muted-foreground">
          {summary.split(' ').length} words
        </span>
      </div>
      
      {/* Source content reference */}
      {sourceContent && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Source Content Preview
          </summary>
          <div className="mt-2 p-2 bg-neutral-100 dark:bg-neutral-800 rounded text-muted-foreground max-h-20 overflow-hidden">
            {sourceContent.substring(0, 200)}...
          </div>
        </details>
      )}
    </div>
  );
};

export default SummaryCard;