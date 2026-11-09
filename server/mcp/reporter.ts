// Stdio MCP server started by the Claude CLI for one job. The report tools only
// acknowledge the call: the API server reads their validated inputs from
// Claude's output stream. The zoom tool crops the job's original images.
// Usage: node reporter.ts <job-dir> <image-count>
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { clueShape, estimateShape } from "../../shared/schema.ts";
import { cropOriginal } from "../images.ts";

const [jobDir, countArg] = process.argv.slice(2);
const imageCount = Number(countArg);
if (!jobDir || !Number.isInteger(imageCount) || imageCount < 1) {
  throw new Error("usage: reporter.ts <job-dir> <image-count>");
}
const fraction = z.number().min(0).max(1);
const FINE_LEVELS = new Set(["street", "exact"]);

const server = new McpServer({ name: "chizu", version: "0.1.0" });

server.registerTool(
  "report_clue",
  {
    description:
      "Record one visual or metadata observation as soon as it is noticed. Call it for every meaningful clue.",
    inputSchema: clueShape,
  },
  () => ({ content: [{ type: "text", text: "Clue recorded." }] }),
);

server.registerTool(
  "report_estimate",
  {
    description:
      "Publish the current location estimate to the map. The first call must be at country level or coarser. Call it again at each finer level you reach (region or city, then district or street, then exact), so the user sees the area narrow down.",
    inputSchema: estimateShape,
  },
  ({ level }) => ({
    content: [
      {
        type: "text",
        text: FINE_LEVELS.has(level)
          ? "Shown on the map. Street-level and exact coordinates must come from a lookup (Nominatim, map data, a website), not from memory. If these were not verified, verify them now and publish the corrected estimate."
          : "Shown on the map. Keep refining and publish the next finer level.",
      },
    ],
  }),
);

server.registerTool(
  "zoom_image",
  {
    description:
      "Return a full-resolution crop of one photo to read small text, signs, plates or details. Coordinates are fractions of the image (0 = left/top, 1 = right/bottom).",
    inputSchema: {
      image: z.number().int().min(1).max(imageCount).describe("1-based photo number."),
      x: fraction,
      y: fraction,
      width: fraction.min(0.01),
      height: fraction.min(0.01),
    },
  },
  async ({ image, ...crop }) => {
    const jpeg = await cropOriginal(jobDir, image - 1, crop);
    return { content: [{ type: "image", data: jpeg.toString("base64"), mimeType: "image/jpeg" }] };
  },
);

await server.connect(new StdioServerTransport());
