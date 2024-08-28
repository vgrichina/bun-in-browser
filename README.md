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

const { httpServer, wsServer, demoServer, stop } = startReverseProxy({
  httpPort: 3000,
  wsPort: 8080,
  demoPort: 3001
});

// To stop the servers:
// stop();
```

### Client-side

```javascript
import { BunInBrowser } from 'bun-in-browser/client';

const bunInBrowser = new BunInBrowser('ws://localhost:8080');

// Define your server module
const serverModule = {
  port: 3000, // This should match the httpPort in startReverseProxy
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

## Demo

A built-in demo is available when you run the server. Simply navigate to `http://localhost:3001/demo` in your web browser after starting the server.

The demo includes a simple editor where you can write and run Bun.js server code directly in the browser. You can modify the code and make requests to `http://localhost:3000` to see the results.

## API

### Server-side

#### `startReverseProxy(options)`

Starts the reverse proxy server.

- `options.httpPort`: The port for the HTTP proxy server (default: 3000)
- `options.wsPort`: The port for the WebSocket server (default: 8080)
- `options.demoPort`: The port for the demo server (default: 3001)

Returns an object with:
- `httpServer`: The HTTP proxy server instance
- `wsServer`: The WebSocket server instance
- `demoServer`: The demo server instance
- `stop()`: Function to stop all servers

### Client-side

#### `new BunInBrowser(wsUrl)`

Creates a new BunInBrowser instance.

- `wsUrl`: The WebSocket URL to connect to

#### `bunInBrowser.serverModule`

Set this property to your Bun.js server module object. The module should have:
- `port`: The port number (should match the `httpPort` used in `startReverseProxy`)
- `fetch(req)`: A function that handles incoming requests and returns a Response object

#### `bunInBrowser.close()`

Closes the WebSocket connection.

## Features

- Run Bun.js-style servers in the browser
- WebSocket-based communication between browser and server
- Support for various HTTP methods (GET, POST, etc.)
- JSON response handling
- Custom status codes
- Demo server for easy testing and development

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