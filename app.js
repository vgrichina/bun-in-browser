#!/usr/bin/env bun
import { startReverseProxy } from "./src/server.js";

const server = startReverseProxy({
  httpPort: parseInt(process.env.HTTP_PORT) || 3000,
  wsPort: parseInt(process.env.WS_PORT) || 8080,
  demoPort: parseInt(process.env.DEMO_PORT) || 3001,
  baseDomain: process.env.BASE_DOMAIN || 'localhost'
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  server.stop();
  process.exit(0);
});

console.log('Server started. Press Ctrl+C to stop.');