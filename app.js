#!/usr/bin/env bun
import { startReverseProxy } from "./src/server.js";

const server = startReverseProxy({
  httpPort: 3000,
  wsPort: 8080,
  demoPort: 3001
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  server.stop();
  process.exit(0);
});

console.log('Server started. Press Ctrl+C to stop.');