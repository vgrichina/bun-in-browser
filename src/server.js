import { serve } from "bun";
import { Server as WebSocketServer } from "ws";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import debug from "debug";
import { nanoid } from 'nanoid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = debug("bun-in-browser:server");

export function startReverseProxy({ httpPort = 3000, wsPort = 8080, demoPort = 3001, baseDomain = 'localhost' } = {}) {
  const wss = new WebSocketServer({ port: wsPort });
  const clients = new Map();

  wss.on("connection", (ws) => {
    const clientId = nanoid(10);
    log(`New WebSocket connection: ${clientId}`);
    clients.set(clientId, ws);
    ws.send(JSON.stringify({ type: 'id', clientId }));

    ws.on("close", () => {
      log(`WebSocket connection closed: ${clientId}`);
      clients.delete(clientId);
    });
  });

  const proxyServer = serve({
    port: httpPort,
    async fetch(req) {
      const url = new URL(req.url);
      const host = req.headers.get('host');
      log(`Received request: ${req.method} ${url.pathname} (Host: ${host})`);

      const subdomain = host.split('.')[0];
      const clientId = subdomain !== baseDomain ? subdomain : null;

      if (clientId && !clients.has(clientId)) {
        return new Response("Invalid subdomain", { status: 404 });
      }

      const requestId = Math.random().toString(36).substring(2, 15);
      const requestData = {
        id: requestId,
        method: req.method,
        url: url.pathname + url.search,
        headers: Object.fromEntries(req.headers.entries()),
        body: req.body ? await req.text() : undefined,
      };

      const client = clientId ? clients.get(clientId) : clients.values().next().value;

      if (!client) {
        return new Response("No connected clients", { status: 503 });
      }

      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          log(`Client timeout for request ${requestId}`);
          resolve(new Response("Client timeout", { status: 504 }));
        }, 5000);

        client.send(JSON.stringify(requestData), (error) => {
          if (error) {
            log(`Failed to send request ${requestId} to client`, error);
            clearTimeout(timeoutId);
            resolve(new Response("Failed to send request to client", { status: 500 }));
          }
        });

        const messageHandler = (message) => {
          const response = JSON.parse(message);
          if (response.id === requestId) {
            log(`Received response for request ${requestId}`);
            client.removeListener('message', messageHandler);
            clearTimeout(timeoutId);
            resolve(new Response(response.body, {
              status: response.status,
              headers: response.headers,
            }));
          }
        };

        client.on('message', messageHandler);
      });
    },
  });

  const demoServer = serve({
    port: demoPort,
    fetch(req) {
      const url = new URL(req.url);
      log(`Received demo request: ${req.method} ${url.pathname}`);

      if (url.pathname === "/" || url.pathname === "/demo") {
        log("Serving demo page");
        const demoHtml = readFileSync(join(__dirname, "demo.html"), "utf-8");
        return new Response(demoHtml, {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.pathname === "/client.js") {
        log("Serving client.js");
        const clientJs = readFileSync(join(__dirname, "client.js"), "utf-8");
        return new Response(clientJs, {
          headers: { "Content-Type": "application/javascript" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`HTTP proxy server listening on port ${httpPort}`);
  console.log(`WebSocket server listening on port ${wsPort}`);
  console.log(`Demo server listening on port ${demoPort}`);
  console.log(`Demo available at http://localhost:${demoPort}/demo`);

  return {
    httpServer: proxyServer,
    wsServer: wss,
    demoServer: demoServer,
    stop: () => {
      log("Stopping servers");
      proxyServer.stop();
      demoServer.stop();
      wss.close();
      clients.clear();
    }
  };
}