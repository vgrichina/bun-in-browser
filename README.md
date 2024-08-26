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

startReverseProxy({
  httpPort: 3000,
  wsPort: 8080
});
```

### Client-side

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bun.js in Browser Demo</title>
</head>
<body>
    <div id="output"></div>
    <script type="module">
        import { BunInBrowser } from 'bun-in-browser/client';

        const bunInBrowser = new BunInBrowser('ws://localhost:8080');

        bunInBrowser.start(`
            export default {
                port: 3000,
                fetch(req) {
                    return new Response("Hello from Bun.js in the browser!");
                },
            };
        `);
    </script>
</body>
</html>
```

## Demo

A built-in demo is available when you run the server. Simply navigate to `http://localhost:3000/demo` in your web browser after starting the server.

The demo includes a simple editor where you can write and run Bun.js server code directly in the browser. You can modify the code, click "Run Code", and then make requests to `http://localhost:3000` to see the results.

## API

### Server-side

#### `startReverseProxy(options)`

Starts the reverse proxy server.

- `options.httpPort`: The port for the HTTP server (default: 3000)
- `options.wsPort`: The port for the WebSocket server (default: 8080)

### Client-side

#### `new BunInBrowser(wsUrl)`

Creates a new BunInBrowser instance.

- `wsUrl`: The WebSocket URL to connect to

#### `bunInBrowser.start(code)`

Starts the Bun.js server in the browser with the provided code.

- `code`: A string containing the Bun.js server code

## Development

To run tests:

```bash
bun test
```

## License

MIT
