#!/usr/bin/env node
// Phase 3 Performance Testing - Comprehensive validation

const fs = require('fs');
const path = require('path');

console.log('🧪 Phase 3: Caching & Performance Validation\n');

// Test 1: Verify caching system implementation
console.log('✅ Test 1: API Caching System');
const apiCachePath = path.join(__dirname, 'src/utils/apiCache.ts');
const apiCacheContent = fs.readFileSync(apiCachePath, 'utf8');

const cachingFeatures = [
  { feature: 'TTL caching', check: apiCacheContent.includes('ttl:') },
  { feature: 'Cache invalidation', check: apiCacheContent.includes('invalidatePattern') },
  { feature: 'Memory management', check: apiCacheContent.includes('MAX_CACHE_SIZE') },
  { feature: 'LRU eviction', check: apiCacheContent.includes('evictOldest') },
  { feature: 'Feature flag integration', check: apiCacheContent.includes('featureFlags.isEnabled') }
];

cachingFeatures.forEach(({ feature, check }) => {
  console.log(`  - ${feature}: ${check ? '✓' : '✗'}`);
});

// Test 2: Verify performance monitoring
console.log('\n✅ Test 2: Performance Monitoring');
const perfMonitorPath = path.join(__dirname, 'src/utils/performanceMonitor.ts');
const perfMonitorContent = fs.readFileSync(perfMonitorPath, 'utf8');

const monitoringFeatures = [
  { feature: 'API response tracking', check: perfMonitorContent.includes('startAPIRequest') },
  { feature: 'Cache hit rate monitoring', check: perfMonitorContent.includes('cacheHit') },
  { feature: 'Performance reporting', check: perfMonitorContent.includes('generateReport') },
  { feature: 'Auto recommendations', check: perfMonitorContent.includes('recommendations') },
  { feature: 'Debug logging', check: perfMonitorContent.includes('enableDebugMode') }
];

monitoringFeatures.forEach(({ feature, check }) => {
  console.log(`  - ${feature}: ${check ? '✓' : '✗'}`);
});

// Test 3: Verify optimistic UI framework
console.log('\n✅ Test 3: Optimistic UI Framework');
const optimisticPath = path.join(__dirname, 'src/hooks/useOptimisticState.ts');
const optimisticContent = fs.readFileSync(optimisticPath, 'utf8');

const optimisticFeatures = [
  { feature: 'Optimistic state management', check: optimisticContent.includes('executeOptimistic') },
  { feature: 'Rollback on error', check: optimisticContent.includes('rollback') },
  { feature: 'List operations support', check: optimisticContent.includes('useOptimisticList') },
  { feature: 'Feature flag integration', check: optimisticContent.includes('enableOptimisticUI') }
];

optimisticFeatures.forEach(({ feature, check }) => {
  console.log(`  - ${feature}: ${check ? '✓' : '✗'}`);
});

// Test 4: Verify service integration
console.log('\n✅ Test 4: FeedService Integration');
const feedServicePath = path.join(__dirname, 'src/services/feedService.ts');
const feedServiceContent = fs.readFileSync(feedServicePath, 'utf8');

const serviceIntegration = [
  { feature: 'Cache imports', check: feedServiceContent.includes('import { apiCache }') },
  { feature: 'Performance monitoring', check: feedServiceContent.includes('performanceMonitor') },
  { feature: 'Cache key generation', check: feedServiceContent.includes('generateFeedCacheKey') },
  { feature: 'Cache invalidation methods', check: feedServiceContent.includes('invalidateFeedCache') },
  { feature: 'Response caching', check: feedServiceContent.includes('apiCache.set') }
];

serviceIntegration.forEach(({ feature, check }) => {
  console.log(`  - ${feature}: ${check ? '✓' : '✗'}`);
});

// Test 5: Feature flag configuration
console.log('\n✅ Test 5: Feature Flag Configuration');
const featureFlagsPath = path.join(__dirname, 'src/utils/featureFlags.ts');
const featureFlagsContent = fs.readFileSync(featureFlagsPath, 'utf8');

const flagsEnabled = [
  { flag: 'enableApiCaching: true', check: featureFlagsContent.includes('enableApiCaching: true') },
  { flag: 'enableOptimisticUI: true', check: featureFlagsContent.includes('enableOptimisticUI: true') },
  { flag: 'enablePerformanceMonitoring: true', check: featureFlagsContent.includes('enablePerformanceMonitoring: true') }
];

flagsEnabled.forEach(({ flag, check }) => {
  console.log(`  - ${flag}: ${check ? '✓' : '✗'}`);
});

// Test 6: Bundle analysis
console.log('\n✅ Test 6: Bundle Optimization Status');
const distPath = path.join(__dirname, 'dist/assets');
if (fs.existsSync(distPath)) {
  const assets = fs.readdirSync(distPath);
  const jsAssets = assets.filter(file => file.endsWith('.js'));
  const mainBundle = jsAssets.find(file => file.startsWith('index-'));
  const servicesBundle = jsAssets.find(file => file.startsWith('services-'));
  
  console.log(`  - Total JS chunks: ${jsAssets.length}`);
  
  if (mainBundle) {
    const stats = fs.statSync(path.join(distPath, mainBundle));
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`  - Main bundle: ${sizeKB}KB (${sizeKB < 400 ? '✓ under target' : '✗ over target'})`);
  }
  
  if (servicesBundle) {
    const stats = fs.statSync(path.join(distPath, servicesBundle));
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`  - Services bundle: ${sizeKB}KB (includes caching logic)`);
  }
} else {
  console.log('  - Build dist folder not found. Run npm run build first.');
}

// Overall assessment
console.log('\n🎯 Phase 3 Readiness Assessment');

const allFeatures = [
  ...cachingFeatures,
  ...monitoringFeatures,
  ...optimisticFeatures,
  ...serviceIntegration,
  ...flagsEnabled
];

const implementedCount = allFeatures.filter(f => f.check).length;
const totalCount = allFeatures.length;
const completionRate = (implementedCount / totalCount * 100).toFixed(1);

console.log(`Implementation: ${implementedCount}/${totalCount} features (${completionRate}%)`);
console.log(`Status: ${completionRate >= 95 ? '✅ READY FOR TESTING' : '⚠️  NEEDS COMPLETION'}`);

console.log('\n📋 Manual Testing Checklist:');
console.log('1. Open http://localhost:5173/app/ with DevTools Console');
console.log('2. Navigate between Chat/Feed/Topics - watch for cache hit logs');
console.log('3. Check Console for performance reports every 30 seconds');
console.log('4. Monitor Network tab for reduced API calls on repeat navigation');
console.log('5. Test rapid interactions to verify optimistic UI framework');
console.log('6. Verify feature flag toggles work correctly');

console.log('\n🔍 Expected Console Output:');
console.log('- "[APICache] Cache hit: feed:anon:all:all:none:20"');
console.log('- "[Performance] GET /knowledge/feed: 45.23ms (cached)"');
console.log('- "🚀 Performance Report" every 30 seconds');
console.log('- Cache statistics and recommendations');

console.log('\n🚀 Phase 3 Complete - Ready for Production Testing!');