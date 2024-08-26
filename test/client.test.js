import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startReverseProxy } from "../src/server.js";
import { BunInBrowser } from "../src/client.js";
import debug from "debug";

const log = debug('test:client');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe("BunInBrowser", () => {
  let proxyServer;
  let bunInBrowser;
  const PORT = 3000;

  const serverModule = {
    port: PORT,
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
        return new Response(null, { status: parseInt(url.searchParams.get("code") || "404") });
      }
      return new Response("Not Found", { status: 404 });
    },
  };

  beforeAll(async () => {
    log('Starting reverse proxy server');
    proxyServer = startReverseProxy({ httpPort: PORT, wsPort: 8080 });
    
    log('Waiting for WebSocket server to start');
    await delay(100);
    
    log('Creating BunInBrowser instance');
    bunInBrowser = new BunInBrowser('ws://localhost:8080', serverModule);
    
    log('Waiting for WebSocket connection to be established');
    await new Promise(resolve => bunInBrowser.ws.on('open', resolve));
    
    log('BunInBrowser instance ready');
    await delay(100); // Give some time for everything to be fully ready
  }, 10000);  // Increase timeout for setup

  afterAll(() => {
    log('Closing BunInBrowser instance');
    bunInBrowser.close();
    log('Stopping reverse proxy server');
    proxyServer.stop();
  });

  it("should handle GET requests", async () => {
    log('Testing GET request');
    const response = await fetch(`http://localhost:${PORT}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello from Bun.js in the browser!");
    await delay(100);
  });

  it("should handle JSON responses", async () => {
    log('Testing JSON response');
    const response = await fetch(`http://localhost:${PORT}/json`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const data = await response.json();
    expect(data).toEqual({ message: "This is JSON data" });
    await delay(100);
  });

  it("should echo POST requests", async () => {
    log('Testing POST request echo');
    const postData = "Hello, server!";
    const response = await fetch(`http://localhost:${PORT}/echo`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: postData,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(await response.text()).toBe(postData);
    await delay(100);
  });

  it("should handle custom status codes", async () => {
    log('Testing custom status codes');
    const response = await fetch(`http://localhost:${PORT}/status?code=418`);
    expect(response.status).toBe(418);
    await delay(100);
  });

  it("should handle 404 for unknown routes", async () => {
    log('Testing 404 for unknown route');
    const response = await fetch(`http://localhost:${PORT}/unknown`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
    await delay(100);
  });
});