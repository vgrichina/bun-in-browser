export class BunInBrowser {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.serverModule = null;

    this.ws.onmessage = async (event) => {
      const request = JSON.parse(event.data);
      if (!this.serverModule) {
        this.ws.send(JSON.stringify({
          status: 503,
          body: 'Server not ready',
        }));
        return;
      }

      const bunRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      try {
        const response = await this.serverModule.fetch(bunRequest);
        const responseBody = await response.text();
        this.ws.send(JSON.stringify({
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        }));
      } catch (error) {
        this.ws.send(JSON.stringify({
          status: 500,
          body: `Error: ${error.message}`,
        }));
      }
    };
  }

  async start(code) {
    try {
      const module = await import(`data:text/javascript,${encodeURIComponent(code)}`);
      this.serverModule = module.default;
      console.log('Server started successfully!');
      console.log(`Listening on port ${this.serverModule.port}`);
    } catch (error) {
      console.error(`Error starting server: ${error.message}`);
    }
  }
}
