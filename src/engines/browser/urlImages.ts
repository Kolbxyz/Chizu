// Research images in the API engine: sent as URL image sources that the API
// downloads, so the browser needs no access to the image hosts.
import type Anthropic from "@anthropic-ai/sdk";
import type { ResearchPart } from "../../../shared/research/types.ts";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ToolContent = Exclude<Anthropic.Beta.BetaToolResultBlockParam["content"], string | undefined>;

export function toToolContent(parts: ResearchPart[]): ToolContent {
  return parts.map((part) =>
    part.type === "text"
      ? { type: "text", text: part.text }
      : { type: "image", source: { type: "url", url: part.url } },
  );
}

/**
 * Replaces every URL image of the conversation by a short note. The API fetches
 * them again on each request, and a stale or blocked URL fails the whole request.
 * Returns whether anything was replaced.
 */
export function dropUrlImages(messages: MessageParam[]): boolean {
  let changed = false;
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (block.type !== "tool_result" || !Array.isArray(block.content)) continue;
      block.content = block.content.map((item) => {
        if (item.type !== "image" || item.source.type !== "url") return item;
        changed = true;
        return { type: "text", text: `(Image no longer available: ${item.source.url})` };
      });
    }
  }
  return changed;
}
