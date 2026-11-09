// Stdio MCP server started by the Claude CLI for one job. The report tools only
// acknowledge the call: the API server reads their validated inputs from
// Claude's output stream. The zoom tool crops the job's original images, and the
// research tools (shared/research) look at maps, photos and terrain.
// Usage: node reporter.ts <job-dir> <image-count>
// Environment: CHIZU_MAPILLARY_TOKEN enables street-level imagery, CHIZU_WORK_DIR
// the view_image tool (sandboxed code), CHIZU_BROWSER=1 the browser.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { clueShape, estimateShape, zoomShape } from "../../shared/schema.ts";
import { CLUE_REPLY, TOOL_DESCRIPTIONS, estimateReply } from "../../shared/tools.ts";
import { registerBrowserTools } from "./browser.ts";
import { registerResearchTools } from "./research.ts";
import { registerViewImage } from "./viewImage.ts";

/** Identifies Chizu to the public services, as their usage policies ask. */
const USER_AGENT = "Chizu/0.1 (+https://github.com/Kolbxyz/Chizu)";

const [jobDir, countArg] = process.argv.slice(2);
const imageCount = Number(countArg);
if (!jobDir || !Number.isInteger(imageCount) || imageCount < 1) {
  throw new Error("usage: reporter.ts <job-dir> <image-count>");
}

const server = new McpServer({ name: "chizu", version: "0.1.0" });

server.registerTool(
  "report_clue",
  {
    description: TOOL_DESCRIPTIONS.clue,
    inputSchema: clueShape,
  },
  () => ({ content: [{ type: "text", text: CLUE_REPLY }] }),
);

server.registerTool(
  "report_estimate",
  {
    description: TOOL_DESCRIPTIONS.estimate,
    inputSchema: estimateShape,
  },
  ({ level }) => ({
    content: [
      {
        type: "text",
        text: estimateReply(level),
      },
    ],
  }),
);

server.registerTool(
  "zoom_image",
  {
    description: TOOL_DESCRIPTIONS.zoom,
    inputSchema: { ...zoomShape, image: zoomShape.image.max(imageCount) },
  },
  async ({ image, ...crop }) => {
    // Loaded on first use: sharp is slow to load, and the CLI waits for this server to start.
    const { cropOriginal } = await import("../images.ts");
    const jpeg = await cropOriginal(jobDir, image - 1, crop);
    return { content: [{ type: "image", data: jpeg.toString("base64"), mimeType: "image/jpeg" }] };
  },
);

registerResearchTools(server, {
  signal: new AbortController().signal, // The CLI ends a run by stopping this process.
  headers: { "user-agent": USER_AGENT },
  mapillaryToken: process.env.CHIZU_MAPILLARY_TOKEN || undefined,
});

if (process.env.CHIZU_WORK_DIR) registerViewImage(server, process.env.CHIZU_WORK_DIR);
const browser = process.env.CHIZU_BROWSER === "1" ? registerBrowserTools(server) : undefined;

// The CLI closes stdin when the run ends; take the browser down with this process.
server.server.onclose = () => {
  void (browser?.close() ?? Promise.resolve()).finally(() => process.exit(0));
};
await server.connect(new StdioServerTransport());
