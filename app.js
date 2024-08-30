#!/usr/bin/env bun
import { startReverseProxy } from "./src/server.js";

const port = parseInt(process.env.PORT) || 3000;
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
const useSubdomains = process.env.USE_SUBDOMAINS === 'true';

const server = startReverseProxy({
  port,
  baseUrl,
  useSubdomains
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  server.stop();
  process.exit(0);
});
console.log(`Server started on port ${port}. Base URL: ${baseUrl}`);
console.log(`Run 'bun run demo' to start demo server on port 3001`);
console.log(`Press Ctrl+C to stop.`);