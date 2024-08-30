# bun-in-browser

Run Bun.js-style servers in the browser with a WebSocket-based reverse proxy.

## Installation

```bash
bun add bun-in-browser
```

## Usage

### Server-side

Start the server using the provided `app.js` script:

```bash
PORT=3000 BASE_URL=http://localhost:3000 USE_SUBDOMAINS=false bun app.js
```

Or use the `startReverseProxy` function in your own script:

```javascript
import { startReverseProxy } from 'bun-in-browser/src/server.js';

const { server, stop } = startReverseProxy({
  port: 3000,
  baseUrl: 'http://localhost:3000',
  useSubdomains: false
});

console.log(`Server started on port 3000. Base URL: http://localhost:3000`);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  stop();
  process.exit(0);
});
```

### Demo

To start the demo server:

```bash
bun run demo
```

After starting the server, navigate to the demo URL provided in the console output (typically http://localhost:3001).

#### Simple Demo

The simple demo ([View Source](demo/simple.html)) demonstrates basic routing and JSON responses. Here's an example of the client-side code:

```javascript
import { BunInBrowser } from 'bun-in-browser/client';

const bunInBrowser = new BunInBrowser('ws://localhost:3000');

const serverModule = {
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response("Hello from Bun.js in the browser!");
    }
    if (url.pathname === "/json") {
      return Response.json({ message: "This is JSON data" });
    }
    return new Response("Not Found", { status: 404 });
  },
};

bunInBrowser.serverModule = serverModule;
```

#### Advanced Demo

The advanced demo ([View Source](demo/advanced.html)) showcases a more complex application: a guest book. It demonstrates handling different routes, processing form submissions, and generating dynamic HTML responses. Here's an excerpt from the demo:

```javascript
const serverModule = {
  guestBook: [],
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response(this.renderGuestBook(), {
        headers: { "Content-Type": "text/html" }
      });
    }
    if (url.pathname === "/sign" && req.method === "POST") {
      return this.handleSignGuestBook(req);
    }
    if (url.pathname === "/api") {
      return Response.json({ 
        message: "This is a JSON response from Bun.js",
        clientId: window.clientId,
        clientUrl: window.clientUrl
      });
    }
    return new Response("Not Found", { status: 404 });
  },
  renderGuestBook() {
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">Welcome to our Guest Book!</h1>
        <form action='/sign' method='POST' style="margin-bottom: 20px;">
          <input type='text' name='name' placeholder='Your Name' required style="margin: 5px 0; padding: 5px;">
          <input type='text' name='message' placeholder='Your Message' required style="margin: 5px 0; padding: 5px;">
          <button type='submit' style="margin: 5px 0; padding: 5px; background-color: #4CAF50; color: white; border: none; cursor: pointer;">Sign Guest Book</button>
        </form>
        <h2>Entries:</h2>
        <ul style="list-style-type: none; padding: 0;">
          ${this.guestBook.map(entry => `<li style="margin-bottom: 10px;"><strong>${entry.name}</strong>: ${entry.message}</li>`).join('')}
        </ul>
      </div>
    `;
    return html;
  },
  async handleSignGuestBook(req) {
    const formData = await req.formData();
    const name = formData.get("name");
    const message = formData.get("message");
    this.guestBook.push({ name, message });
    return new Response("Entry added successfully", { 
      status: 302, 
      headers: { "Location": "/" } 
    });
  }
};

const bunInBrowser = new BunInBrowser('wss://browser-proxy.web4.near.page', serverModule);
```

## API

### Server-side

#### `startReverseProxy(options)`

Starts the reverse proxy server.

- `options.port`: The port for the server (default: 3000)
- `options.baseUrl`: The base URL for the server (default: 'http://localhost:3000')
- `options.useSubdomains`: Whether to use subdomains for client identification (default: false)

Returns an object with:
- `server`: The server instance
- `stop()`: Function to stop the server

### Client-side

#### `new BunInBrowser(wsUrl, serverModule)`

Creates a new BunInBrowser instance.

- `wsUrl`: The WebSocket URL to connect to
- `serverModule`: (Optional) The server module object

#### `bunInBrowser.serverModule`

Set this property to your Bun.js server module object. The module should have:
- `fetch(req)`: A function that handles incoming requests and returns a Response object

#### `bunInBrowser.waitUntilReady()`

Returns a promise that resolves when the BunInBrowser instance is ready to use.

#### `bunInBrowser.close()`

Closes the WebSocket connection.

#### `bunInBrowser.clientId`

The unique identifier for this client.

#### `bunInBrowser.clientUrl`

The URL where this client's server can be accessed.

## Features

- Run Bun.js-style servers in the browser
- WebSocket-based communication between browser and server
- Support for various HTTP methods (GET, POST, etc.)
- JSON response handling
- HTML response generation
- Form data processing
- Custom status codes and headers
- Optional subdomain-based client identification
- Environment variable configuration
- Graceful shutdown handling
- Interactive demo with editable code

## Development

To run tests:

```bash
bun test
```

## Debugging

This project uses the `debug` package for logging. To enable debug logs, set the DEBUG environment variable:

```bash
DEBUG=bun-in-browser:* bun run your-script.js
```

For running tests with debug logs:

```bash
DEBUG=test:client bun test
```

## Environment Variables

When using the `app.js` script, you can configure the server using the following environment variables:

- `PORT`: The port number for the server (default: 3000)
- `BASE_URL`: The base URL for the server (default: `http://localhost:${PORT}`)
- `USE_SUBDOMAINS`: Whether to use subdomains for client identification (default: false)

Note: When using `startReverseProxy` directly, the default `baseUrl` is the fixed string 'http://localhost:3000'.

## License

MIT