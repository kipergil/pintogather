#!/usr/bin/env node

// Production server startup script
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const PORT = process.env.PORT || 5000;

console.log('Starting production server...');
console.log(`Port: ${PORT}`);
console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);

// Check if built server exists
if (!existsSync('dist/index.js')) {
  console.error('Built server not found at dist/index.js');
  console.log('Running build process...');
  
  const buildProcess = spawn('npx', ['esbuild', 'server/index.ts', '--platform=node', '--packages=external', '--bundle', '--format=esm', '--outdir=dist'], {
    stdio: 'inherit'
  });
  
  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('Build completed, starting server...');
      startServer();
    } else {
      console.error('Build failed with code:', code);
      process.exit(1);
    }
  });
} else {
  startServer();
}

function startServer() {
  // Set production environment
  process.env.NODE_ENV = 'production';
  process.env.PORT = PORT;
  
  const serverProcess = spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    process.exit(code);
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    serverProcess.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    serverProcess.kill('SIGINT');
  });
}