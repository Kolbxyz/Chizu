// Registers the browser tools on the reporter's MCP server. Enabled
// only when the user turned the browser on for the analysis.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  BROWSER_SCHEMAS,
  BROWSER_TOOL_NAMES,
  mapPosition,
  type BrowserToolName,
} from "../../shared/browser.ts";
import {
  BROWSER_DESCRIPTIONS,
  STREET_VIEW_WITHHELD,
  browserBudgetExhausted,
  pageTextNotice,
  positionNotice,
} from "../../shared/tools.ts";
import { BrowserSession, type Snapshot } from "../browser/session.ts";

const BUDGET = 150;

type Input = Record<string, unknown> & { wait_ms?: number };

export function registerBrowserTools(server: McpServer): BrowserSession {
  const session = new BrowserSession();
  let used = 0;
  for (const name of BROWSER_TOOL_NAMES) {
    server.registerTool(
      name,
      { description: BROWSER_DESCRIPTIONS[name], inputSchema: BROWSER_SCHEMAS[name].shape },
      async (raw: unknown) => {
        if (++used > BUDGET) return failure(browserBudgetExhausted(BUDGET));
        const parsed = BROWSER_SCHEMAS[name].safeParse(raw);
        if (!parsed.success) return failure(parsed.error.message);
        try {
          if (name === "street_view") {
            const view = await session.streetView(
              parsed.data as Parameters<BrowserSession["streetView"]>[0],
            );
            return view.rendered ? reply(view) : failure(STREET_VIEW_WITHHELD);
          }
          if (name === "browser_read") {
            const { max_chars } = parsed.data as { max_chars?: number };
            const page = await session.read(max_chars ?? 6000);
            return {
              content: [
                { type: "text" as const, text: header(page) },
                { type: "text" as const, text: `${pageTextNotice}\n${page.text}` },
              ],
            };
          }
          return reply(await act(session, name, parsed.data as Input));
        } catch (err) {
          // Tool boundary: navigation errors and timeouts are reported to Claude.
          return failure(
            `Browser action failed: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
          );
        }
      },
    );
  }
  return session;
}

function act(
  session: BrowserSession,
  name: Exclude<BrowserToolName, "street_view" | "browser_read">,
  v: Input,
): Promise<Snapshot> {
  const n = (key: string) => Number(v[key]);
  switch (name) {
    case "browser_open":
      return session.open(String(v.url), v.wait_ms);
    case "browser_click":
      return session.click(n("x"), n("y"), v.wait_ms);
    case "browser_drag":
      return session.drag([n("from_x"), n("from_y")], [n("to_x"), n("to_y")], v.wait_ms);
    case "browser_scroll":
      return session.scroll(n("x"), n("y"), n("delta"), v.wait_ms);
    case "browser_type":
      return session.type(String(v.text), v.submit === true, v.wait_ms);
    case "browser_key":
      return session.key(String(v.key), v.wait_ms);
  }
}

/** URL and title, plus the exact position Google Maps records in its URL. */
function header({ url, title }: { url: string; title: string }): string {
  const position = mapPosition(url);
  return [url, title, ...(position ? [positionNotice(position)] : [])].join("\n");
}

const reply = (snapshot: Snapshot) => ({
  content: [
    { type: "text" as const, text: header(snapshot) },
    { type: "image" as const, data: snapshot.image, mimeType: "image/jpeg" },
  ],
});

const failure = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });
