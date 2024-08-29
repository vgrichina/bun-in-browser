import { serve } from "bun";
import debug from "debug";
import { customAlphabet } from 'nanoid';

const log = debug("bun-in-browser:server");

// Create a custom nanoid function with a safe alphabet for domain names
const generateSafeId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export function startReverseProxy({ port = 3000, baseDomain = 'localhost', useSubdomains = false } = {}) {
  const clients = new Map();

  const server = Bun.serve({
    port,
    async fetch(req, server) {
      const url = new URL(req.url);
      const host = req.headers.get('host');
      log(`Received request: ${req.method} ${url.pathname} (Host: ${host})`);

      if (server.upgrade(req)) {
        return; // WebSocket upgrade successful
      }

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
        return new Response(`No connected clients with ID: ${clientId}`, { status: 404 });
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

        client.send(JSON.stringify(requestData));

        client.pendingRequests = client.pendingRequests || new Map();
        client.pendingRequests.set(requestId, { resolve, timeoutId });
      });
    },
    websocket: {
      open(ws) {
        const clientId = generateSafeId();
        log(`New WebSocket connection: ${clientId}`);
        clients.set(clientId, ws);
        const clientUrl = useSubdomains
          ? `http://${clientId}.${baseDomain}:${port}`
          : `http://${baseDomain}:${port}/${clientId}`;
        ws.send(JSON.stringify({ type: 'id', clientId, clientUrl }));
        ws.pendingRequests = new Map();
      },
      message(ws, message) {
        const response = JSON.parse(message);
        if (response.id) {
          const pendingRequest = ws.pendingRequests.get(response.id);
          if (pendingRequest) {
            log(`Received response for request ${response.id}`);
            clearTimeout(pendingRequest.timeoutId);
            pendingRequest.resolve(new Response(response.body, {
              status: response.status,
              headers: response.headers,
            }));
            ws.pendingRequests.delete(response.id);
          } else {
            log(`Received response for unknown request: ${response.id}`);
          }
        } else {
          log(`Received unexpected message: ${message}`);
        }
      },
      close(ws) {
        const clientId = [...clients.entries()].find(([_, client]) => client === ws)?.[0];
        if (clientId) {
          log(`WebSocket connection closed: ${clientId}`);
          clients.delete(clientId);
        }
        // Clear any pending requests
        if (ws.pendingRequests) {
          for (const [, { resolve, timeoutId }] of ws.pendingRequests) {
            clearTimeout(timeoutId);
            resolve(new Response("WebSocket connection closed", { status: 503 }));
          }
          ws.pendingRequests.clear();
        }
      },
    },
  });

  console.log(`Server listening on port ${port}`);
  console.log(`Demo server can be started with: bun run serve-demo`);
  console.log(`This will serve the demo files on port 3001`);

  return {
    server,
    stop: () => {
      log("Stopping server");
      server.stop();
      clients.clear();
    }
  };
}