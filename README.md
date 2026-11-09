<p align="center">
  <img src="public/favicon.svg" width="96" height="96" alt="Chizu logo" />
</p>

<h1 align="center">Chizu 地図</h1>

<p align="center">
  Locates photos on a live satellite map, narrowing from a country down to the spot where the photographer stood.
</p>

<p align="center">
  <a href="https://github.com/Kolbxyz/Chizu/actions/workflows/ci-web.yml"><img src="https://github.com/Kolbxyz/Chizu/actions/workflows/ci-web.yml/badge.svg" alt="CI Status"/></a>
  <img src="https://img.shields.io/badge/license-not%20yet%20chosen-lightgrey" alt="License not yet chosen"/>
  <img src="https://img.shields.io/badge/made%20in-%F0%9F%87%AB%F0%9F%87%B7%20France-002395" alt="Made in France"/>
  <img src="https://img.shields.io/badge/powered%20by-Claude-d97757" alt="Powered by Claude"/>
</p>

<p align="center">
  <a href="#running-chizu">Getting started</a> ·
  <a href="docs/decisions/">Decisions</a> ·
  <a href="SECURITY.md">Security</a>
</p>

---

Chizu hands a photo to **Claude**, which reads its metadata, studies its details, searches the web and narrows the location step by step. Each estimate lands on the map as **uncertainty circles** that shrink and move as the evidence builds up.

Two engines run the same investigation: the **Claude Code CLI** driven by a local Node server, or the **Anthropic API** called straight from the browser with your own key. Either way, everything Claude reports reaches the page through typed tool calls, never by parsing its prose.

It locates places, never identifies people.

---

## Welcome to Chizu! (FAQ for Newcomers)

<details>
<summary><b>How does Claude find where a photo was taken?</b></summary>
<br>
The way a GeoGuessr player or an OSINT analyst would. It starts with the EXIF metadata (GPS position, compass heading, date, camera), then reads the picture itself: road markings, plates, signs, vegetation, architecture. It zooms into the full-resolution original to read small text, checks its guesses with web searches and OpenStreetMap Nominatim, and publishes a tighter estimate each time it learns something.
</details>

<details>
<summary><b>Claude Code or API key: which engine should I use?</b></summary>
<br>
<b>Claude Code</b> uses your signed-in <code>claude</code> CLI through the local server, and keeps analyses under <code>data/</code>. The <b>API</b> engine needs no server-side CLI: it calls the Anthropic API from the browser with your key (Opus 5.5 or Sonnet 5.5) and keeps its history in the browser's IndexedDB. Claude Code is offered only when the local server finds the CLI; otherwise the API engine is used.
</details>

<details>
<summary><b>What does an analysis cost?</b></summary>
<br>
Every run consumes Claude usage: your Claude Code plan, or API tokens and web searches billed to your key. The cost of each run is shown in the inspector.
</details>

<details>
<summary><b>Where do my photos and my API key go?</b></summary>
<br>
Photos go to Claude, and nowhere else. With Claude Code they are stored under <code>data/</code> on your machine; with the API engine they stay in this browser. The API key is held in memory, and saved in the browser only if you tick "remember". The page only ever connects to itself, <code>api.anthropic.com</code> and <code>nominatim.openstreetmap.org</code>, as enforced by its Content Security Policy.
</details>

<details>
<summary><b>Is it tracking me?</b></summary>
<br>
No. There is no analytics, no crash reporting and no third-party font or script. Fonts are self-hosted, and the server listens on loopback only.
</details>

<br>

---

## Key Capabilities

### Investigation

- **Live narrowing**: Every estimate (centre, radius, confidence) is animated on the map, with several hypotheses side by side while the evidence is ambiguous.
- **Metadata first**: EXIF GPS position, heading, date and camera are extracted and shown; the GPS position gets its own pin with a heading cone.
- **Visual zoom**: Claude crops the full-resolution original to read signs, plates and shopfronts, with optional contrast enhancement for haze and distant landmarks.
- **Visual verification**: Claude looks at candidates instead of reading about them: Wikimedia Commons photos near a place, satellite imagery, and any image it finds on the web.
- **Sandboxed code** (Claude Code): Claude runs Python to measure bearings, sun position, perspective and image filters, in Claude Code's sandbox with access to the photos only.
- **Google Maps and Street View** (Claude Code, opt-in): a browser window lets Claude stand at a candidate viewpoint in Street View and compare it with the photo.
- **Map data and terrain**: OpenStreetMap feature searches (every church or tower around a point) and skyline profiles computed from elevation data to test a viewpoint against visible hills.
- **Verified coordinates**: Web searches, pages read and Nominatim lookups confirm a place before it is pinned.
- **Several photos**: Analysed separately, or together when they show the same place.

