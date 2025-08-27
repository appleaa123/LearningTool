import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, HelpCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedItemData } from '@/services/feedService';

interface QACardProps {
  item: FeedItemData;
  onViewDetails?: () => void;
  className?: string;
}

/**
 * QACard displays question and answer pairs with expandable answers.
 * 
 * Features:
 * - Prominent question display
 * - Expandable answer content
 * - Answer quality indicators
 * - Source references when available
 */
export const QACard: React.FC<QACardProps> = ({ 
  item, 
  onViewDetails,
  className 
}) => {
  const [isAnswerExpanded, setIsAnswerExpanded] = useState(false);
  
  // Extract Q&A data
  const question = item.content?.question || 'No question available';
  const answer = item.content?.answer || 'No answer available';
  const sources = item.content?.sources || [];
  const confidence = item.content?.confidence_score;
  const category = item.content?.category;
  
  const isLongAnswer = answer.length > 300;
  const displayAnswer = isAnswerExpanded || !isLongAnswer 
    ? answer 
    : answer.substring(0, 300) + '...';
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Question section */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <HelpCircle size={20} className="text-blue-500 mt-1 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <h3 className="font-medium text-base leading-snug">
              {question}
            </h3>
            
            {/* Metadata */}
            <div className="flex items-center gap-2 flex-wrap">
              {category && (
                <Badge variant="outline" className="text-xs">
                  {category}
                </Badge>
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
        </div>
      </div>
      
      {/* Answer section */}
      <div className="bg-green-50 dark:bg-green-950/30 border-l-4 border-green-500 pl-4 pr-3 py-3">
        <div className="flex items-start gap-3">
          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-green-900 dark:text-green-100">
                {displayAnswer}
              </p>
            </div>
            
            {/* Sources */}
            {sources.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-green-800 dark:text-green-200">
                  Sources:
                </h4>
                <div className="space-y-1">
                  {sources.slice(0, 3).map((source: any, index: number) => (
                    <div key={index} className="text-xs text-green-700 dark:text-green-300">
                      • {source.title || source.url || source.reference}
                    </div>
                  ))}
                  {sources.length > 3 && (
                    <div className="text-xs text-green-600 dark:text-green-400">
                      +{sources.length - 3} more sources
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          {isLongAnswer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAnswerExpanded(!isAnswerExpanded)}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-0"
              aria-expanded={isAnswerExpanded}
            >
              {isAnswerExpanded ? (
                <>
                  <ChevronUp size={14} className="mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown size={14} className="mr-1" />
                  Read Full Answer
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
        
        {/* Answer length */}
        <span className="text-xs text-muted-foreground">
          {answer.split(' ').length} words
        </span>
      </div>
    </div>
  );
};

export default QACard;