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

Chizu is a single-user tool that runs on the user's machine.

- **Assets:** the uploaded photos and their metadata (stored under `data/`), and the user's Claude usage, which every analysis consumes.
- **Trust boundaries:**
    - Browser ↔ local server: the server listens on `127.0.0.1` only, rejects requests whose `Host` is not a loopback name (DNS rebinding), and requires an `x-chizu: 1` header on every write, which a cross-site page cannot send without a CORS preflight that the server never grants.
    - Server ↔ Claude CLI: the CLI runs with a fixed system prompt, in an empty working directory, with only `WebSearch`, `WebFetch` and the Chizu MCP tools enabled; it has no shell and no file-system tools.
    - Claude output ↔ browser: web pages read by Claude may contain prompt injection. Tool inputs are validated against `shared/schema.ts`, and all Claude text is rendered as React text nodes, never as HTML.
    - Browser ↔ tile providers: satellite and street tiles are loaded from Esri and CARTO. Tile requests reveal the viewed map area to those providers (`docs/decisions/0001-runtime-dependencies.md`).
- **Out of scope:** other local users or processes on the same machine, and the privacy policies of Anthropic, Esri and CARTO.
