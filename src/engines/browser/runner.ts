// Agent loop of the API engine: calls the Messages API from the browser, runs
// the reporting tools locally and turns every step into job events.
import Anthropic, { BadRequestError } from "@anthropic-ai/sdk";
import { z } from "zod";
import type { JobEvent } from "../../../shared/job.ts";
import { API_TOOLS, systemPrompt } from "../../../shared/prompt.ts";
import {
  RESEARCH_TOOLS,
  describeCall,
  probeCall,
  isResearchTool,
  type ResearchSession,
} from "../../../shared/research/session.ts";
import { clueSchema, estimateSchema, zoomSchema } from "../../../shared/schema.ts";
import { CLUE_REPLY, TOOL_DESCRIPTIONS, estimateReply } from "../../../shared/tools.ts";
import { cropImage } from "./images.ts";
import { dropUrlImages, toToolContent } from "./urlImages.ts";
import { emptyUsage, estimateCost, type ApiModel } from "./pricing.ts";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;
type EventBody = JobEvent extends infer E ? (E extends JobEvent ? Omit<E, "t"> : never) : never;

const MAX_TURNS = 40;
const BETAS = ["server-side-fallback-2026-07-01", "thinking-display-updates-2026-08-18"];

const jsonSchema = (schema: z.ZodType) => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest as Anthropic.Beta.BetaTool.InputSchema;
};

function tools(imageCount: number): Anthropic.Beta.BetaToolUnion[] {
  return [
    {
      name: "report_clue",
      description: TOOL_DESCRIPTIONS.clue,
      input_schema: jsonSchema(clueSchema),
    },
    {
      name: "report_estimate",
      description: TOOL_DESCRIPTIONS.estimate,
      input_schema: jsonSchema(estimateSchema),
    },
    {
      name: "zoom_image",
      description: `${TOOL_DESCRIPTIONS.zoom} Photos are numbered 1 to ${imageCount}.`,
      input_schema: jsonSchema(zoomSchema),
    },
    ...RESEARCH_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: jsonSchema(tool.schema),
    })),
    { type: "web_search_20260209", name: "web_search", max_uses: 10 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 15 },
  ];
}

export interface RunContext {
  client: Anthropic;
  model: ApiModel;
  messages: MessageParam[];
  imageCount: number;
  original: (index: number) => Promise<Blob>;
  research: ResearchSession;
  emit: (event: EventBody) => void;
  /** Persists the conversation after each turn, so a later hint can resume it. */
  save: (messages: MessageParam[]) => Promise<void>;
  /** Hints received during the run, consumed at the next turn. */
  takeHints: () => string[];
  signal: AbortSignal;
}

export async function runConversation(ctx: RunContext): Promise<void> {
  const started = performance.now();
  const usage = emptyUsage();
  let turns = 0;
  try {
    for (; turns < MAX_TURNS; turns += 1) {
      appendHints(ctx);
      const message = await requestTurn(ctx);
      usage.input += message.usage.input_tokens;
      usage.output += message.usage.output_tokens;
      usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      usage.webSearches += message.usage.server_tool_use?.web_search_requests ?? 0;

      ctx.messages.push({ role: "assistant", content: message.content });
      const results = await handleBlocks(ctx, message.content);
      if (results.length > 0) ctx.messages.push({ role: "user", content: results });
      await ctx.save(ctx.messages);

      if (message.stop_reason === "refusal") {
        throw new Error(`refused (${message.stop_details?.category ?? "policy"})`);
      }
      if (message.stop_reason === "pause_turn" || results.length > 0) continue;
      break;
    }
  } finally {
    ctx.emit({
      kind: "usage",
      costUsd: estimateCost(ctx.model, usage),
      turns: turns + 1,
      durationMs: Math.round(performance.now() - started),
    });
  }
}

/**
 * Research images are sent as URLs that the API downloads. When one cannot be
 * fetched the API rejects the whole request; the images are then replaced by a
 * note and the turn is sent again.
 */
