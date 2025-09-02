import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Eye, EyeOff, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedItemData } from '@/services/feedService';

interface FlashcardCardProps {
  item: FeedItemData;
  onViewDetails?: () => void;
  className?: string;
}

/**
 * FlashcardCard displays interactive flashcard content with flip animation.
 * 
 * Features:
 * - Interactive flip animation between question and answer
 * - Difficulty level indicators
 * - Study progress tracking
 * - Category and tag organization
 */
export const FlashcardCard: React.FC<FlashcardCardProps> = ({ 
  item, 
  onViewDetails,
  className 
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  
  // Extract flashcard data with backward compatibility
  const front = item.content?.front || item.content?.question || item.content?.text?.split('Back:')[0]?.replace('Front:', '').trim() || 'No question available';
  const back = item.content?.back || item.content?.answer || item.content?.text?.split('Back:')[1]?.trim() || 'No answer available';
  const difficulty = item.content?.difficulty || 'medium';
  const category = item.content?.category || 'general';
  const tags = item.content?.tags || [];
  const studyCount = item.content?.study_count || 0;
  const lastStudied = item.content?.last_studied;
  const totalCards = item.content?.total_cards || 1;
  const metadata = item.content?.metadata || {};
  
  // Get difficulty color
  const getDifficultyColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'easy':
        return 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950/30';
      case 'medium':
        return 'border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30';
      case 'hard':
        return 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/30';
      default:
        return 'border-neutral-500 text-neutral-600 bg-neutral-50 dark:bg-neutral-950/30';
    }
  };
  
  // Format last studied date
  const formatLastStudied = (dateString: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return 'studied today';
    } else if (diffInHours < 168) {
      const days = Math.floor(diffInHours / 24);
      return `studied ${days}d ago`;
    } else {
      return `studied ${date.toLocaleDateString()}`;
    }
  };
  
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (!isFlipped) {
      setShowAnswer(true);
    }
  };
  
  const handleRevealAnswer = () => {
    setShowAnswer(!showAnswer);
  };
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Flashcard header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-orange-500" />
          <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
            Flashcard
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {category && (
            <Badge variant="outline" className="text-xs">
              {category}
            </Badge>
          )}
          
          <Badge 
            variant="outline" 
            className={cn("text-xs", getDifficultyColor(difficulty))}
          >
            {difficulty}
          </Badge>
        </div>
      </div>
      
      {/* Tags and metadata */}
      <div className="flex flex-wrap items-center gap-2">
        {tags.length > 0 && (
          <>
            {tags.slice(0, 3).map((tag: string, index: number) => (
              <Badge key={index} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 3} more
              </Badge>
            )}
          </>
        )}
        
        {totalCards > 1 && (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {totalCards} cards
          </Badge>
        )}
      </div>
      
      {/* Flashcard content */}
      <div className="relative">
        {/* Card container with flip animation */}
        <div 
          className={cn(
            "relative min-h-32 rounded-lg border-2 transition-all duration-300 cursor-pointer",
            isFlipped ? "bg-green-50 dark:bg-green-950/30 border-green-300" : "bg-blue-50 dark:bg-blue-950/30 border-blue-300"
          )}
          onClick={handleFlip}
        >
          {/* Front side (Question) */}
          <div className={cn(
            "p-4 transition-opacity duration-300",
            isFlipped ? "opacity-0 absolute inset-0" : "opacity-100"
          )}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                QUESTION
              </span>
              <RotateCcw size={14} className="text-blue-500" />
            </div>
            
            <div className="prose prose-sm max-w-none">
              <p className="text-sm font-medium leading-relaxed text-blue-900 dark:text-blue-100">
                {front}
              </p>
              {totalCards > 1 && (
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Card 1 of {totalCards}
                </div>
              )}
            </div>
            
            <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
              Click to reveal answer
            </div>
          </div>
          
          {/* Back side (Answer) */}
          <div className={cn(
            "p-4 transition-opacity duration-300",
            isFlipped ? "opacity-100" : "opacity-0 absolute inset-0"
          )}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                ANSWER
              </span>
              <RotateCcw size={14} className="text-green-500" />
            </div>
            
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed text-green-900 dark:text-green-100">
                {back}
              </p>
              {totalCards > 1 && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                  Card 1 of {totalCards} • {difficulty} difficulty
                </div>
              )}
            </div>
            
            <div className="mt-3 text-xs text-green-600 dark:text-green-400">
              Click to show question
            </div>
          </div>
        </div>
      </div>
      
      {/* Alternative reveal button for accessibility */}
      <div className="flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRevealAnswer}
          className="text-xs"
        >
          {showAnswer ? (
            <>
              <EyeOff size={14} className="mr-1" />
              Hide Answer
            </>
          ) : (
            <>
              <Eye size={14} className="mr-1" />
              Reveal Answer
            </>
          )}
        </Button>
      </div>
      
      {/* Revealed answer (for accessibility) */}
      {showAnswer && !isFlipped && (
        <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 rounded-lg">
          <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
            ANSWER
          </div>
          <p className="text-sm text-green-900 dark:text-green-100">
            {back}
          </p>
        </div>
      )}
      
      {/* Study statistics and controls */}
      <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {studyCount > 0 && (
            <span>Studied {studyCount} times</span>
          )}
          
          {lastStudied && (
            <span>{formatLastStudied(lastStudied)}</span>
          )}
          
          {/* Enhanced metadata */}
          {metadata.source_topic && (
            <span>Topic: {metadata.source_topic}</span>
          )}
        </div>
        
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
    </div>
  );
};

export default FlashcardCard;