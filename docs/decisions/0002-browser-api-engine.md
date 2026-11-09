# 0002 — Run the API engine in the browser with the user's own key

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Chizu must work on GitHub Pages, which serves static files only, as well as locally. Locally, the Claude Code CLI runs analyses on the user's Claude subscription. A static host cannot run the CLI or hold a server-side secret, and a key embedded in the bundle would be public.

The shared web rules forbid storing session tokens in `localStorage` or `sessionStorage`, and require third-party calls to be opt-in.

## Decision

1. Analyses run on one of two engines behind the `Engine` interface (`src/engines/types.ts`):
    - `cc`: the local Node server and the Claude Code CLI;
    - `api`: the Anthropic Messages API, called from the browser with `@anthropic-ai/sdk` (`dangerouslyAllowBrowser`).
2. The page probes `GET /api/health` at load. Claude Code is selectable only when the server answers and finds the CLI; otherwise the API engine is the only choice.
3. The API key belongs to the user. It is held in memory by default and written to `localStorage` only when the user ticks "Remember on this device". It is sent only to `api.anthropic.com`.
4. The API engine keeps its jobs, conversations and photos in IndexedDB on the device.
5. Coordinates are verified through a client-side `geocode` tool that calls OpenStreetMap Nominatim, because the API `web_fetch` tool only opens URLs already present in the conversation. Calls are spaced by more than one second, per the Nominatim usage policy.
6. Default model: Claude Opus 5.5, effort `high`, adaptive thinking with progress updates, server-side refusal fallback `default`.

## Alternatives considered

| Option                                    | Advantages                             | Drawbacks                                                   |
| ----------------------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| Proxy server holding the maintainer's key | Key never in the browser               | Needs hosting; anyone could spend the maintainer's credit   |
| Key in `sessionStorage` only              | Survives reloads, cleared with the tab | Still web storage; no gain over memory for the threat model |
| Key in memory only                        | Nothing persisted                      | Re-entering the key on every visit                          |

## Consequences

- The `localStorage` exception covers only the user's own API key and only on explicit opt-in. Any script running on the page could read it; the Content Security Policy (`server/csp.ts`, also emitted as a `<meta>` tag in static builds) allows scripts from the page's own origin only.
- `connect-src` allows `https://api.anthropic.com` and `https://nominatim.openstreetmap.org`. Both calls happen only when the user runs an API analysis. The research services added later are listed in `0003-research-tools.md`.
- API analyses are billed to the user's API account; the panel shows an estimate computed from `src/engines/browser/pricing.ts`, which must follow price changes.
