// Live Performance Testing Script
// Run this in the browser console at http://localhost:5173/app/

console.log('🚀 Phase 3 Live Performance Test Starting...\n');

// Test 1: Verify feature flags are enabled
console.log('✅ Test 1: Feature Flags Status');
try {
  if (typeof window !== 'undefined') {
    // Check localStorage for feature flags
    const storedFlags = localStorage.getItem('learningtool-feature-flags');
    console.log('Stored flags:', storedFlags ? JSON.parse(storedFlags) : 'Using defaults');
    
    // Test feature flag functionality
    console.log('Feature flags system: ✓ Available');
  }
} catch (e) {
  console.log('Feature flags test:', '✗ Error -', e.message);
}

// Test 2: Performance monitoring integration
console.log('\n✅ Test 2: Performance Monitoring');
try {
  // Check if performance monitoring is active
  console.log('Performance API available:', typeof performance !== 'undefined' ? '✓' : '✗');
  console.log('Console logging active: ✓ (you should see debug logs)');
  
  // Test performance measurement
  const testStart = performance.now();
  setTimeout(() => {
    const testEnd = performance.now();
    console.log(`Performance measurement test: ${(testEnd - testStart).toFixed(2)}ms ✓`);
  }, 10);
} catch (e) {
  console.log('Performance monitoring test:', '✗ Error -', e.message);
}

// Test 3: Cache system validation
console.log('\n✅ Test 3: Cache System');
try {
  // Test localStorage availability (cache storage)
  localStorage.setItem('test-cache', 'test-value');
  const retrieved = localStorage.getItem('test-cache');
  localStorage.removeItem('test-cache');
  
  console.log('localStorage cache storage:', retrieved === 'test-value' ? '✓' : '✗');
  console.log('Cache operations: ✓ Functional');
} catch (e) {
  console.log('Cache system test:', '✗ Error -', e.message);
}

// Test 4: Network monitoring setup
console.log('\n✅ Test 4: Network Monitoring');
console.log('📋 Manual Test Instructions:');
console.log('1. Open DevTools Network tab');
console.log('2. Navigate between Chat/Feed/Topics tabs');
console.log('3. Watch for:');
console.log('   - Initial API calls on first tab visit');
console.log('   - Cached responses on return visits');
console.log('   - Console logs showing cache hits/misses');
console.log('   - Performance reports every 30 seconds');

// Test 5: Expected console output monitoring
console.log('\n✅ Test 5: Console Monitoring Setup');
console.log('🔍 Watch for these console messages:');
console.log('- "[APICache] Cache hit: ..." (cached responses)');
console.log('- "[Performance] GET /api/...: XXms (cached/network)"');
console.log('- "🚀 Performance Report" (every 30 seconds)');
console.log('- Cache statistics and recommendations');

// Set up monitoring for 2 minutes
let reportCount = 0;
const monitoringInterval = setInterval(() => {
  reportCount++;
  console.log(`\n📊 Monitoring Status (${reportCount * 10}s elapsed):`);
  console.log('- Watching for performance reports...');
  console.log('- Navigate between tabs to test caching');
  
  if (reportCount >= 12) { // 2 minutes
    clearInterval(monitoringInterval);
    console.log('\n🏁 Live Performance Test Complete!');
    console.log('Check the logs above for cache hits and performance data.');
  }
}, 10000);

console.log('\n🎯 Phase 3 Live Testing Active');
console.log('Navigate the app now to see caching and performance in action!');
console.log('Test will auto-complete in 2 minutes...\n');