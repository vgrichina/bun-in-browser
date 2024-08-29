# bun-in-browser

Run Bun.js-style servers in the browser with a WebSocket-based reverse proxy.

## Installation

```bash
bun add bun-in-browser
```

## Usage

### Server-side

You can start the server using the provided `app.js` script:

```bash
PORT=3000 BASE_URL=http://localhost:3000 USE_SUBDOMAINS=false bun app.js
```

Or you can use the `startReverseProxy` function in your own script:

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
- Environment variable configuration
- Graceful shutdown handling

## Development

To run tests:

```bash
bun test
```

To start the demo server:

```bash
bun run serve-demo
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