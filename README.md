# x-live-overlay

[![npm version](https://img.shields.io/npm/v/x-live-overlay)](https://www.npmjs.com/package/x-live-overlay) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A live stream stats overlay for X.com broadcasts. Runs a local server that serves a transparent overlay page — designed to be used as an OBS browser source.

Shows real-time stream stats:
- **watching** — current viewer count
- **no_hearts** — whether hearts are disabled
- **is_high_latency** — stream latency mode
- **duration** — live-updating stream duration

Zero dependencies. Single file. Just Node.js.

## Quick Start

```sh
npx x-live-overlay --broadcast-id https://x.com/i/broadcasts/1RKZzjBZwOoKB
```

Or with a bare broadcast ID:

```sh
npx x-live-overlay -b 1RKZzjBZwOoKB
```

## OBS Setup

1. **Sources** > **+** > **Browser**
2. Set the **URL** to `http://localhost:1337`
3. Set **Width** and **Height** to the values shown in the terminal output
4. Uncheck **"Shutdown source when not visible"**
5. After restarting the server, click **"Refresh cache of current page"** in the browser source properties

## Options

```
-b, --broadcast-id  Broadcast ID or full X.com broadcast URL (required)
-p, --port          Port to serve on (default: 1337)
    --padding-right Extra transparent space to the right in px (default: 0)
-h, --help          Show help
```

### Adding space for a camera overlay

Use `--padding-right` to add transparent space to the right of the stats panel. This is useful for positioning a circular camera feed next to the overlay in OBS:

```sh
npx x-live-overlay -b 1RKZzjBZwOoKB --padding-right 120
```

The terminal output will show the exact Width/Height to use in OBS.

## API

The server also exposes a JSON endpoint:

```
GET http://localhost:1337/api/viewers
```

```json
{
  "viewers": "1",
  "state": "RUNNING",
  "title": "My Stream",
  "username": "montanaflynn",
  "no_hearts": true,
  "is_high_latency": true,
  "start_ms": "1772812895581"
}
```

Data refreshes every 10 seconds. Duration updates every second client-side.

## How it works

Uses the public X.com broadcast API (`broadcasts/show.json`) with a guest token — no API keys or authentication required. The overlay page polls the local server for updates.

## License

MIT
