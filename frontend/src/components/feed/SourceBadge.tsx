import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Upload, Search, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourceBadgeProps {
  source: 'user_upload' | 'topic_research';
  userInitiated?: boolean;
  className?: string;
}

/**
 * SourceBadge component displays the origin of knowledge content.
 * 
 * Features:
 * - Clear visual distinction between uploaded and researched content
 * - User-initiated research vs automatic suggestions
 * - Accessible with proper ARIA labels
 * - Consistent with design system
 */
export const SourceBadge: React.FC<SourceBadgeProps> = ({ 
  source, 
  userInitiated = false, 
  className 
}) => {
  if (source === 'user_upload') {
    return (
      <Badge 
        variant="secondary" 
        className={cn("text-xs flex items-center gap-1", className)}
        aria-label="Content uploaded by user"
      >
        <Upload size={10} />
        Uploaded
      </Badge>
    );
  }

  return (
    <Badge 
      variant="default" 
      className={cn(
        "text-xs flex items-center gap-1",
        userInitiated 
          ? "bg-blue-600 hover:bg-blue-700 border-blue-500" 
          : "bg-purple-600 hover:bg-purple-700 border-purple-500",
        className
      )}
      aria-label={userInitiated ? "Research initiated by user" : "Automatic research suggestion"}
    >
      {userInitiated ? <Target size={10} /> : <Search size={10} />}
      {userInitiated ? 'You Researched' : 'Auto Research'}
    </Badge>
  );
};

export default SourceBadge;