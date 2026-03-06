#!/usr/bin/env node

import http from "node:http";
import https from "node:https";
import { parseArgs } from "node:util";

const BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const { values } = parseArgs({
  options: {
    "broadcast-id": { type: "string", short: "b" },
    port: { type: "string", short: "p", default: "1337" },
    "padding-right": { type: "string", default: "0" },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: false,
});

let broadcastId = values["broadcast-id"] || "";
const port = parseInt(values.port, 10);
const paddingRight = parseInt(values["padding-right"], 10);

if (broadcastId.includes("broadcasts/")) {
  broadcastId = broadcastId.split("broadcasts/").pop().split(/[?#]/)[0];
}

if (!broadcastId || values.help) {
  console.log(`
  x-live-overlay - Live stream stats overlay for OBS

  Usage:
    npx x-live-overlay --broadcast-id <id-or-url>

  Options:
    -b, --broadcast-id  Broadcast ID or full X.com broadcast URL
    -p, --port          Port to serve on (default: 1337)
    --padding-right     Extra transparent space to the right in px (default: 0)
    -h, --help          Show this help

  Example:
    npx x-live-overlay --broadcast-id https://x.com/i/broadcasts/1RKZzjBZwOoKB
    npx x-live-overlay -b 1RKZzjBZwOoKB --padding-right 180
`);
  process.exit(values.help ? 0 : 1);
}

const panelWidth = 220;
const panelHeight = 118;
const totalWidth = panelWidth + paddingRight;
const totalHeight = panelHeight;

function apiFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.end(options.body || undefined);
  });
}

async function getGuestToken() {
  const res = await apiFetch("https://api.x.com/1.1/guest/activate.json", {
    method: "POST",
    headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
  });
  return JSON.parse(res.body).guest_token;
}

let guestToken = null;

async function getBroadcast() {
  if (!guestToken) guestToken = await getGuestToken();

  const res = await apiFetch(
    `https://api.x.com/1.1/broadcasts/show.json?ids=${broadcastId}`,
    {
      headers: {
        Authorization: `Bearer ${BEARER_TOKEN}`,
        "x-guest-token": guestToken,
      },
    }
  );

  if (res.status !== 200) {
    guestToken = null;
    throw new Error(`API returned ${res.status}`);
  }

  const data = JSON.parse(res.body);
  const broadcast = Object.values(data.broadcasts)[0];
  return {
    viewers: broadcast.total_watching || "0",
    state: broadcast.state,
    title: broadcast.status || "Untitled",
    username: broadcast.twitter_username || "unknown",
    no_hearts: broadcast.no_hearts || false,
    is_high_latency: broadcast.is_high_latency || false,
    start_ms: broadcast.start_ms || null,
  };
}

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>X Stream Viewers</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: transparent;
      font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
      width: ${totalWidth}px;
      height: ${totalHeight}px;
      overflow: hidden;
    }
    .panel {
      width: ${totalWidth}px;
      height: ${totalHeight}px;
      padding: 14px ${paddingRight + 18}px 14px 18px;
      background: rgba(0, 0, 0, 0.85);
      border-radius: 10px;
      overflow: hidden;
    }
    .row {
      display: flex;
      justify-content: space-between;
      line-height: 1.6;
      font-size: 13px;
    }
    .key {
      color: rgba(255, 255, 255, 0.5);
      white-space: nowrap;
    }
    .val {
      color: #fff;
      font-weight: 600;
      text-align: right;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="panel">
    <div class="row"><span class="key">watching</span><span class="val" id="watching">--</span></div>
    <div class="row"><span class="key">no_hearts</span><span class="val" id="no_hearts">--</span></div>
    <div class="row"><span class="key">is_high_latency</span><span class="val" id="is_high_latency">--</span></div>
    <div class="row"><span class="key">duration</span><span class="val" id="duration">--</span></div>
  </div>
  <script>
    let startMs = null;

    function formatDuration(ms) {
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
      return m + 'm ' + s + 's';
    }


    async function update() {
      try {
        const res = await fetch('/api/viewers');
        const data = await res.json();
        document.getElementById('watching').textContent = data.viewers;
        document.getElementById('no_hearts').textContent = String(data.no_hearts);
        document.getElementById('is_high_latency').textContent = String(data.is_high_latency);
        if (data.start_ms) startMs = Number(data.start_ms);
      } catch (e) {}
    }

    function tickDuration() {
      if (startMs) {
        document.getElementById('duration').textContent = formatDuration(Date.now() - startMs);
      }
    }

    update();
    setInterval(update, 10000);
    setInterval(tickDuration, 1000);
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.url === "/api/viewers") {
    try {
      const data = await getBroadcast();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  }
});

server.listen(port, () => {
  console.log(`
  x-live-overlay

  Overlay:    http://localhost:${port}
  API:        http://localhost:${port}/api/viewers
  Broadcast:  ${broadcastId}

  OBS Browser Source Setup:
  1. Sources > + > Browser
  2. URL:    http://localhost:${port}
  3. Width:  ${totalWidth}
  4. Height: ${totalHeight}
  5. Uncheck "Shutdown source when not visible"
  6. Hit "Refresh cache of current page" after restarting
`);
});
