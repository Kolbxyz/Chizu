// fetch_image: shows Claude an image from the web. The engine downloads it
// (Claude Code, with a private-network guard) or passes the URL to the API.
import { z } from "zod";
import { RESEARCH_DESCRIPTIONS } from "../tools.ts";
import { defineTool } from "./types.ts";

export const imageSchema = z.object({
  url: z
    .string()
    .max(2000)
    .refine((value) => URL.canParse(value) && new URL(value).protocol === "https:", {
      message: "An https URL.",
    }),
});

export const imageTool = defineTool({
  name: "fetch_image",
  description: RESEARCH_DESCRIPTIONS.fetch_image,
  schema: imageSchema,
  budget: 40,
  describe: ({ url }) => new URL(url).host,
  run: async ({ url }) => [{ type: "image", url }],
});
