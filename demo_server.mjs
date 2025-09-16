#!/usr/bin/env node

/**
 * Demo script to run the A2A server with telemetry.
 * 
 * Usage:
 *   node demo_server.mjs
 * 
 * Then test with:
 *   curl -X POST http://localhost:3000/message/send \
 *     -H "Content-Type: application/json" \
 *     -d '{"message": {"content": "Hello, A2A agent!"}}'
 */

import { createA2AServer } from './dist/src/harness/server.js';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log('🚀 Starting A2A Demo Server...');
console.log('📦 Features:');
console.log('  - A2A Express harness');
console.log('  - DSL agent wrapper (echo/summarize)');
console.log('  - Write-behind telemetry logging');
console.log('  - Azure Append Blob support (when available)');
console.log('');

const server = createA2AServer(port);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

server.start()
  .then(() => {
    console.log(`✅ Server running on http://localhost:${port}`);
    console.log('');
    console.log('📡 API Endpoints:');
    console.log(`  GET  http://localhost:${port}/health`);
    console.log(`  POST http://localhost:${port}/message/send`);
    console.log('');
    console.log('🧪 Test with curl:');
    console.log(`  curl -X POST http://localhost:${port}/message/send \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"message": {"content": "Hello, A2A agent!"}}'`);
    console.log('');
    console.log('📊 Telemetry: Check console output for logged interactions');
  })
  .catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });