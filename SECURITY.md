# Security policy

## Reporting a vulnerability

Vulnerabilities are reported privately through GitHub's **Report a vulnerability** button (Security tab) or by e-mail to contact@kolbxyz.xyz. Public issues must not be used.

| Step                   | Target                           |
| ---------------------- | -------------------------------- |
| Acknowledgement        | within 7 days                    |
| Assessment             | within 14 days                   |
| Coordinated disclosure | at most 90 days after the report |

There is no bug bounty.

## Supported versions

Only the latest release and `main` receive security fixes.

## Threat model

Chizu is a single-user tool. It runs on the user's machine, or as a static page (GitHub Pages) that offers only the API engine.

- **Assets:** the uploaded photos and their metadata (under `data/` for Claude Code, in IndexedDB for the API engine), the user's API key, and the Claude or API usage that every analysis consumes.
- **Trust boundaries:**
    - Browser ↔ local server: the server listens on `127.0.0.1` only, rejects requests whose `Host` is not a loopback name (DNS rebinding), and requires an `x-chizu: 1` header on every write, which a cross-site page cannot send without a CORS preflight that the server never grants.
    - Server ↔ Claude CLI: the CLI runs with a fixed system prompt, in an empty working directory, with only `WebSearch`, `WebFetch`, the Chizu MCP tools and, where the sandbox can run, a sandboxed `Bash`; it has no file-system tools.
    - Claude CLI ↔ the user's machine (sandboxed code): `Bash` runs only inside Claude Code's sandbox (bubblewrap/socat or Seatbelt), with no unsandboxed fallback; it cannot read the user's home, the data directory or `/mnt`, writes only in the job's working directory, and reaches only the research services. `view_image` refuses paths, symlinks included, outside that directory (`docs/decisions/0004-code-and-browser.md`).
    - Browser ↔ the web (Claude Code engine, opt-in): a profile-less Chromium, shown as a window when a display exists, whose traffic, loopback included, goes through a proxy that refuses non-public addresses and connects to the address it checked; service workers, downloads and pop-ups are blocked. Pages may contain prompt injection; the browser holds no credentials to steal.
    - MCP reporter ↔ the web (Claude Code engine): `fetch_image` and the other research tools download images from URLs that may come from prompt-injected pages. Only https URLs are fetched; hosts resolving to loopback, private or link-local addresses are refused, again after each redirect; the size is capped; and only bytes that decode as an image reach Claude (`server/remoteImage.ts`).
    - Claude output ↔ browser: web pages read by Claude may contain prompt injection. Tool inputs are validated against `shared/schema.ts`, and all Claude text is rendered as React text nodes, never as HTML.
    - Browser ↔ Anthropic API (API engine): the user's own key is held in memory, or in `localStorage` when the user ticks "Remember on this device", and is sent only to `api.anthropic.com`. The Content Security Policy limits scripts to the page's origin and network calls to the API, the research services and the tile providers (`docs/decisions/0002-browser-api-engine.md`).
    - Engines ↔ research services: during an analysis, place names, words and coordinates chosen by Claude are sent to OpenStreetMap Nominatim, the Overpass API, Wikimedia Commons, Esri and Open-Meteo (`docs/decisions/0003-research-tools.md`). The API engine sends research images as URLs that the Anthropic API downloads.
    - Browser ↔ tile providers: satellite and street tiles are loaded from Esri and CARTO. Tile requests reveal the viewed map area to those providers (`docs/decisions/0001-runtime-dependencies.md`).
- **Out of scope:** other local users or processes on the same machine, and the privacy policies of Anthropic, Esri, CARTO, OpenStreetMap, Wikimedia and Open-Meteo.
