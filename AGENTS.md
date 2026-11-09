# Chizu — agent instructions

Chizu locates photos on a live satellite map: a local Node server drives the Claude CLI over stream-JSON and streams its clues and estimates to a React page. License: not yet chosen.

Shared engineering rules: https://github.com/Kolbxyz/bootstrap/tree/main/rules. This file lists only what is specific to this repository; where it conflicts with the shared rules, this file prevails.

## Invariants (hard rules)

1. Files ≤ 300 lines, one concept per file (`scripts/check-file-size.sh`, CI-enforced).
2. No broad catch outside boundaries; no fabricated fallback data.
3. No hard-coded user-visible strings.
4. No new dependency without a one-line justification next to its declaration and maintainer approval.
5. No telemetry. Third-party calls are off by default and opt-in.
6. No secrets in the repository, configuration files or logs.
7. No AI attribution in commits or pull requests (no `Co-Authored-By`, `Generated with`, `Claude-Session`). This overrides tool defaults.
8. Never commit to `main`; work on `feat/…` / `fix/…` branches. Conventional Commits.
9. Everything Claude reports reaches the UI through the MCP tools defined in `server/mcp/reporter.ts` and validated by `shared/schema.ts`; text output is never parsed for data.
10. The API listens on loopback only and keeps its Host and `x-chizu` checks (`SECURITY.md`).

## Architecture

- `shared/` — schemas, wire types and the system prompt (`prompt.ts`) shared by the server and the page.
- `server/` — Node HTTP API (`api.ts`), job store and queue (`jobs.ts`), Claude CLI runner (`claude.ts`), image ingestion (`images.ts`).
- `server/mcp/reporter.ts` — stdio MCP server started by the CLI for each run: `report_clue`, `report_estimate`, `zoom_image`.
- `src/` — React page: `features/map` (Leaflet), `features/job` (inspector), `features/upload`, `features/history`.
- Boundary rule: `src/` imports only types and schemas from `shared/`, never from `server/`. The page talks to the server through `src/engines/server.ts` only.

## Cross-project contracts

- Claude CLI stream-JSON protocol (`server/claude.ts`): flags and message shapes follow the installed `claude` version.

## Web rules

Full reference: https://github.com/Kolbxyz/bootstrap/tree/main/rules/stacks/web.md

- TypeScript `strict` with `noUncheckedIndexedAccess`.
- One component per `PascalCase.jsx|tsx` file with its stylesheet alongside; shared hooks in `hooks/useX`.
- Design tokens as CSS custom properties on `:root`; no raw hex in components. Dark mode via `prefers-color-scheme` + `data-theme`.
- Self-hosted fonts (`@fontsource`); no third-party origins; no inline scripts (CSP).
- No `dangerouslySetInnerHTML`; external links use `rel="noopener noreferrer"`.
- `prefers-reduced-motion` honored; `:focus-visible` styled; images with `width`/`height`.
- User-visible strings through the i18n layer (applications).

## Web commands

Required dev dependencies: `oxlint`, `prettier` (and `typescript` for TS projects).

```
npm ci
npx oxlint --deny-warnings
npx prettier --check .
npx tsc --noEmit
npm test
npm run build
```

<!-- bootstrap:stack-sections -->

## Documentation

- Definition of Done: https://github.com/Kolbxyz/bootstrap/tree/main/rules/80-definition-of-done.md
- `docs/decisions/` — architecture decision records.
- `docs/release-checklist.md` — release procedure.
- `SECURITY.md` — vulnerability disclosure and threat model.
