import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startReverseProxy } from "../src/server.js";
import WebSocket from "ws";
import debug from "debug";

const log = debug('test:reverse-proxy');

describe("startReverseProxy", () => {
  let proxyServer;
  let wsClient;

  beforeAll(async () => {
    log('Starting reverse proxy server');
    proxyServer = startReverseProxy({ httpPort: 3000, wsPort: 8080 });
    
    log('Waiting for WebSocket server to start');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    log('Connecting WebSocket client');
    wsClient = new WebSocket('ws://localhost:8080');
    
    log('Waiting for WebSocket connection to be established');
    await new Promise(resolve => wsClient.on('open', resolve));
    log('WebSocket connection established');
  });

  afterAll(() => {
    log('Closing WebSocket client');
    wsClient.close();
    log('Stopping reverse proxy server');
    proxyServer.stop();
  });

  it("should start the server with specified ports", () => {
    log('Testing server ports');
    expect(proxyServer.httpServer.port).toBe(3000);
    expect(proxyServer.wsServer.address().port).toBe(8080);
  });

  it("should handle incoming HTTP requests and forward them via WebSocket", async () => {
    log('Testing HTTP request forwarding');
    const requestPromise = new Promise(resolve => {
      const handler = (data) => {
        const request = JSON.parse(data.toString());
        log('Received forwarded request:', request);
        resolve(request);
        wsClient.off('message', handler);
        wsClient.send(JSON.stringify({ status: 200, headers: {}, body: "OK" }));
      };
      wsClient.on('message', handler);
    });

    log('Sending HTTP request to /test');
    await fetch("http://localhost:3000/test");

    const forwardedRequest = await requestPromise;
    log('Asserting forwarded request');
    expect(forwardedRequest).toMatchObject({
      method: "GET",
      url: "/test",
      headers: expect.any(Object),
    });
  });

  it("should handle WebSocket responses and return them as HTTP responses", async () => {
    log('Testing WebSocket response handling');
    const responseHandler = (data) => {
      const request = JSON.parse(data.toString());
      log('Received request via WebSocket:', request);
      const response = {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello from Bun.js!" }),
      };
      log('Sending response via WebSocket:', response);
      wsClient.send(JSON.stringify(response));
    };

    wsClient.once('message', responseHandler);

    log('Sending HTTP request to /test');
    const response = await fetch("http://localhost:3000/test");
    
    log('Asserting HTTP response');
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    const body = await response.json();
    log('Response body:', body);
    expect(body).toEqual({ message: "Hello from Bun.js!" });
  });

  it("should handle client timeouts", async () => {
    log('Testing client timeout handling');
    const timeoutHandler = () => {
      log('Simulating timeout by not responding');
      // Don't respond to simulate a timeout
    };

    wsClient.once('message', timeoutHandler);

    log('Sending HTTP request to /test');
    const response = await fetch("http://localhost:3000/test");
    
    log('Asserting timeout response');
    expect(response.status).toBe(504);
    expect(await response.text()).toBe("Client timeout");
  }, 10000);  // Increase timeout for this test

  it("should serve demo HTML file for root and /demo paths", async () => {
    log('Testing demo HTML serving');
    const rootResponse = await fetch("http://localhost:3000/");
    const demoResponse = await fetch("http://localhost:3000/demo");

    log('Asserting root response');
    expect(rootResponse.status).toBe(200);
    expect(rootResponse.headers.get("Content-Type")).toBe("text/html");

    log('Asserting demo response');
    expect(demoResponse.status).toBe(200);
    expect(demoResponse.headers.get("Content-Type")).toBe("text/html");

    const rootBody = await rootResponse.text();
    const demoBody = await demoResponse.text();
    log('Asserting HTML content');
    expect(rootBody).toContain("Bun.js in Browser Demo");
    expect(demoBody).toContain("Bun.js in Browser Demo");
  });

  it("should serve client.js file", async () => {
    log('Testing client.js serving');
    const response = await fetch("http://localhost:3000/client.js");

    log('Asserting client.js response');
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/javascript");
    const body = await response.text();
    log('Asserting client.js content');
    expect(body).toContain("class BunInBrowser");
  });
});