async function requestTurn(ctx: RunContext) {
  const send = () =>
    ctx.client.beta.messages
      .stream(
        {
          model: ctx.model,
          max_tokens: 32000,
          betas: BETAS,
          fallbacks: "default",
          thinking: { type: "adaptive", display: "updates" },
          output_config: { effort: "high" },
          cache_control: { type: "ephemeral" },
          system: systemPrompt(API_TOOLS),
          tools: tools(ctx.imageCount),
          messages: ctx.messages,
        },
        { signal: ctx.signal },
      )
      .finalMessage();
  try {
    return await send();
  } catch (err) {
    if (!(err instanceof BadRequestError) || !dropUrlImages(ctx.messages)) throw err;
    return send();
  }
}

function appendHints(ctx: RunContext): void {
  const hints = ctx.takeHints();
  if (hints.length === 0) return;
  const text = hints
    .map((hint) => `The user adds this hint; take it into account and continue refining:\n${hint}`)
    .join("\n\n");
  const last = ctx.messages.at(-1);
  if (last?.role === "user" && Array.isArray(last.content))
    last.content.push({ type: "text", text });
  else ctx.messages.push({ role: "user", content: text });
}

async function handleBlocks(
  ctx: RunContext,
  blocks: Anthropic.Beta.BetaContentBlock[],
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const block of blocks) {
    if (block.type === "text" && block.text.trim())
      ctx.emit({ kind: "thought", text: block.text.trim() });
    else if (block.type === "thinking" && block.thinking.trim())
      ctx.emit({ kind: "thought", text: block.thinking.trim() });
    else if (block.type === "server_tool_use") {
      const input = block.input as { query?: unknown; url?: unknown };
      if (block.name === "web_search" && typeof input.query === "string")
        ctx.emit({ kind: "search", query: input.query });
      if (block.name === "web_fetch" && typeof input.url === "string")
        ctx.emit({ kind: "fetch", url: input.url });
    } else if (block.type === "tool_use") {
      results.push(await runTool(ctx, block));
    }
  }
  return results;
}

async function runTool(
  ctx: RunContext,
  block: Anthropic.Beta.BetaToolUseBlock,
): Promise<ToolResult> {
  const reply = (content: ToolResult["content"], isError = false): ToolResult => ({
    type: "tool_result",
    tool_use_id: block.id,
    content,
    ...(isError ? { is_error: true } : {}),
  });
  const invalid = (error: z.ZodError) => reply(`Invalid input: ${z.prettifyError(error)}`, true);
  switch (block.name) {
    case "report_clue": {
      const parsed = clueSchema.safeParse(block.input);
      if (!parsed.success) return invalid(parsed.error);
      ctx.emit({ kind: "clue", clue: parsed.data });
      return reply(CLUE_REPLY);
    }
    case "report_estimate": {
      const parsed = estimateSchema.safeParse(block.input);
      if (!parsed.success) return invalid(parsed.error);
      ctx.emit({ kind: "estimate", estimate: parsed.data });
      return reply(estimateReply(parsed.data.level));
    }
    case "zoom_image": {
      const parsed = zoomSchema.safeParse(block.input);
      if (!parsed.success) return invalid(parsed.error);
      const { image, ...crop } = parsed.data;
      if (image > ctx.imageCount) return reply(`There are only ${ctx.imageCount} photos.`, true);
      ctx.emit({ kind: "zoom", image });
      const data = await cropImage(await ctx.original(image - 1), crop);
      return reply([{ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }]);
    }
    default: {
      if (!isResearchTool(block.name)) return reply(`Unknown tool ${block.name}.`, true);
      const detail = describeCall(block.name, block.input);
      const at = probeCall(block.name, block.input);
      if (detail !== undefined)
        ctx.emit({ kind: "tool", tool: block.name, detail, ...(at && { at }) });
      const outcome = await ctx.research.call(block.name, block.input);
      return reply(toToolContent(outcome.parts), outcome.isError);
    }
  }
}
