/**
 * Feature Flag System for Performance Optimization Rollout
 * 
 * Provides safe, gradual enablement of performance optimizations
 * following ASGI compliance and tech debt avoidance patterns.
 */

export interface FeatureFlags {
  // Bundle Size Optimization flags
  enableLazyLoading: boolean;
  enableCodeSplitting: boolean;
  enableDynamicImports: boolean;
  
  // Caching & Performance flags  
  enableApiCaching: boolean;
  enableOptimisticUI: boolean;
  enableServiceWorker: boolean;
  
  // Development & Testing flags
  enablePerformanceMonitoring: boolean;
  enableDebugMode: boolean;
}

// Default feature flag configuration (Phase 2: Enable bundle optimizations)
const DEFAULT_FLAGS: FeatureFlags = {
  // Bundle optimization - enabled for Phase 2
  enableLazyLoading: true,
  enableCodeSplitting: true, 
  enableDynamicImports: true,
  
  // Performance features - enabled for Phase 3
  enableApiCaching: true,
  enableOptimisticUI: true,
  enableServiceWorker: false, // Defer to later phase
  
  // Development features - enabled for monitoring
  enablePerformanceMonitoring: true,
  enableDebugMode: import.meta.env.DEV,
};

class FeatureFlagManager {
  private flags: FeatureFlags;
  
  constructor() {
    this.flags = { ...DEFAULT_FLAGS };
    this.loadFromLocalStorage();
  }
  
  /**
   * Get current state of a specific feature flag
   */
  isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag];
  }
  
  /**
   * Get all feature flags (for admin/debug interfaces)
   */
  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }
  
  /**
   * Enable a specific feature flag with optional persistence
   */
  enable(flag: keyof FeatureFlags, persist = false): void {
    this.flags[flag] = true;
    if (persist) {
      this.saveToLocalStorage();
    }
    
    if (this.flags.enableDebugMode) {
      console.log(`[FeatureFlags] Enabled: ${flag}`);
    }
  }
  
  /**
   * Disable a specific feature flag with optional persistence  
   */
  disable(flag: keyof FeatureFlags, persist = false): void {
    this.flags[flag] = false;
    if (persist) {
      this.saveToLocalStorage();
    }
    
    if (this.flags.enableDebugMode) {
      console.log(`[FeatureFlags] Disabled: ${flag}`);
    }
  }
  
  /**
   * Bulk update multiple flags (for phased rollouts)
   */
  updateFlags(updates: Partial<FeatureFlags>, persist = false): void {
    Object.assign(this.flags, updates);
    if (persist) {
      this.saveToLocalStorage();
    }
    
    if (this.flags.enableDebugMode) {
      console.log('[FeatureFlags] Bulk update:', updates);
    }
  }
  
  /**
   * Reset all flags to defaults (safety mechanism)
   */
  resetToDefaults(): void {
    this.flags = { ...DEFAULT_FLAGS };
    localStorage.removeItem('learningtool-feature-flags');
    console.log('[FeatureFlags] Reset to defaults');
  }
  
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('learningtool-feature-flags');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new flags
        this.flags = { ...DEFAULT_FLAGS, ...parsed };
      }
    } catch (error) {
      console.warn('[FeatureFlags] Failed to load from localStorage:', error);
    }
  }
  
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('learningtool-feature-flags', JSON.stringify(this.flags));
    } catch (error) {
      console.warn('[FeatureFlags] Failed to save to localStorage:', error);
    }
  }
}

// Singleton instance for global access
export const featureFlags = new FeatureFlagManager();

// Helper hook for React components
export const useFeatureFlag = (flag: keyof FeatureFlags): boolean => {
  return featureFlags.isEnabled(flag);
};

// Performance monitoring utilities
export const withFeatureFlag = <T extends (...args: never[]) => unknown>(
  flag: keyof FeatureFlags,
  enabledFn: T,
  fallbackFn?: T
): T => {
  return ((...args: Parameters<T>) => {
    if (featureFlags.isEnabled(flag)) {
      return enabledFn(...args);
    }
    return fallbackFn ? fallbackFn(...args) : undefined;
  }) as T;
};