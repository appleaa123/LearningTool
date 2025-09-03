/**
 * Optimistic UI Hook - Phase 3
 * 
 * Provides optimistic state management for API operations,
 * allowing immediate UI updates with rollback on error.
 */

import { useState, useCallback, useRef } from 'react';
import { featureFlags } from '@/utils/featureFlags';

export interface OptimisticOptions<T> {
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
  rollbackDelay?: number; // Delay before rolling back on error
}

export interface OptimisticState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  isOptimistic: boolean; // True if showing optimistic update
}

/**
 * Hook for managing optimistic UI updates
 * 
 * @param initialData - Initial data state
 * @returns Optimistic state management functions
 */
export function useOptimisticState<T>(initialData: T) {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    loading: false,
    error: null,
    isOptimistic: false
  });

  const rollbackTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const originalDataRef = useRef<T>(initialData);

  /**
   * Execute an async operation with optimistic updates
   */
  const executeOptimistic = useCallback(async <R>(
    operation: () => Promise<R>,
    optimisticUpdate: (current: T) => T,
    options: OptimisticOptions<R> = {}
  ): Promise<R | null> => {
    
    // Clear any pending rollback
    if (rollbackTimeoutRef.current) {
      clearTimeout(rollbackTimeoutRef.current);
    }

    // Store original data for potential rollback
    originalDataRef.current = state.data;

    // Apply optimistic update if feature is enabled
    if (featureFlags.isEnabled('enableOptimisticUI')) {
      const optimisticData = optimisticUpdate(state.data);
      setState(prev => ({
        ...prev,
        data: optimisticData,
        loading: true,
        error: null,
        isOptimistic: true
      }));

      if (featureFlags.isEnabled('enableDebugMode')) {
        console.log('[OptimisticUI] Applied optimistic update');
      }
    } else {
      // Fallback to standard loading state
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
        isOptimistic: false
      }));
    }

    try {
      // Execute the actual operation
      const result = await operation();

      // On success, confirm the optimistic update or update with real data
      setState(prev => ({
        ...prev,
        loading: false,
        error: null,
        isOptimistic: false
      }));

      options.onSuccess?.(result);
      
      if (featureFlags.isEnabled('enableDebugMode')) {
        console.log('[OptimisticUI] Operation succeeded');
      }

      return result;

    } catch (error) {
      const err = error as Error;
      
      if (featureFlags.isEnabled('enableOptimisticUI')) {
        // Show error but keep optimistic data briefly, then rollback
        setState(prev => ({
          ...prev,
          loading: false,
          error: err,
          isOptimistic: true // Still optimistic, showing error
        }));

        // Schedule rollback
        const delay = options.rollbackDelay || 2000;
        rollbackTimeoutRef.current = setTimeout(() => {
          setState(prev => ({
            ...prev,
            data: originalDataRef.current,
            error: err,
            isOptimistic: false
          }));
          
          if (featureFlags.isEnabled('enableDebugMode')) {
            console.log('[OptimisticUI] Rolled back optimistic update');
          }
        }, delay);
      } else {
        // Standard error handling
        setState(prev => ({
          ...prev,
          data: originalDataRef.current,
          loading: false,
          error: err,
          isOptimistic: false
        }));
      }

      options.onError?.(err);
      
      if (featureFlags.isEnabled('enableDebugMode')) {
        console.log('[OptimisticUI] Operation failed:', err.message);
      }

      return null;
    }
  }, [state.data]);

  /**
   * Update data directly (non-optimistic)
   */
  const updateData = useCallback((newData: T) => {
    setState(prev => ({
      ...prev,
      data: newData,
      loading: false,
      error: null,
      isOptimistic: false
    }));
    originalDataRef.current = newData;
  }, []);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    if (rollbackTimeoutRef.current) {
      clearTimeout(rollbackTimeoutRef.current);
    }
    
    setState({
      data: initialData,
      loading: false,
      error: null,
      isOptimistic: false
    });
    originalDataRef.current = initialData;
  }, [initialData]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  return {
    ...state,
    executeOptimistic,
    updateData,
    reset,
    clearError
  };
}

/**
 * Specialized hook for list operations (add, remove, update items)
 */
export function useOptimisticList<T extends { id: string | number }>(initialItems: T[] = []) {
  const optimistic = useOptimisticState<T[]>(initialItems);

  const addItem = useCallback(async (
    item: T,
    operation: () => Promise<T>,
    options?: OptimisticOptions<T>
  ) => {
    return optimistic.executeOptimistic(
      operation,
      (currentItems) => [...currentItems, item],
      options
    );
  }, [optimistic]);

  const removeItem = useCallback(async (
    id: string | number,
    operation: () => Promise<void>,
    options?: OptimisticOptions<void>
  ) => {
    return optimistic.executeOptimistic(
      operation,
      (currentItems) => currentItems.filter(item => item.id !== id),
      options
    );
  }, [optimistic]);

  const updateItem = useCallback(async (
    id: string | number,
    updates: Partial<T>,
    operation: () => Promise<T>,
    options?: OptimisticOptions<T>
  ) => {
    return optimistic.executeOptimistic(
      operation,
      (currentItems) => currentItems.map(item => 
        item.id === id ? { ...item, ...updates } : item
      ),
      options
    );
  }, [optimistic]);

  return {
    ...optimistic,
    items: optimistic.data,
    addItem,
    removeItem,
    updateItem
  };
}