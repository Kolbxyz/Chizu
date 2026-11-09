// Stdio MCP server started by the Claude CLI for one job. The report tools only
// acknowledge the call: the API server reads their validated inputs from
// Claude's output stream. The zoom tool crops the job's original images.
// Usage: node reporter.ts <job-dir> <image-count>
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { clueShape, estimateShape } from "../../shared/schema.ts";
import { CLUE_REPLY, TOOL_DESCRIPTIONS, estimateReply } from "../../shared/tools.ts";

const [jobDir, countArg] = process.argv.slice(2);
const imageCount = Number(countArg);
if (!jobDir || !Number.isInteger(imageCount) || imageCount < 1) {
  throw new Error("usage: reporter.ts <job-dir> <image-count>");
}
const fraction = z.number().min(0).max(1);

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
    inputSchema: {
      image: z.number().int().min(1).max(imageCount).describe("1-based photo number."),
      x: fraction,
      y: fraction,
      width: fraction.min(0.01),
      height: fraction.min(0.01),
    },
  },
  async ({ image, ...crop }) => {
    // Loaded on first use: sharp is slow to load, and the CLI waits for this server to start.
    const { cropOriginal } = await import("../images.ts");
    const jpeg = await cropOriginal(jobDir, image - 1, crop);
    return { content: [{ type: "image", data: jpeg.toString("base64"), mimeType: "image/jpeg" }] };
  },
);

await server.connect(new StdioServerTransport());
