import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import getPort, { portNumbers } from "get-port";
import { startReverseProxy } from '../src/server.js';
import WebSocket from "ws";
import fetch from "node-fetch";
import debug from "debug";

const log = debug('test:reverse-proxy');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const setupTestWsClientHandler = (wsClient) => {
  wsClient.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.method === 'GET') {
      const response = {
        id: data.id,
        status: 200,
        headers: { "Content-Type": "text/plain" },
        body: `Hello from the proxy server! You requested: ${data.url}`
      };
      wsClient.send(JSON.stringify(response));
    }
  });
};

const waitForClientId = (wsClient) => {
  return new Promise(resolve => {
    wsClient.on('message', (message) => {
      const data = JSON.parse(message);
      if (data.type === 'id') {
        log(`Received client ID: ${data.clientId}`);
        resolve(data.clientId);
      }
    });
  });
};

describe("startReverseProxy", () => {
  let proxyServer;
  let wsClient;
  let HTTP_PORT, WS_PORT;
  let clientId;

  beforeAll(async () => {
    // Get available ports
    [HTTP_PORT, WS_PORT] = await Promise.all([
      getPort({port: portNumbers(3000, 3100)}),
      getPort({port: portNumbers(8080, 8180)}),
    ]);

    log('Starting reverse proxy server');
    proxyServer = startReverseProxy({ httpPort: HTTP_PORT, wsPort: WS_PORT });
    
    log('Waiting for WebSocket server to start');
    await delay(100);
    
    log('Connecting WebSocket client');
    wsClient = new WebSocket(`ws://localhost:${WS_PORT}`);
    
    log('Waiting for WebSocket connection to be established');
    await new Promise(resolve => wsClient.on('open', resolve));
    log('WebSocket connection established');

    clientId = await waitForClientId(wsClient);

    setupTestWsClientHandler(wsClient);
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
  });

  it("should handle HTTP requests", async () => {
    log('Testing HTTP request handling');
    const response = await fetch(`http://localhost:${HTTP_PORT}/${clientId}/`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("Hello from the proxy server! You requested: /");
  });

  it("should send client ID message on WebSocket connection", async () => {
    const testWsClient = new WebSocket(`ws://localhost:${WS_PORT}`);
    await new Promise(resolve => testWsClient.on('open', resolve));
    
    const testClientId = await waitForClientId(testWsClient);
    
    expect(testClientId).toBeTruthy();
    expect(testClientId).not.toBe(clientId);
    
    testWsClient.close();
  });

  it("should handle requests with subpaths", async () => {
    log('Testing subpath handling');
    const response = await fetch(`http://localhost:${HTTP_PORT}/${clientId}/subpath`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("Hello from the proxy server! You requested: /subpath");
  });

  it("should handle requests with subdomains", async () => {
    log('Testing subdomain handling');
    const subdomainHttpPort = await getPort({port: portNumbers(HTTP_PORT + 1, HTTP_PORT + 100)});
    const subdomainWsPort = await getPort({port: portNumbers(WS_PORT + 1, WS_PORT + 100)});
    
    const subdomainProxyServer = startReverseProxy({ 
      httpPort: subdomainHttpPort, 
      wsPort: subdomainWsPort, 
      baseDomain: 'localhost', 
      useSubdomains: true 
    });

    const testWsClient = new WebSocket(`ws://localhost:${subdomainWsPort}`);
    
    await new Promise(resolve => testWsClient.on('open', resolve));

    const subdomainClientId = await waitForClientId(testWsClient);

    setupTestWsClientHandler(testWsClient);

    const response = await fetch(`http://localhost:${subdomainHttpPort}/`, {
      headers: { 'Host': `${subdomainClientId}.localhost` }
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("Hello from the proxy server! You requested: /");

    testWsClient.close();
    subdomainProxyServer.stop();
  });
});
