import React, { useEffect, useRef, useCallback } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

interface InfiniteScrollProps<T> {
  items: T[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  loadingMessage?: string;
  className?: string;
  loadingThreshold?: number; // Distance from bottom to trigger loading (in pixels)
}

/**
 * InfiniteScroll component with Intersection Observer for optimal performance.
 * 
 * Features:
 * - Uses Intersection Observer API for efficient scroll detection
 * - Configurable loading threshold for smooth UX
 * - Memory-efficient rendering for large datasets
 * - Accessible loading states and empty states
 */
export function InfiniteScroll<T>({
  items,
  loading,
  hasMore,
  onLoadMore,
  renderItem,
  emptyMessage = "No items to display",
  loadingMessage = "Loading...",
  className,
  loadingThreshold = 200,
}: InfiniteScrollProps<T>) {
  const loadingTriggerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Intersection Observer callback
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      
      // Only trigger load more if:
      // 1. The loading trigger is visible
      // 2. We're not already loading
      // 3. There are more items to load
      if (entry.isIntersecting && !loading && hasMore) {
        onLoadMore();
      }
    },
    [loading, hasMore, onLoadMore]
  );

  // Set up Intersection Observer
  useEffect(() => {
    const trigger = loadingTriggerRef.current;
    if (!trigger) return;

    // Create observer with threshold-based root margin
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null, // Use viewport as root
      rootMargin: `0px 0px ${loadingThreshold}px 0px`, // Trigger before reaching bottom
      threshold: 0, // Trigger as soon as any part is visible
    });

    observerRef.current.observe(trigger);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, loadingThreshold]);

  // Empty state
  if (items.length === 0 && !loading) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <div className="text-center">
          <p className="text-muted-foreground text-lg font-medium mb-2">
            No Content Yet
          </p>
          <p className="text-muted-foreground text-sm max-w-md">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} role="feed" aria-live="polite">
      {/* Render all items */}
      {items.map((item, index) => (
        <div key={index} role="article">
          {renderItem(item, index)}
        </div>
      ))}

      {/* Loading trigger - invisible but observed by Intersection Observer */}
      <div
        ref={loadingTriggerRef}
        className="h-1 w-full"
        aria-hidden="true"
      />

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-8" role="status" aria-label="Loading more content">
          <LoadingSpinner 
            size="md" 
            text={loadingMessage}
            className="text-muted-foreground"
          />
        </div>
      )}

      {/* End of content indicator */}
      {!hasMore && items.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              You've reached the end of your knowledge feed
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default InfiniteScroll;