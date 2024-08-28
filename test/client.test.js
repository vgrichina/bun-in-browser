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
  let HTTP_PORT, WS_PORT, DEMO_PORT;

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
    // Get available ports
    [HTTP_PORT, WS_PORT, DEMO_PORT] = await Promise.all([
      getPort({port: portNumbers(3000, 3100)}),
      getPort({port: portNumbers(8080, 8180)}),
      getPort({port: portNumbers(3001, 3101)}),
    ]);

    serverModule.port = HTTP_PORT;

    log('Starting reverse proxy server');
    proxyServer = startReverseProxy({ httpPort: HTTP_PORT, wsPort: WS_PORT, demoPort: DEMO_PORT });
    
    log('Waiting for WebSocket server to start');
    await delay(100);
    
    log('Creating BunInBrowser instance');
    bunInBrowser = new BunInBrowser(`ws://localhost:${WS_PORT}`, serverModule);
    
    log('Waiting for WebSocket connection to be established');
    await new Promise(resolve => {
      bunInBrowser.ws.addEventListener('open', resolve, { once: true });
    });
    
    log('BunInBrowser instance ready');
    await delay(100);
  }, 10000);

  afterAll(() => {
    log('Closing BunInBrowser instance');
    bunInBrowser.close();
    log('Stopping reverse proxy server');
    proxyServer.stop();
  });

  it("should handle GET requests for root", async () => {
    log('Testing GET request for root');
    const response = await fetch(`http://localhost:${HTTP_PORT}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello from Bun.js in the browser!");
  });

  it("should handle GET requests for JSON", async () => {
    log('Testing GET request for JSON');
    const response = await fetch(`http://localhost:${HTTP_PORT}/json`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "This is JSON data" });
  });

  it("should handle POST requests with echo", async () => {
    log('Testing POST request with echo');
    const testData = "Test echo data";
    const response = await fetch(`http://localhost:${HTTP_PORT}/echo`, {
      method: "POST",
      body: testData,
      headers: { "Content-Type": "text/plain" },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(testData);
  });

  it("should handle custom status codes", async () => {
    log('Testing custom status codes');
    const response = await fetch(`http://localhost:${HTTP_PORT}/status?code=418`);
    expect(response.status).toBe(418);
  });

  it("should return 404 for non-existent routes", async () => {
    log('Testing 404 for non-existent routes');
    const response = await fetch(`http://localhost:${HTTP_PORT}/non-existent`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("should serve demo page on the demo server", async () => {
    log('Testing demo page serving');
    const response = await fetch(`http://localhost:${DEMO_PORT}/demo`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    const text = await response.text();
    expect(text).toContain("<html");
    expect(text).toContain("Bun.js in Browser Demo");
  });

  it("should serve client.js on the demo server", async () => {
    log('Testing client.js serving');
    const response = await fetch(`http://localhost:${DEMO_PORT}/client.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/javascript");
    const text = await response.text();
    expect(text).toContain("class BunInBrowser");
  });

  it("should handle multiple concurrent requests", async () => {
    log('Testing multiple concurrent requests');
    const requests = [
      fetch(`http://localhost:${HTTP_PORT}/`),
      fetch(`http://localhost:${HTTP_PORT}/json`),
      fetch(`http://localhost:${HTTP_PORT}/status?code=201`),
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
    bunInBrowser = new BunInBrowser(`ws://localhost:${WS_PORT}`, serverModule);
    await new Promise(resolve => {
      bunInBrowser.ws.addEventListener('open', resolve, { once: true });
    });
    const response = await fetch(`http://localhost:${HTTP_PORT}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello from Bun.js in the browser!");
  });
});