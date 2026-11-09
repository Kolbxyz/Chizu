# Chizu 地図

Chizu locates photos on a live satellite map. A photo is uploaded; Claude reads its metadata, studies its details, searches the web, and narrows the location step by step. Each estimate appears on the map as uncertainty circles that shrink and move, from a country down to the spot where the photographer stood.

## Features

- **Live narrowing.** Every estimate is published through an MCP tool and animated on the map: circle radius, centre and confidence, with several hypotheses while the evidence is ambiguous.
- **Metadata first.** EXIF GPS position, compass heading, date and camera are extracted and shown; the GPS position is displayed as a separate pin with a heading cone.
- **Visual investigation.** Claude zooms into the full-resolution original to read signs and plates, and verifies coordinates with web searches and OpenStreetMap Nominatim.
- **Clues and trace.** Each observation appears as a categorised clue; searches, pages read and zooms are listed in the investigation log.
- **Replay.** A timeline scrubber replays how the location narrowed down.
- **Hints.** A hint can be sent during or after an analysis; the Claude session resumes with it.
- **Several photos.** Photos are analysed separately, or together when they show the same place.
- **History.** Analyses persist under `data/` and survive restarts.
- Satellite and street layers, light and dark themes, English and French, drag and drop anywhere, paste with Ctrl+V, links to Google Maps, Street View and OpenStreetMap.

## Requirements

- Node.js 22.18 or later.
- The [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) installed and signed in (`claude` on the `PATH`). Every analysis consumes Claude usage; the cost of each run is displayed.

## Usage

```
npm ci
npm run dev        # http://127.0.0.1:5173 — page and API in one process
```

Production:

```
npm run build
npm start          # http://localhost:8787
```

| Variable            | Default     | Effect                               |
| ------------------- | ----------- | ------------------------------------ |
| `PORT`              | `8787`      | Production server port               |
| `CHIZU_DATA`        | `./data`    | Directory holding photos and results |
| `CHIZU_MODEL`       | CLI default | Model passed to `claude --model`     |
| `CHIZU_CONCURRENCY` | `2`         | Analyses running at the same time    |
| `CHIZU_CLAUDE_BIN`  | `claude`    | Path of the Claude CLI               |

## How it works

```
browser ──multipart──▶ server/api.ts ──▶ server/jobs.ts (queue, data/)
   ▲                                          │
   └──── Server-Sent Events ◀── job events ◀──┤
                                              ▼
                     claude -p --input-format stream-json --output-format stream-json
                       │  photos + metadata on stdin, events on stdout
                       ├── WebSearch, WebFetch
                       └── MCP server/mcp/reporter.ts: report_clue, report_estimate, zoom_image
```

The server reads the MCP tool calls from the CLI's output stream, validates them against `shared/schema.ts`, stores them as job events and pushes them to the page.

## Development

```
npx oxlint --deny-warnings
npx prettier --check .
npx tsc -b
npm test
npm run build
```

Map imagery: © Esri, Maxar, Earthstar Geographics; street map: © OpenStreetMap contributors, © CARTO.
