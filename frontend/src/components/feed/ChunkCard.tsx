import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedItemData } from '@/services/feedService';

interface ChunkCardProps {
  item: FeedItemData;
  onViewDetails?: () => void;
  className?: string;
}

/**
 * ChunkCard displays text content chunks with expand/collapse functionality.
 * 
 * Features:
 * - Truncated text with "Read More" expansion
 * - Source document information when available
 * - Responsive text sizing for readability
 * - Accessible expand/collapse controls
 */
export const ChunkCard: React.FC<ChunkCardProps> = ({ 
  item, 
  onViewDetails,
  className 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get text content (assuming content.text for chunks)
  const textContent = item.content?.text || item.content || 'No content available';
  const isLongContent = textContent.length > 300;
  const displayText = isExpanded || !isLongContent 
    ? textContent 
    : textContent.substring(0, 300) + '...';
  
  // Extract source information if available
  const sourceDocument = item.content?.source_document || item.content?.metadata?.source;
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Source document info */}
      {sourceDocument && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ExternalLink size={12} />
          <span>From: {sourceDocument}</span>
        </div>
      )}
      
      {/* Text content */}
      <div className="prose prose-sm max-w-none">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {displayText}
        </p>
      </div>
      
      {/* Expand/collapse controls */}
      {isLongContent && (
        <div className="flex items-center gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-0"
            aria-expanded={isExpanded}
            aria-controls="chunk-content"
          >
            {isExpanded ? (
              <>
                <ChevronUp size={14} className="mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown size={14} className="mr-1" />
                Read More
              </>
            )}
          </Button>
          
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
      )}
      
      {/* Character count for long content */}
      {isLongContent && (
        <div className="text-xs text-muted-foreground">
          {textContent.length.toLocaleString()} characters
        </div>
      )}
    </div>
  );
};

export default ChunkCard;