// Registers the shared research tools on the reporter's MCP server. Image URLs
// returned by a tool are downloaded here and sent to Claude as image content.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RESEARCH_TOOLS, ResearchSession } from "../../shared/research/session.ts";
import type { ResearchContext, ResearchPart } from "../../shared/research/types.ts";

type Content =
  { type: "text"; text: string } | { type: "image"; data: string; mimeType: "image/jpeg" };

export function registerResearchTools(server: McpServer, ctx: ResearchContext): void {
  const session = new ResearchSession(ctx);
  for (const tool of RESEARCH_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema.shape },
      async (input: unknown) => {
        const outcome = await session.call(tool.name, input);
        const content = await Promise.all(outcome.parts.map((part) => toContent(part, ctx)));
        return { content, ...(outcome.isError ? { isError: true } : {}) };
      },
    );
  }
}

async function toContent(part: ResearchPart, ctx: ResearchContext): Promise<Content> {
  if (part.type === "text") return part;
  // Loaded on first use: sharp is slow to load, and the CLI waits for this server to start.
  const { RemoteImageError, fetchRemoteImage } = await import("../remoteImage.ts");
  try {
    return {
      type: "image",
      data: await fetchRemoteImage(part.url, ctx.headers),
      mimeType: "image/jpeg",
    };
  } catch (err) {
    if (!(err instanceof RemoteImageError)) throw err;
    return { type: "text", text: `Image could not be loaded (${err.message}): ${part.url}` };
  }
}
