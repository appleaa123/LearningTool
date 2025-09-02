import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SourceBadge } from './SourceBadge';
import { ChunkCard } from './ChunkCard';
import { SummaryCard } from './SummaryCard';
import { QACard } from './QACard';
import { ResearchCard } from './ResearchCard';
import { FlashcardCard } from './FlashcardCard';
import { 
  FileText, 
  BookOpen, 
  MessageSquareQuote, 
  Search,
  CreditCard,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedItemData } from '@/services/feedService';

interface FeedItemCardProps {
  item: FeedItemData;
  className?: string;
  onViewDetails?: () => void;
  onTopicClick?: (topicId: number) => void;
}

/**
 * Base feed item card component with topic integration.
 * 
 * Features:
 * - Content-specific rendering based on feed item type
 * - Source attribution with visual badges
 * - Topic context display for research items
 * - Accessible card structure with proper ARIA labels
 * - Responsive design with hover states
 */
export const FeedItemCard: React.FC<FeedItemCardProps> = ({
  item,
  className = "",
  onViewDetails,
  onTopicClick
}) => {
  
  // Get appropriate icon for feed item kind
  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'chunk':
        return <FileText size={16} className="text-neutral-400" />;
      case 'summary':
        return <BookOpen size={16} className="text-blue-400" />;
      case 'qa':
        return <MessageSquareQuote size={16} className="text-green-400" />;
      case 'research':
        return <Search size={16} className="text-purple-400" />;
      case 'flashcard':
        return <CreditCard size={16} className="text-orange-400" />;
      default:
        return <FileText size={16} className="text-neutral-400" />;
    }
  };

  // Format display name for feed item kind
  const getKindDisplayName = (kind: string) => {
    switch (kind) {
      case 'qa':
        return 'Q&A';
      case 'flashcard':
        return 'Flashcard';
      default:
        return kind.charAt(0).toUpperCase() + kind.slice(1);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 168) { // 7 days
      const days = Math.floor(diffInHours / 24);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Render appropriate card content based on item type
  const renderCardContent = () => {
    switch (item.kind) {
      case 'chunk':
        return <ChunkCard item={item} onViewDetails={onViewDetails} />;
      case 'summary':
        return <SummaryCard item={item} onViewDetails={onViewDetails} />;
      case 'qa':
        return <QACard item={item} onViewDetails={onViewDetails} />;
      case 'research':
        return <ResearchCard item={item} onTopicClick={onTopicClick} onViewDetails={onViewDetails} />;
      case 'flashcard':
        return <FlashcardCard item={item} onViewDetails={onViewDetails} />;
      default:
        return (
          <div className="p-4">
            <p className="text-muted-foreground text-sm">
              Unknown content type: {item.kind}
            </p>
          </div>
        );
    }
  };

  return (
    <Card 
      className={cn(
        "feed-item-card transition-all duration-200 hover:shadow-lg hover:border-neutral-600",
        className
      )}
      role="article"
      aria-label={`${getKindDisplayName(item.kind)} content from ${formatDate(item.created_at)}`}
    >
      {/* Header with metadata */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getKindIcon(item.kind)}
            <span className="font-medium text-sm">
              {getKindDisplayName(item.kind)}
            </span>
            
            {/* Source badge */}
            <SourceBadge 
              source={item.source_metadata?.source || 'user_upload'}
              userInitiated={item.source_metadata?.user_initiated || false}
            />
          </div>
          
          <span className="text-xs text-muted-foreground">
            {formatDate(item.created_at)}
          </span>
        </div>

        {/* Topic context display for research items */}
        {item.topic_context && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Target className="text-blue-600 dark:text-blue-400 mt-0.5" size={14} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                  Research Topic: {item.topic_context.topic}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 line-clamp-2">
                  {item.topic_context.context}
                </p>
              </div>
              {onTopicClick && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onTopicClick(item.topic_context!.topic_id)}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs px-2 py-1 h-auto"
                  aria-label={`View details for topic: ${item.topic_context.topic}`}
                >
                  View Topic
                </Button>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      {/* Content */}
      <CardContent className="pt-0">
        {renderCardContent()}
      </CardContent>
    </Card>
  );
};

export default FeedItemCard;