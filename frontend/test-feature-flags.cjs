#!/usr/bin/env node
// Quick test script to verify feature flags work correctly

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Phase 2 Code Splitting Implementation...\n');

// Test 1: Verify lazy loading imports exist in App.tsx
const appPath = path.join(__dirname, 'src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');

console.log('✅ Test 1: Lazy Loading Implementation');
const hasLazyImports = appContent.includes('lazy(() =>');
const hasSuspense = appContent.includes('<Suspense');
const hasFeatureFlags = appContent.includes('featureFlags');

console.log(`  - Lazy imports: ${hasLazyImports ? '✓' : '✗'}`);
console.log(`  - Suspense boundaries: ${hasSuspense ? '✓' : '✗'}`);
console.log(`  - Feature flags integration: ${hasFeatureFlags ? '✓' : '✗'}\n`);

// Test 2: Verify build output chunks
console.log('✅ Test 2: Build Output Analysis');
const distPath = path.join(__dirname, 'dist/assets');
if (fs.existsSync(distPath)) {
  const assets = fs.readdirSync(distPath);
  const jsAssets = assets.filter(file => file.endsWith('.js'));
  
  console.log(`  - Total JS chunks: ${jsAssets.length}`);
  console.log(`  - Expected separate chunks:`);
  
  const expectedChunks = [
    'vendor',
    'services', 
    'ui',
    'langgraph',
    'ChatMessagesView',
    'KnowledgeFeed',
    'TopicSuggestions',
    'MediaUploader',
    'AudioRecorder', 
    'DocumentUploader'
  ];
  
  expectedChunks.forEach(chunk => {
    const found = jsAssets.some(file => file.includes(chunk));
    console.log(`    - ${chunk}: ${found ? '✓' : '✗'}`);
  });
  
  // Find main bundle size
  const mainBundle = jsAssets.find(file => file.startsWith('index-'));
  if (mainBundle) {
    const stats = fs.statSync(path.join(distPath, mainBundle));
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`\n  - Main bundle size: ${sizeKB}KB`);
    console.log(`  - Under 400KB target: ${sizeKB < 400 ? '✓' : '✗'}`);
  }
} else {
  console.log('  - No dist folder found. Run npm run build first.');
}

console.log('\n🎯 Phase 2 Implementation Status:');
const allTestsPassed = hasLazyImports && hasSuspense && hasFeatureFlags;
console.log(`Overall: ${allTestsPassed ? '✅ READY FOR TESTING' : '❌ NEEDS FIXES'}`);

console.log('\n📋 Manual Testing Steps:');
console.log('1. Open http://localhost:5173/app/');
console.log('2. Open DevTools Network tab');
console.log('3. Switch between Chat/Feed/Topics tabs');
console.log('4. Watch for dynamic chunk loading');
console.log('5. Open "Add Knowledge" drawer to test upload components');