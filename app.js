#!/usr/bin/env bun
import { startReverseProxy } from "./src/server.js";

const server = startReverseProxy({
  port: parseInt(process.env.PORT) || 3000,
  baseDomain: process.env.BASE_DOMAIN || 'localhost',
  useSubdomains: process.env.USE_SUBDOMAINS === 'true' // Set to true to use subdomains instead of paths
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  server.stop();
  process.exit(0);
});

console.log(`Server started. Press Ctrl+C to stop.`);