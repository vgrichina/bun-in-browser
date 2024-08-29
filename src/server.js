import { serve } from "bun";
import { Server as WebSocketServer } from "ws";
import debug from "debug";
import { nanoid } from 'nanoid';

const log = debug("bun-in-browser:server");

export function startReverseProxy({ httpPort = 3000, wsPort = 8080, baseDomain = 'localhost', useSubdomains = false } = {}) {
  const wss = new WebSocketServer({ port: wsPort });
  const clients = new Map();

  wss.on("connection", (ws) => {
    const clientId = nanoid(10);
    log(`New WebSocket connection: ${clientId}`);
    clients.set(clientId, ws);
    const clientUrl = useSubdomains
      ? `http://${clientId}.${baseDomain}:${httpPort}`
      : `http://${baseDomain}:${httpPort}/${clientId}`;
    ws.send(JSON.stringify({ type: 'id', clientId, clientUrl }));

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

      let clientId;
      if (useSubdomains) {
        const subdomain = host.split('.')[0];
        clientId = subdomain !== baseDomain ? subdomain : null;
      } else {
        const pathParts = url.pathname.split('/');
        clientId = pathParts[1];
        url.pathname = '/' + pathParts.slice(2).join('/');
      }

      if (clientId && !clients.has(clientId)) {
        return new Response("Invalid client ID", { status: 404 });
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

  console.log(`HTTP proxy server listening on port ${httpPort}`);
  console.log(`WebSocket server listening on port ${wsPort}`);
  console.log(`Demo server can be started with: bun run serve-demo`);
  console.log(`This will serve the demo files on port 3001`);

  return {
    httpServer: proxyServer,
    wsServer: wss,
    stop: () => {
      log("Stopping servers");
      proxyServer.stop();
      wss.close();
      clients.clear();
    }
  };
}