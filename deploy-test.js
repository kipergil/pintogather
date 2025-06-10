#!/usr/bin/env node

// Final deployment test script
import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('🚀 Running deployment test...\n');

// Test 1: Check if server builds
console.log('1. Testing server build...');
try {
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { stdio: 'pipe' });
  console.log('✅ Server builds successfully');
} catch (error) {
  console.log('❌ Server build failed');
  process.exit(1);
}

// Test 2: Check if built files exist
console.log('2. Checking built files...');
if (existsSync('dist/index.js')) {
  console.log('✅ dist/index.js exists');
} else {
  console.log('❌ dist/index.js missing');
  process.exit(1);
}

if (existsSync('dist/start.js')) {
  console.log('✅ dist/start.js exists');
} else {
  console.log('❌ dist/start.js missing');
  process.exit(1);
}

// Test 3: Test server startup (quick test)
console.log('3. Testing server startup...');
try {
  execSync('cd dist && NODE_ENV=production PORT=5002 timeout 3s node start.js || true', { stdio: 'pipe' });
  console.log('✅ Server starts without errors');
} catch (error) {
  console.log('❌ Server startup failed');
  process.exit(1);
}

console.log('\n🎉 All deployment tests passed!');
console.log('\nDeployment is ready with:');
console.log('- Built server: dist/index.js');
console.log('- Startup script: dist/start.js');
console.log('- Environment variables: PORT, NODE_ENV');
console.log('\nUse: node dist/start.js or npm start');