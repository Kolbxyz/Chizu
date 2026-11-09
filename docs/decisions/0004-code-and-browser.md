# 0004 — Sandboxed code and a browser for Claude Code runs

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

With the research tools (`0003`), runs still fell short of interactive Claude Code on precise locations. A run on an Alsace vineyard photo ended at 30% confidence on Dambach-la-Ville because it could neither measure (bearings, sun, perspective) nor stand at the candidate viewpoint in Street View. Interactive Claude Code does both: it runs code, and with a browser it opens Google Maps. Mapillary coverage was too thin for the maintainer's photos.

## Decision

1. **Code.** On the Claude Code engine, runs get the CLI's `Bash` tool inside Claude Code's own sandbox (bubblewrap and socat on Linux and WSL2, Seatbelt on macOS), passed with `--settings` (`server/sandbox.ts`):
    - `failIfUnavailable` and `allowUnsandboxedCommands: false`: no unsandboxed fallback, no escape hatch;
    - reads of `~/`, the data directory and `/mnt` (Windows drives under WSL) denied, except the job's working directory and the optional Python environment;
    - writes only in the job's working directory `data/work/<job>/`, which holds full-resolution copies of the photos;
    - network limited to the research services, strict allowlist.

    Bash is offered only when the sandbox can run; the settings dialog says why when it cannot. Claude looks at images its code writes with `view_image`, which resolves symlinks and refuses paths outside the working directory. `scripts/setup-python.sh` optionally installs OpenCV, scikit-image, matplotlib and astral into `data/python`, put first on `PATH`.

2. **Browser.** On the Claude Code engine, and only when the user ticks it in Settings (off by default), the reporter offers `street_view` and `browser_*` tools backed by Chromium through `playwright-core` (`server/browser/`), opened as a visible window: on the machine's display (WSLg, X11, Wayland, macOS, Windows), or on an Xvfb virtual display Chizu starts when there is none (`server/browser/display.ts`, needs the `xvfb` package), and headless only when neither exists:
    - a fresh context per run: no cookies, no accounts, service workers and downloads blocked, pop-ups closed;
    - all traffic, loopback included (`<-loopback>` bypass rule), goes through a loopback proxy that resolves each destination, refuses non-public addresses and ports other than 80 and 443, and connects to the address it checked (`server/browser/proxy.ts`); WebRTC may not use unproxied UDP;
    - Google's EU consent page is answered with "Reject all";
    - at most 150 browser actions per run; the prompt forbids signing in, solving CAPTCHAs and submitting personal data, and tells Claude to stop when a site blocks automated use.

3. The API engine is unchanged: a browser page can run neither a sandbox nor Chromium.

## Google's terms

Google's Terms of Service and the Google Maps Platform terms (§3.2.3(a), no scraping) do not allow automated access to Google Maps content. The maintainer chose to offer the browser anyway, for personal use, as an explicit opt-in whose settings text states this. Chizu does not disguise the browser, rotate identities, or work around bot detection; if Google blocks it, the tool fails.

In practice Google withholds its own car imagery from headless Chromium: tiles answer `403 The caller does not have permission` and only user-uploaded 360° photos render. The same Chromium run as a visible window, unmodified (it still reports itself as automated), gets the full imagery, so the browser opens a window whenever it can, on a virtual display if needed; this is what makes `street_view` usable. `street_view` still detects a black panorama (no coverage, or headless) and says so.

Every reply on Google Maps carries the position its URL records: the map centre, or the exact panorama position and heading in Street View. Claude publishes that position as the exact estimate once a panorama matches, rather than estimating coordinates itself. `browser_read` returns the page's visible text (addresses, capture dates), labelled as untrusted web content.

## Alternatives considered

| Option                        | Advantages             | Drawbacks                                                                   |
| ----------------------------- | ---------------------- | --------------------------------------------------------------------------- |
| Unsandboxed `Bash`            | Nothing to install     | A prompt-injected page could run commands on the user's machine             |
| Docker container per run      | Strong isolation       | Docker required; slow start; duplicates what the CLI already provides       |
| `@playwright/mcp` server      | No browser code to own | Large page snapshots per action; no address filtering; extra moving process |
| Google Street View Static API | Official               | Paid key; §3.2.3(e) forbids use next to a non-Google map                    |
| Claude in Chrome (`--chrome`) | The user's own browser | Signed-in sessions exposed to injected pages; needs the user's Chrome open  |

## Consequences

- `playwright-core` is a new runtime dependency (`0001`); Chromium is installed separately with `npm run setup:browser`.
- Code runs on the user's machine with the user's CPU; a run may take longer (the run timeout is now 30 minutes).
- Resumed jobs created before per-job working directories keep the shared directory and run without code.
- `SECURITY.md` records the two new boundaries.
