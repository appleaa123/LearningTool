/**
 * Performance Monitoring Utility - Phase 3
 * 
 * Tracks API response times, cache hit rates, and user experience metrics
 * for validating optimization effectiveness.
 */

import { featureFlags } from './featureFlags';
import { apiCache } from './apiCache';

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface APIMetric extends PerformanceMetric {
  endpoint: string;
  method: string;
  cacheHit: boolean;
  responseTime: number;
}

export interface CacheMetric extends PerformanceMetric {
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private apiMetrics: APIMetric[] = [];
  private readonly MAX_METRICS = 1000;
  
  // API performance tracking
  private requestStartTimes = new Map<string, number>();
  private totalRequests = 0;
  private cacheHits = 0;

  /**
   * Start tracking an API request
   */
  startAPIRequest(requestId: string, endpoint: string, method = 'GET'): void {
    if (!featureFlags.isEnabled('enablePerformanceMonitoring')) return;
    
    this.requestStartTimes.set(requestId, performance.now());
    this.totalRequests++;
    
    if (featureFlags.isEnabled('enableDebugMode')) {
      console.log(`[Performance] Started tracking: ${method} ${endpoint}`);
    }
  }

  /**
   * End tracking an API request
   */
  endAPIRequest(
    requestId: string, 
    endpoint: string, 
    method = 'GET',
    cacheHit = false
  ): void {
    if (!featureFlags.isEnabled('enablePerformanceMonitoring')) return;
    
    const startTime = this.requestStartTimes.get(requestId);
    if (!startTime) return;
    
    const responseTime = performance.now() - startTime;
    this.requestStartTimes.delete(requestId);
    
    if (cacheHit) {
      this.cacheHits++;
    }
    
    const metric: APIMetric = {
      name: 'api_request',
      value: responseTime,
      timestamp: Date.now(),
      endpoint,
      method,
      cacheHit,
      responseTime,
      metadata: {
        endpoint,
        method,
        cacheHit
      }
    };
    
    this.apiMetrics.push(metric);
    this.metrics.push(metric);
    
    // Limit stored metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }
    
    if (this.apiMetrics.length > this.MAX_METRICS) {
      this.apiMetrics.shift();
    }
    
    if (featureFlags.isEnabled('enableDebugMode')) {
      console.log(
        `[Performance] ${method} ${endpoint}: ${responseTime.toFixed(2)}ms ${cacheHit ? '(cached)' : '(network)'}`
      );
    }
  }

  /**
   * Record a custom performance metric
   */
  recordMetric(name: string, value: number, metadata?: Record<string, unknown>): void {
    if (!featureFlags.isEnabled('enablePerformanceMonitoring')) return;
    
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };
    
    this.metrics.push(metric);
    
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }
    
    if (featureFlags.isEnabled('enableDebugMode')) {
      console.log(`[Performance] ${name}: ${value}`);
    }
  }

  /**
   * Get cache performance statistics
   */
  getCacheStats(): CacheMetric {
    const cacheStats = apiCache.getStats();
    const hitRate = this.totalRequests > 0 ? this.cacheHits / this.totalRequests : 0;
    
    return {
      name: 'cache_performance',
      value: hitRate,
      timestamp: Date.now(),
      hitRate,
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.totalRequests - this.cacheHits,
      metadata: {
        ...cacheStats,
        totalRequests: this.totalRequests,
        cacheHits: this.cacheHits
      }
    };
  }

  /**
   * Get API performance summary
   */
  getAPIStats(timeRange?: number): {
    averageResponseTime: number;
    cacheHitRate: number;
    requestCount: number;
    slowestEndpoints: { endpoint: string; averageTime: number }[];
  } {
    const cutoff = timeRange ? Date.now() - timeRange : 0;
    const recentMetrics = this.apiMetrics.filter(m => m.timestamp > cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        cacheHitRate: 0,
        requestCount: 0,
        slowestEndpoints: []
      };
    }
    
    const totalTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0);
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    
    // Group by endpoint for performance analysis
    const endpointStats = new Map<string, { totalTime: number; count: number }>();
    
    recentMetrics.forEach(metric => {
      const stats = endpointStats.get(metric.endpoint) || { totalTime: 0, count: 0 };
      stats.totalTime += metric.responseTime;
      stats.count += 1;
      endpointStats.set(metric.endpoint, stats);
    });
    
    const slowestEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.totalTime / stats.count
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 5);
    
    return {
      averageResponseTime: totalTime / recentMetrics.length,
      cacheHitRate: cacheHits / recentMetrics.length,
      requestCount: recentMetrics.length,
      slowestEndpoints
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: ReturnType<PerformanceMonitor['getAPIStats']>;
    cache: CacheMetric;
    recommendations: string[];
  } {
    const apiStats = this.getAPIStats(10 * 60 * 1000); // Last 10 minutes
    const cacheStats = this.getCacheStats();
    const recommendations: string[] = [];
    
    // Generate recommendations based on metrics
    if (apiStats.cacheHitRate < 0.3) {
      recommendations.push('Low cache hit rate. Consider increasing cache TTL or improving cache key strategies.');
    }
    
    if (apiStats.averageResponseTime > 1000) {
      recommendations.push('High average response time. Consider optimizing slow endpoints or implementing additional caching.');
    }
    
    if (cacheStats.totalRequests > 100 && cacheStats.hitRate < 0.4) {
      recommendations.push('Cache effectiveness is low. Review caching patterns and consider preloading strategies.');
    }
    
    apiStats.slowestEndpoints.forEach(endpoint => {
      if (endpoint.averageTime > 2000) {
        recommendations.push(`Endpoint ${endpoint.endpoint} is slow (${endpoint.averageTime.toFixed(0)}ms average). Consider optimization.`);
      }
    });
    
    return {
      summary: apiStats,
      cache: cacheStats,
      recommendations
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.apiMetrics = [];
    this.requestStartTimes.clear();
    this.totalRequests = 0;
    this.cacheHits = 0;
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): {
    timestamp: number;
    metrics: PerformanceMetric[];
    apiMetrics: APIMetric[];
    summary: ReturnType<PerformanceMonitor['getAPIStats']>;
  } {
    return {
      timestamp: Date.now(),
      metrics: [...this.metrics],
      apiMetrics: [...this.apiMetrics],
      summary: this.getAPIStats()
    };
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Helper function to wrap API calls with performance tracking
export function withPerformanceTracking<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  endpoint: string,
  method = 'GET'
): T {
  return (async (...args: Parameters<T>) => {
    const requestId = `${method}-${endpoint}-${Date.now()}-${Math.random()}`;
    
    performanceMonitor.startAPIRequest(requestId, endpoint, method);
    
    try {
      const result = await fn(...args);
      performanceMonitor.endAPIRequest(requestId, endpoint, method, false);
      return result;
    } catch (error) {
      performanceMonitor.endAPIRequest(requestId, endpoint, method, false);
      throw error;
    }
  }) as T;
}

// Auto-logging performance report in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  setInterval(() => {
    if (featureFlags.isEnabled('enablePerformanceMonitoring') && featureFlags.isEnabled('enableDebugMode')) {
      const report = performanceMonitor.generateReport();
      if (report.summary.requestCount > 0) {
        console.group('🚀 Performance Report');
        console.log('API Performance:', report.summary);
        console.log('Cache Performance:', report.cache);
        if (report.recommendations.length > 0) {
          console.log('Recommendations:', report.recommendations);
        }
        console.groupEnd();
      }
    }
  }, 30000); // Every 30 seconds
}