# 0003 — Give Claude tools to look at the world, not only read about it

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Claude could see the user's photos and crop them, but everything else it learned came as text: `WebFetch` and `web_fetch` return page text, never images. To check a hypothesis such as "this church is St. Martin in Endingen", it searched for descriptions of churches and geocoded street names one by one. A single run made more than 30 searches and about 80 Nominatim requests without once looking at a picture of a candidate. Interactive Claude Code can open images; the headless run could not.

## Decision

1. Six research tools live in `shared/research/` and serve both engines: `geocode`, `find_places`, `find_photos`, `fetch_image`, `satellite_view`, `horizon_profile`. Their descriptions live in `shared/tools.ts`, the method that uses them in `shared/prompt.ts`.
2. Tools return text and image URLs. The Claude Code engine downloads each image in the MCP reporter (`server/remoteImage.ts`) and sends it as image content. The API engine sends URL image sources that the Anthropic API downloads, so the page needs no access to image hosts; if the API cannot fetch one, every URL image of the conversation is replaced by a note and the turn is sent again.
3. A `ResearchSession` per analysis validates inputs, answers an identical repeated call from memory, and caps calls per tool (12 to 40), so a run cannot loop on one service.
4. Services, all free and called only while an analysis runs:

    | Tool              | Service                                   | Key  |
    | ----------------- | ----------------------------------------- | ---- |
    | `geocode`         | OpenStreetMap Nominatim (≥ 1.1 s spacing) | none |
    | `find_places`     | Overpass API, `overpass-api.de` (≥ 1 s)   | none |
    | `find_photos`     | Wikimedia Commons API                     | none |
    | `satellite_view`  | Esri World Imagery export                 | none |
    | `horizon_profile` | Open-Meteo elevation (Copernicus DEM)     | none |
    | `fetch_image`     | the https URL Claude chose                | none |

5. A seventh tool, `street_level` (Mapillary, with the user's token), was removed: its coverage was too thin to be useful. A token remembered by an earlier version is cleared from `localStorage` at startup.
6. `zoom_image` gains `enhance`, a contrast stretch between the 1st and 99th luminance percentiles (sharp `normalise` on the server, the same stretch on a canvas in the browser).

## Alternatives considered

| Option                              | Advantages                       | Drawbacks                                                                                                                                                                                 |
| ----------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Street View Static API       | Best street-level coverage       | Paid key; Maps Platform terms §3.2.3(e) forbid using the services "with or near a non-Google Map" (Chizu shows Esri imagery), §3.2.3(b) forbids caching (job transcripts keep the images) |
| Headless browser on Google Maps     | No key                           | Scraping Google Maps content is forbidden (§3.2.3(a)); later offered as an explicit opt-in, see `0004-code-and-browser.md`                                                                |
| Downloading images in the browser   | Works with any API image request | Needs CORS from every host and a `connect-src` open to the whole web                                                                                                                      |
| Letting Claude write Overpass QL    | Most flexible                    | Error-prone; filters only keeps one bounded `around` search                                                                                                                               |
| Prompt-only limits on repeated work | No code                          | The log showed the model repeating identical lookups despite the prompt                                                                                                                   |

## Consequences

- `connect-src` adds `overpass-api.de`, `commons.wikimedia.org` and `api.open-meteo.com` for the API engine (`server/csp.ts`). Image hosts are not added: the API downloads them.
- These services see the coordinates and words Claude queries, which come from the user's photo. `SECURITY.md` records it.
- `fetch_image` on the Claude Code engine downloads URLs that may come from prompt-injected pages. It accepts https only, refuses hosts that resolve to loopback, private or link-local addresses (checked again on each redirect), caps the size, and returns only bytes that decode as an image.
- Overpass is slow under load (up to a minute); its calls get a 60 s timeout.
