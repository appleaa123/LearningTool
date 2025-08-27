import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Filter, Search, X } from 'lucide-react';
import { InfiniteScroll } from '@/components/ui/infinite-scroll';
import { FeedItemCard } from './feed/FeedItemCard';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorBoundary } from './ErrorBoundary';
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
 * KnowledgeFeed is the main container for the Facebook-style knowledge browser.
 * 
 * Features:
 * - Infinite scroll with cursor-based pagination
 * - Real-time search and filtering
 * - Topic context integration
 * - Responsive design with mobile support
 * - Error boundaries and loading states
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
  // Core feed state
  const [feedItems, setFeedItems] = useState<FeedItemData[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Filter and search state
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersVisible, setFiltersVisible] = useState(showFilters);
  
  // Load feed items with enhanced error handling and topic context
  const loadFeedItems = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    if (reset) {
      setError(null);
    }
    
    try {
      const options: FeedOptions = {
        userId,
        notebookId,
        cursor: reset ? 0 : cursor,
        limit: 20,
        filter: activeFilter !== 'all' ? activeFilter : undefined,
        search: searchQuery || undefined
      };
      
      const response = await feedService.getFeed(options);
      
      // Fetch content for each item with topic context
      const enrichedItems = await Promise.all(
        response.items.map(async (item) => {
          try {
            const contentResponse = await feedService.getFeedItemContent(
              item.id, 
              userId, 
              true // include topic context
            );
            
            return {
              ...item,
              content: contentResponse.content,
              topic_context: contentResponse.topic_context,
              source_metadata: contentResponse.user_choice_metadata
            } as FeedItemData;
          } catch (err) {
            console.warn(`Failed to load content for item ${item.id}:`, err);
            return {
              ...item,
              content: null,
              topic_context: undefined,
              source_metadata: { source: 'user_upload', user_initiated: false }
            } as FeedItemData;
          }
        })
      );

      setFeedItems(prev => reset ? enrichedItems : [...prev, ...enrichedItems]);
      setCursor(response.next_cursor || 0);
      setHasMore(!!response.next_cursor);
      
      if (reset && enrichedItems.length === 0 && searchQuery) {
        setError(`No results found for "${searchQuery}"`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load feed';
      setError(errorMessage);
      console.error('Feed loading error:', err);
    } finally {
      setLoading(false);
      if (initialLoading) {
        setInitialLoading(false);
      }
    }
  }, [userId, notebookId, cursor, activeFilter, searchQuery, loading, initialLoading]);

  // Reset and reload when filters change
  useEffect(() => {
    setFeedItems([]);
    setCursor(0);
    setHasMore(true);
    loadFeedItems(true);
  }, [activeFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    loadFeedItems(true);
  }, [userId, notebookId]);

  // Handle load more for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadFeedItems(false);
    }
  }, [hasMore, loading, loadFeedItems]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setFeedItems([]);
    setCursor(0);
    setHasMore(true);
    setError(null);
    await loadFeedItems(true);
  }, [loadFeedItems]);

  // Handle search with debouncing
  const [searchInput, setSearchInput] = useState("");
  const [searchPending, setSearchPending] = useState(false);
  
  // Debounced search effect
  useEffect(() => {
    if (searchInput !== searchQuery) {
      setSearchPending(true);
    }
    
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setSearchPending(false);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [searchInput, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchInput(query);
  }, []);

  // Count items by source for header stats
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
    <ErrorBoundary>
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
                  hasResearchContent ? "border-blue-500 text-blue-700" : "border-gray-300"
                )}
              >
                <div className={cn(
                  "w-2 h-2 rounded-full mr-1",
                  hasResearchContent ? "bg-blue-500" : "bg-gray-400"
                )} />
                {hasResearchContent ? 'Mixed Content Feed' : 'Local Content Only'}
              </Badge>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
                aria-label={loading ? "Refreshing feed..." : "Refresh feed"}
              >
                <RefreshCw size={16} className={cn(loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Stats */}
          {feedItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-4">
              <span>{feedItems.length} total items</span>
              {sourceStats.user_upload && (
                <span className="hidden sm:inline">{sourceStats.user_upload} uploaded</span>
              )}
              {sourceStats.topic_research && (
                <span className="hidden sm:inline">{sourceStats.topic_research} researched</span>
              )}
            </div>
          )}

          {/* Filters and Search */}
          <div className="space-y-4">
            {/* Filter toggle */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersVisible(!filtersVisible)}
                className="text-xs"
                aria-expanded={filtersVisible}
                aria-controls="filter-controls"
                aria-label={`${filtersVisible ? 'Hide' : 'Show'} filter controls`}
              >
                <Filter size={14} className="mr-1" />
                {filtersVisible ? 'Hide' : 'Show'} Filters
              </Button>
            </div>

            {filtersVisible && (
              <div id="filter-controls">
                {/* Filter buttons */}
              <div 
                className="flex flex-wrap gap-1 sm:gap-2" 
                role="radiogroup" 
                aria-label="Filter content by type"
              >
                {filterOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={activeFilter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter(option.value)}
                    className="text-xs flex-shrink-0"
                    role="radio"
                    aria-checked={activeFilter === option.value}
                    aria-label={`Filter by ${option.label} (${option.count} items)`}
                  >
                    <span className="hidden sm:inline">{option.label}</span>
                    <span className="sm:hidden">{option.label.split(' ')[0]}</span>
                    {option.count > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="ml-1 text-xs px-1 py-0 hidden sm:inline-flex"
                      >
                        {option.count}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <label htmlFor="search-input" className="sr-only">
                  Search your knowledge base
                </label>
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
              </>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div 
            className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="mt-2 text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-describedby="error-message"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Feed content */}
        <InfiniteScroll
          items={feedItems}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          renderItem={(item) => (
            <FeedItemCard
              key={item.id}
              item={item}
              onTopicClick={onTopicClick}
              className="mb-4"
            />
          )}
          emptyMessage="No knowledge items yet. Upload content or start researching to see items here."
          loadingMessage="Loading more knowledge..."
          className="space-y-4"
        />
      </div>
    </ErrorBoundary>
  );
};

export default KnowledgeFeed;