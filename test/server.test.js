import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import getPort, { portNumbers } from "get-port";
import { startReverseProxy } from '../src/server.js';
import WebSocket from "ws";
import fetch from "node-fetch";
import debug from "debug";

const log = debug('test:reverse-proxy');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe("startReverseProxy", () => {
  let proxyServer;
  let wsClient;
  let HTTP_PORT, WS_PORT, DEMO_PORT;

  beforeAll(async () => {
    // Get available ports
    [HTTP_PORT, WS_PORT, DEMO_PORT] = await Promise.all([
      getPort({port: portNumbers(3000, 3100)}),
      getPort({port: portNumbers(8080, 8180)}),
      getPort({port: portNumbers(3001, 3101)}),
    ]);

    log('Starting reverse proxy server');
    proxyServer = startReverseProxy({ httpPort: HTTP_PORT, wsPort: WS_PORT, demoPort: DEMO_PORT });
    
    log('Waiting for WebSocket server to start');
    await delay(100);
    
    log('Connecting WebSocket client');
    wsClient = new WebSocket(`ws://localhost:${WS_PORT}`);
    
    log('Waiting for WebSocket connection to be established');
    await new Promise(resolve => wsClient.on('open', resolve));
    log('WebSocket connection established');

    // Set up message handling for the WebSocket client
    wsClient.on('message', (message) => {
      const request = JSON.parse(message);
      if (request.method === 'GET' && request.url === '/') {
        const response = {
          id: request.id,
          status: 200,
          body: "Hello from the proxy server!"
        };
        wsClient.send(JSON.stringify(response));
      }
    });
  }, 10000);

  afterAll(() => {
    log('Closing WebSocket client');
    if (wsClient) {
      wsClient.close();
    }
    log('Stopping reverse proxy server');
    if (proxyServer) {
      proxyServer.stop();
    }
  });

  it("should start the server with specified ports", () => {
    log('Testing server ports');
    expect(proxyServer.httpServer.port).toBe(HTTP_PORT);
    expect(proxyServer.wsServer.address().port).toBe(WS_PORT);
    expect(proxyServer.demoServer.port).toBe(DEMO_PORT);
  });

  it("should handle HTTP requests", async () => {
    log('Testing HTTP request handling');
    const response = await fetch(`http://localhost:${HTTP_PORT}/`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("Hello from the proxy server!");
  });

  it("should serve demo page", async () => {
    log('Testing demo page serving');
    const response = await fetch(`http://localhost:${DEMO_PORT}/demo`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("<html");
    expect(text).toContain("Bun.js in Browser Demo");
  });

  it("should serve client.js", async () => {
    log('Testing client.js serving');
    const response = await fetch(`http://localhost:${DEMO_PORT}/client.js`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("class BunInBrowser");
  });
});
