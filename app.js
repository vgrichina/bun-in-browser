// server.js
import { serve } from "bun";
import { Server as WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);

  ws.on("message", (message) => {
    // Handle incoming messages from the browser if needed
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === "/") {
      return new Response(Bun.file("./index.html"));
    }

    // Forward the request to the WebSocket clients
    const requestData = {
      method: req.method,
      url: url.pathname + url.search,
      headers: Object.fromEntries(req.headers.entries()),
    };

    if (req.body) {
      requestData.body = await req.text();
    }

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

console.log(`HTTP server listening on ${server.port}`);
console.log(`WebSocket server listening on port 8080`);
