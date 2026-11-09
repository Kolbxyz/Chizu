# 0001 — Admit the runtime dependencies and the map tile providers

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

The shared rules require a one-line justification for every dependency, recorded next to its declaration. `package.json` cannot hold comments, so the justifications are recorded here. The shared rules also forbid third-party calls by default; a satellite map cannot be served without a tile provider.

## Decision

| Dependency                                             | Justification                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `react`, `react-dom`                                   | UI framework of the web stack.                                                                                     |
| `leaflet`                                              | Map rendering with circles, markers and tile layers; small, dependency-free, mature.                               |
| `sharp`                                                | Image decoding, orientation, resizing and full-resolution crops for `zoom_image`; the platform has no image codec. |
| `exifr`                                                | EXIF and GPS parsing from image buffers; no runtime dependencies.                                                  |
| `@modelcontextprotocol/sdk`                            | Official MCP server implementation used to expose the reporting tools to the Claude CLI.                           |
| `zod`                                                  | Schema validation shared by the MCP tools and the server; required by the MCP SDK.                                 |
| `lucide-react`                                         | Icon set, tree-shaken per icon.                                                                                    |
| `@fontsource/hanken-grotesk`, `@fontsource/newsreader` | Self-hosted fonts (no third-party font origin).                                                                    |

Map tiles are loaded from Esri World Imagery and World Boundaries and Places (satellite view) and from CARTO basemaps (street view). They are the only third-party origins allowed by the Content Security Policy (`server/csp.ts`). The satellite map is the core feature, so these requests are on by default; the page credits the providers.

## Alternatives considered

| Option                             | Advantages                  | Drawbacks                                                       |
| ---------------------------------- | --------------------------- | --------------------------------------------------------------- |
| MapLibre GL with vector tiles      | Smooth zoom, vector styling | Heavier bundle; satellite imagery still needs a raster provider |
| Self-hosted imagery                | No third-party request      | Not feasible at world scale                                     |
| Parsing markers from Claude's text | No MCP server               | Fragile; no schema validation                                   |
| `jimp` instead of `sharp`          | Pure JavaScript             | Much slower on large photos; fewer formats                      |

## Consequences

Tile requests reveal the viewed map area to Esri and CARTO; `SECURITY.md` records it. Esri imagery is subject to Esri's terms of use, which suit personal, non-commercial use. A new dependency adds a row to this table in the same change.
