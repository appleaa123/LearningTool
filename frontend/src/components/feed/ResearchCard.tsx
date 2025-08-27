import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  BookOpen, 
  Target,
  Globe,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedItemData } from '@/services/feedService';

interface ResearchCardProps {
  item: FeedItemData;
  onTopicClick?: (topicId: number) => void;
  onViewDetails?: () => void;
  className?: string;
}

/**
 * ResearchCard displays research results with citations and topic context.
 * 
 * Features:
 * - Research summary with expand/collapse
 * - Citation links with preview
 * - Topic context integration
 * - Research quality indicators
 * - Source attribution and timestamps
 */
export const ResearchCard: React.FC<ResearchCardProps> = ({ 
  item, 
  onTopicClick,
  onViewDetails,
  className 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  
  // Extract research data
  const summary = item.content?.summary || item.content?.report || 'No research summary available';
  const sources = item.content?.sources || item.content?.citations || [];
  const researchDate = item.content?.research_date || item.content?.completed_at;
  const confidence = item.content?.confidence_score;
  const keywords = item.content?.keywords || [];
  
  const isLongSummary = summary.length > 500;
  const displaySummary = isExpanded || !isLongSummary 
    ? summary 
    : summary.substring(0, 500) + '...';
  
  const displaySources = showAllSources ? sources : sources.slice(0, 3);
  
  // Format research date
  const formatResearchDate = (dateString: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Research header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-purple-500" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            Deep Research Results
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {researchDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={12} />
              {formatResearchDate(researchDate)}
            </div>
          )}
          
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
      </div>
      
      {/* Keywords */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {keywords.slice(0, 5).map((keyword: string, index: number) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {keyword}
            </Badge>
          ))}
          {keywords.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{keywords.length - 5} more
            </Badge>
          )}
        </div>
      )}
      
      {/* Research summary */}
      <div className="space-y-3">
        <h4 className="font-medium text-base flex items-center gap-2">
          <BookOpen size={16} />
          Research Summary
        </h4>
        
        <div className="prose prose-sm max-w-none">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {displaySummary}
          </p>
        </div>
      </div>
      
      {/* Sources/Citations */}
      {sources.length > 0 && (
        <div className="space-y-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4">
          <h5 className="font-medium text-sm flex items-center gap-2">
            <ExternalLink size={14} />
            Sources ({sources.length})
          </h5>
          
          <div className="space-y-2">
            {displaySources.map((source: any, index: number) => (
              <div 
                key={index} 
                className="flex items-start gap-3 p-2 bg-white dark:bg-neutral-800 rounded border"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {source.title || 'Untitled Source'}
                  </div>
                  {source.url && (
                    <a 
                      href={source.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate block"
                    >
                      {source.url}
                    </a>
                  )}
                  {source.excerpt && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {source.excerpt}
                    </p>
                  )}
                </div>
                
                {source.relevance && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {Math.round(source.relevance * 100)}%
                  </Badge>
                )}
              </div>
            ))}
          </div>
          
          {sources.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllSources(!showAllSources)}
              className="text-xs w-full"
            >
              {showAllSources 
                ? 'Show Less Sources' 
                : `Show ${sources.length - 3} More Sources`
              }
            </Button>
          )}
        </div>
      )}
      
      {/* Controls */}
      <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3">
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
                  Read Full Research
                </>
              )}
            </Button>
          )}
          
          {item.topic_context && onTopicClick && (
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => onTopicClick(item.topic_context!.topic_id)}
              className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 px-2"
            >
              <Target size={14} className="mr-1" />
              View Topic
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
        
        {/* Research stats */}
        <div className="text-xs text-muted-foreground">
          {summary.split(' ').length} words • {sources.length} sources
        </div>
      </div>
    </div>
  );
};

export default ResearchCard;