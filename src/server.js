import { serve } from "bun";
import { Server as WebSocketServer } from "ws";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startReverseProxy({ httpPort = 3000, wsPort = 8080 } = {}) {
  const wss = new WebSocketServer({ port: wsPort });
  const clients = new Set();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  const server = serve({
    port: httpPort,
    async fetch(req) {
      const url = new URL(req.url);
      
      if (url.pathname === "/demo") {
        const demoHtml = readFileSync(join(__dirname, "demo.html"), "utf-8");
        return new Response(demoHtml, {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.pathname === "/client.js") {
        const clientJs = readFileSync(join(__dirname, "client.js"), "utf-8");
        return new Response(clientJs, {
          headers: { "Content-Type": "application/javascript" },
        });
      }

      const requestData = {
        method: req.method,
        url: url.pathname + url.search,
        headers: Object.fromEntries(req.headers.entries()),
        body: req.body ? await req.text() : undefined,
      };

      const responsePromises = Array.from(clients).map((client) => {
        return new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve(new Response("Client timeout", { status: 504 }));
          }, 5000);

          client.send(JSON.stringify(requestData), (error) => {
            if (error) {
              clearTimeout(timeoutId);
              resolve(new Response("Failed to send request to client", { status: 500 }));
            }
          });

          client.once("message", (message) => {
            clearTimeout(timeoutId);
            const response = JSON.parse(message);
            resolve(new Response(response.body, {
              status: response.status,
              headers: response.headers,
            }));
          });
        });
      });

      if (responsePromises.length === 0) {
        return new Response("No connected clients", { status: 503 });
      }

      return Promise.race(responsePromises);
    },
  });

  console.log(`HTTP server listening on port ${httpPort}`);
  console.log(`WebSocket server listening on port ${wsPort}`);
  console.log(`Demo available at http://localhost:${httpPort}/demo`);

  return {
    httpServer: server,
    wsServer: wss,
    stop: () => {
      server.stop();
      wss.close();
      clients.clear();
    }
  };
}
