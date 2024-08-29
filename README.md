# bun-in-browser

Run Bun.js-style servers in the browser with a WebSocket-based reverse proxy.

## Installation

```bash
bun add bun-in-browser
```

## Usage

### Server-side

```javascript
import { startReverseProxy } from 'bun-in-browser/server';

const { server, stop } = startReverseProxy({
  port: 3000,
  baseUrl: 'http://localhost:3000',
  useSubdomains: false
});

// To stop the server:
// stop();
```

### Client-side

```javascript
import { BunInBrowser } from 'bun-in-browser/client';

const bunInBrowser = new BunInBrowser('ws://localhost:3000');

// Define your server module
const serverModule = {
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response("Hello from Bun.js in the browser!");
    }

    if (url.pathname === "/json") {
      return Response.json({ message: "This is JSON data" });
    }

    if (url.pathname === "/status") {
      const statusCode = parseInt(url.searchParams.get("code") || "404");
      return new Response(`Status: ${statusCode}`, { status: statusCode });
    }

    return new Response("Not Found", { status: 404 });
  },
};

bunInBrowser.serverModule = serverModule;

// To close the connection:
// bunInBrowser.close();
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

#### `new BunInBrowser(wsUrl)`

Creates a new BunInBrowser instance.

- `wsUrl`: The WebSocket URL to connect to

#### `bunInBrowser.serverModule`

Set this property to your Bun.js server module object. The module should have:
- `fetch(req)`: A function that handles incoming requests and returns a Response object

#### `bunInBrowser.close()`

Closes the WebSocket connection.

## Features

- Run Bun.js-style servers in the browser
- WebSocket-based communication between browser and server
- Support for various HTTP methods (GET, POST, etc.)
- JSON response handling
- Custom status codes
- Optional subdomain-based client identification

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

## License

MIT