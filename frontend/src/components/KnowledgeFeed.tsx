import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Filter, Search, X } from 'lucide-react';
import { InfiniteScroll } from '@/components/ui/infinite-scroll';
import { FeedItemCard } from './feed/FeedItemCard';
import { LoadingSpinner } from './LoadingSpinner';
import { feedService, FeedItemData, FeedOptions } from '@/services/feedService';
import { cn } from '@/lib/utils';

interface KnowledgeFeedProps {
  userId: string;
  notebookId?: number;
  className?: string;
  showFilters?: boolean;
  initialFilter?: string;
  onTopicClick?: (topicId: number) => void;
}

/**
 * Knowledge Feed Component
 * 
 * A Facebook-style infinite scroll feed for displaying user's knowledge items.
 * Features:
 * - Infinite scroll with cursor-based pagination
 * - Real-time search with debouncing
 * - Content type filtering (chunks, summaries, Q&A, etc.)
 * - Mobile-responsive design
 * - Performance optimization with Intersection Observer
 * - Source attribution and content organization
 */
export const KnowledgeFeed: React.FC<KnowledgeFeedProps> = ({
  userId,
  notebookId,
  className = "",
  showFilters = true,
  initialFilter = "all",
  onTopicClick
}) => {
  const [feedItems, setFeedItems] = useState<FeedItemData[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchPending, setSearchPending] = useState(false);
  const [filter, setFilter] = useState(initialFilter);
  const [filtersVisible, setFiltersVisible] = useState(showFilters);
  const [refreshing, setRefreshing] = useState(false);

  // Debounced search handler
  const handleSearch = useCallback((query: string) => {
    setSearchInput(query);
    setSearchPending(true);
    
    const debounceTimer = setTimeout(() => {
      setSearchQuery(query);
      setSearchPending(false);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, []);

  // Load feed items
  const loadFeedItems = useCallback(async (reset = false) => {
    if (loading && !reset) return;
    
    try {
      setLoading(true);
      setError(null);

      const options: FeedOptions = {
        userId,
        limit: 20,
        cursor: reset ? undefined : nextCursor || undefined,
        filter: filter !== 'all' ? filter : undefined,
        search: searchQuery || undefined,
        notebookId
      };

      const response = await feedService.getFeed(options);
      
      // Enrich feed items with actual content
      const enrichedItems = await Promise.all(
        response.items.map(async (item) => {
          try {
            const contentResponse = await feedService.getFeedItemContent(item.id, userId, true);
            return {
              ...item,
              content: contentResponse.content,
              topic_context: contentResponse.topic_context,
              source_metadata: contentResponse.user_choice_metadata
            };
          } catch (error) {
            console.warn(`Failed to load content for item ${item.id}:`, error);
            // Return item without content rather than failing completely
            return {
              ...item,
              content: null,
              source_metadata: { source: 'user_upload', user_initiated: false }
            };
          }
        })
      );
      
      if (reset) {
        setFeedItems(enrichedItems);
        setInitialLoading(false);
      } else {
        setFeedItems(prev => [...prev, ...enrichedItems]);
      }
      
      setNextCursor(response.next_cursor);
      setHasMore(response.next_cursor !== null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      console.error('Feed loading error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, notebookId, filter, searchQuery, loading, nextCursor]);

  // Initial load and search/filter changes
  useEffect(() => {
    loadFeedItems(true);
  }, [userId, filter, searchQuery, notebookId]);

  // Handle refresh
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await feedService.refreshFeed(userId);
      await loadFeedItems(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh feed');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!loading && hasMore && nextCursor) {
      loadFeedItems(false);
    }
  };

  // Calculate source statistics
  const sourceStats = feedItems.reduce((acc, item) => {
    const source = item.source_metadata?.source || 'user_upload';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasResearchContent = sourceStats.topic_research > 0;

  // Filter options
  const filterOptions = [
    { value: 'all', label: 'All Content', count: feedItems.length },
    { value: 'chunk', label: 'Text Chunks', count: feedItems.filter(i => i.kind === 'chunk').length },
    { value: 'summary', label: 'Summaries', count: feedItems.filter(i => i.kind === 'summary').length },
    { value: 'qa', label: 'Q&A', count: feedItems.filter(i => i.kind === 'qa').length },
    { value: 'research', label: 'Research', count: feedItems.filter(i => i.kind === 'research').length },
    { value: 'flashcard', label: 'Flashcards', count: feedItems.filter(i => i.kind === 'flashcard').length }
  ].filter(option => option.value === 'all' || option.count > 0);

  // Show initial loading screen
  if (initialLoading) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <LoadingSpinner size="lg" text="Loading your knowledge feed..." />
      </div>
    );
  }

  return (
    <div className={cn("knowledge-feed max-w-4xl mx-auto px-4 sm:px-6 lg:px-8", className)} role="main">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">Knowledge Feed</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Browse your personal knowledge base and research results
            </p>
          </div>
          
          {/* Status indicators */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                feedItems.length > 0 ? "bg-green-900/20 text-green-400 border-green-700" : "bg-neutral-800 text-neutral-400 border-neutral-600"
              )}
            >
              {feedItems.length} {feedItems.length === 1 ? 'item' : 'items'}
            </Badge>
            {hasResearchContent && (
              <Badge 
                variant="outline" 
                className="text-xs bg-blue-900/20 text-blue-400 border-blue-700"
              >
                Research Active
              </Badge>
            )}
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw 
                size={14} 
                className={cn("flex-shrink-0", refreshing && "animate-spin")} 
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search 
              size={16} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
              aria-hidden="true"
            />
            <input
              id="search-input"
              type="text"
              placeholder="Search your knowledge..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-neutral-600 dark:bg-neutral-800"
              aria-describedby={searchPending ? "search-status" : undefined}
            />
            {searchPending ? (
              <div 
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                id="search-status"
                aria-live="polite"
              >
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" aria-label="Searching..."></div>
              </div>
            ) : searchInput && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-sm"
                aria-label="Clear search"
                type="button"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <Button
            onClick={() => setFiltersVisible(!filtersVisible)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap"
            aria-expanded={filtersVisible}
            aria-controls="filter-options"
          >
            <Filter size={14} />
            Filters
            {filter !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {filterOptions.find(f => f.value === filter)?.label}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filter Options */}
        {filtersVisible && (
          <div id="filter-options" className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Content filters">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                onClick={() => setFilter(option.value)}
                variant={filter === option.value ? "default" : "outline"}
                size="sm"
                className="text-xs"
                aria-pressed={filter === option.value}
              >
                {option.label}
                <Badge 
                  variant="secondary" 
                  className="ml-1 text-xs"
                >
                  {option.count}
                </Badge>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
          <Button
            onClick={() => loadFeedItems(true)}
            variant="outline"
            size="sm"
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Feed Content */}
      <InfiniteScroll
        items={feedItems}
        loading={loading && !initialLoading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        renderItem={(item) => (
          <FeedItemCard 
            key={`${item.kind}-${item.id}`} 
            item={item} 
            onViewDetails={() => {
              // Handle item click - could expand content or navigate
              console.log('Feed item clicked:', item);
            }}
            onTopicClick={onTopicClick}
          />
        )}
        emptyMessage="No knowledge items yet. Upload content or start researching to see items here."
        loadingMessage="Loading more knowledge..."
        className="space-y-4"
      />
    </div>
  );
};

export default KnowledgeFeed;