### Following along

- **Clues**: Each observation appears as a categorised clue in the inspector.
- **Investigation log**: Searches, pages read, zooms, photos viewed and map lookups, listed as they happen.
- **Replay**: A timeline scrubber replays how the location narrowed down.
- **Hints**: Send a hint during or after an analysis; the session resumes with it.
- **History**: Past analyses persist and survive restarts.

### Interface

- **Satellite and street layers**, with links to Google Maps, Street View and OpenStreetMap.
- **Light and dark themes**, **English and French**.
- **Drag and drop anywhere**, or paste a photo with Ctrl+V.

---

## Privacy & Security Discipline

1. **Loopback Only**: The API binds to `127.0.0.1` and checks the `Host` header on every request and an `x-chizu` header on every write (see [`SECURITY.md`](SECURITY.md)).
2. **Strict CSP**: No inline scripts, no third-party origins beyond the Anthropic API and the research services listed in [`docs/decisions/0003-research-tools.md`](docs/decisions/0003-research-tools.md).
3. **Zero Telemetry**: No analytics, no error reporting service, no remote fonts.
4. **No Secrets on Disk by Default**: The API key stays in memory unless you choose to remember it.
5. **Places, Not People**: The system prompt tells Claude to locate places and never identify people.

---

## Architectural Principles

The codebase follows strict engineering rules documented in [AGENTS.md](AGENTS.md):

- **300 Lines Max Per File**: One concept per file, enforced in CI.
- **Tools, Not Text**: Everything Claude reports goes through `report_clue`, `report_estimate` and `zoom_image` (plus `geocode` on the API engine, since the API's `web_fetch` opens only URLs already seen), validated by `shared/schema.ts`.
- **Strict Boundaries**: The page imports only types and schemas from `shared/`, never from `server/`, and reaches the server through its engine only.
- **No Fabricated Data**: No broad catches outside boundaries, no fallback values pretending to be results.

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

```
├── shared/          Schemas, wire types, EXIF parsing, system prompt and tool texts
├── server/
│   ├── api.ts       Loopback HTTP API and Server-Sent Events
│   ├── jobs.ts      Job store and queue under data/
│   ├── claude.ts    Claude CLI runner over stream-JSON
│   ├── images.ts    Photo ingestion and display copies
│   └── mcp/         Reporter MCP server started by the CLI for each run
└── src/
    ├── engines/     Claude Code (server) and API (browser) engines
    ├── features/    map (Leaflet), job (inspector), upload, history, shell
    ├── settings/    Engine, model and API key
    ├── i18n/        English and French strings
    └── hooks/       Routing, job list and job stream
```

---

## Running Chizu

Requires **Node.js 22.18** or later. For the Claude Code engine, the [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) must be installed and signed in (`claude` on the `PATH`).

```bash
# Install dependencies
npm ci

# Development: page and API in one process, http://127.0.0.1:5173
npm run dev

# Production: http://localhost:8787
npm run build
npm start
```

| Variable            | Default     | Effect                                |
| ------------------- | ----------- | ------------------------------------- |
| `PORT`              | `8787`      | Production server port                |
| `CHIZU_DATA`        | `./data`    | Directory holding photos and results  |
| `CHIZU_MODEL`       | CLI default | Model passed to `claude --model`      |
| `CHIZU_CONCURRENCY` | `2`         | Analyses running at the same time     |
| `CHIZU_CLAUDE_BIN`  | `claude`    | Path of the Claude CLI                |
| `CHIZU_BASE`        | `/`         | Base path of the build (GitHub Pages) |

### GitHub Pages

`.github/workflows/pages.yml` builds and deploys the static page from `main`, under `/<repository>/`. There is no server there, so the settings offer only the API engine: each visitor enters their own Anthropic API key. Analyses, photos and the key (when remembered) stay in that visitor's browser.

---

## Development

```bash
npx oxlint --deny-warnings
npx prettier --check .
npx tsc -b
npm test
npm run build
```

Release steps are in [`docs/release-checklist.md`](docs/release-checklist.md).

---

## Credits & License

Map imagery: © Esri, Maxar, Earthstar Geographics; street map: © OpenStreetMap contributors, © CARTO.

License: **not yet chosen**.
