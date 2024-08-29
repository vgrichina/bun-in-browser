import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import getPort, { portNumbers } from "get-port";
import { startReverseProxy } from "../src/server.js";
import { BunInBrowser } from "../src/client.js";
import debug from "debug";

const log = debug('test:client');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe("BunInBrowser", () => {
  let proxyServer;
  let bunInBrowser;
  let PORT;

  const serverModule = {
    port: null, // We'll set this dynamically
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/") {
        return new Response("Hello from Bun.js in the browser!");
      }
      if (url.pathname === "/json") {
        return Response.json({ message: "This is JSON data" });
      }
      if (url.pathname === "/echo") {
        return new Response(req.body, { status: 200, headers: { "Content-Type": req.headers.get("Content-Type") } });
      }
      if (url.pathname === "/status") {
        const statusCode = parseInt(url.searchParams.get("code") || "404");
        return new Response(`Status: ${statusCode}`, { status: statusCode });
      }
      return new Response("Not Found", { status: 404 });
    },
  };

  beforeAll(async () => {
    // Get available port
    PORT = await getPort({port: portNumbers(3000, 3100)});

    serverModule.port = PORT;

    log('Starting reverse proxy server');
    proxyServer = startReverseProxy({ port: PORT });
    
    log('Waiting for server to start');
    await delay(100);
    
    log('Creating BunInBrowser instance');
    bunInBrowser = new BunInBrowser(`ws://localhost:${PORT}`, serverModule);
    
    log('Waiting for BunInBrowser to be ready');
    await bunInBrowser.waitUntilReady();
    log('BunInBrowser instance ready');
  }, 10000);

  afterAll(() => {
    log('Closing BunInBrowser instance');
    bunInBrowser.close();
    log('Stopping reverse proxy server');
    proxyServer.stop();
  });

  it("should handle GET requests for root", async () => {
    log('Testing GET request for root');
    const response = await fetch(`${bunInBrowser.clientUrl}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello from Bun.js in the browser!");
  });

  it("should handle GET requests for JSON", async () => {
    log('Testing GET request for JSON');
    const response = await fetch(`${bunInBrowser.clientUrl}/json`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "This is JSON data" });
  });

  it("should handle POST requests with echo", async () => {
    log('Testing POST request with echo');
    const testData = "Test echo data";
    const response = await fetch(`${bunInBrowser.clientUrl}/echo`, {
      method: "POST",
      body: testData,
      headers: { "Content-Type": "text/plain" },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(testData);
  });

  it("should handle custom status codes", async () => {
    log('Testing custom status codes');
    const response = await fetch(`${bunInBrowser.clientUrl}/status?code=418`);
    expect(response.status).toBe(418);
  });

  it("should return 404 for non-existent routes", async () => {
    log('Testing 404 for non-existent routes');
    const response = await fetch(`${bunInBrowser.clientUrl}/non-existent`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("should handle multiple concurrent requests", async () => {
    log('Testing multiple concurrent requests');
    const requests = [
      fetch(`${bunInBrowser.clientUrl}/`),
      fetch(`${bunInBrowser.clientUrl}/json`),
      fetch(`${bunInBrowser.clientUrl}/status?code=201`),
    ];
    const responses = await Promise.all(requests);
    expect(responses[0].status).toBe(200);
    expect(responses[1].status).toBe(200);
    expect(responses[2].status).toBe(201);
  });

  it("should handle WebSocket disconnection and reconnection", async () => {
    log('Testing WebSocket disconnection and reconnection');
    bunInBrowser.close();
    await delay(100);
    bunInBrowser = new BunInBrowser(`ws://localhost:${PORT}`, serverModule);
    await bunInBrowser.waitUntilReady();
    const response = await fetch(`${bunInBrowser.clientUrl}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello from Bun.js in the browser!");
  });

  it("should receive a client ID and URL", () => {
    expect(bunInBrowser.clientId).toBeTruthy();
    expect(bunInBrowser.clientUrl).toBeTruthy();
  });
});