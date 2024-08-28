import debug from "debug";

const log = debug('bun-in-browser:client');

export class BunInBrowser {
  constructor(wsUrl, serverModule) {
    // Use native WebSocket
    this.ws = new WebSocket(wsUrl);
    this.serverModule = serverModule;
    this.setupWebSocketListeners();
    this.setupMessageHandler();
  }

  setupWebSocketListeners() {
    // Use addEventListener instead of .on
    this.ws.addEventListener('open', () => log('WebSocket connection opened'));
    this.ws.addEventListener('close', () => log('WebSocket connection closed'));
    this.ws.addEventListener('error', (error) => log('WebSocket error:', error));
  }

  setupMessageHandler() {
    // Use addEventListener and handle MessageEvent
    this.ws.addEventListener('message', async (event) => {
      const request = JSON.parse(event.data);
      log('Received request:', request);

      if (!this.serverModule) {
        this.sendResponse({
          id: request.id,
          status: 503,
          headers: { "Content-Type": "text/plain" },
          body: "Server not ready",
        });
        return;
      }

      try {
        const bunRequest = new Request(`http://localhost${request.url}`, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        const response = await this.serverModule.fetch(bunRequest);
        const responseBody = await response.text();
        this.sendResponse({
          id: request.id,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        });
      } catch (error) {
        log(`Error handling request: ${error.message}`);
        this.sendResponse({
          id: request.id,
          status: 500,
          headers: { "Content-Type": "text/plain" },
          body: `Error: ${error.message}`,
        });
      }
    });
  }

  sendResponse(response) {
    log('Sending response:', response);
    this.ws.send(JSON.stringify(response));
  }

  close() {
    this.ws.close();
  }
}