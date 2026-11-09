// view_image: lets Claude look at images its sandboxed code wrote. Paths are
// resolved, symlinks included, and must stay inside the job's working directory.
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VIEW_IMAGE_DESCRIPTION } from "../../shared/tools.ts";

/** Whether `target` is `root` or inside it; exported for tests. */
export function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function registerViewImage(server: McpServer, workDir: string): void {
  server.registerTool(
    "view_image",
    { description: VIEW_IMAGE_DESCRIPTION, inputSchema: { path: z.string().min(1).max(500) } },
    async ({ path }) => {
      const root = await realpath(workDir);
      const target = await realpath(resolve(root, path)).catch(() => undefined);
      if (!target || !isInside(root, target)) {
        return {
          content: [{ type: "text", text: `No such file in the working directory: ${path}` }],
          isError: true,
        };
      }
      // Loaded on first use: sharp is slow to load, and the CLI waits for this server to start.
      const { toViewJpeg } = await import("../images.ts");
      const jpeg = await toViewJpeg(target).catch(() => undefined);
      if (!jpeg)
        return {
          content: [{ type: "text", text: `${path} is not a readable image.` }],
          isError: true,
        };
      return {
        content: [{ type: "image", data: jpeg.toString("base64"), mimeType: "image/jpeg" }],
      };
    },
  );
}
