// Research tools of one analysis: validates calls, enforces per-tool budgets and
// answers a repeated identical call from memory instead of calling the service again.
import { z } from "zod";
import { REPEAT_NOTICE, budgetExhausted, budgetNotice } from "../tools.ts";
import { geocodeTool } from "./geocode.ts";
import { horizonTool } from "./horizon.ts";
import { imageTool } from "./image.ts";
import { photosTool } from "./photos.ts";
import { placesTool } from "./places.ts";
import { satelliteTool } from "./satellite.ts";
import { streetTool } from "./street.ts";
import {
  RESEARCH_TOOL_NAMES,
  ResearchError,
  text,
  type ResearchContext,
  type ResearchPart,
  type ResearchTool,
  type ResearchToolName,
} from "./types.ts";

export const RESEARCH_TOOLS: readonly ResearchTool[] = [
  geocodeTool,
  placesTool,
  photosTool,
  imageTool,
  satelliteTool,
  streetTool,
  horizonTool,
];

const byName = new Map(RESEARCH_TOOLS.map((tool) => [tool.name as string, tool]));

export const isResearchTool = (name: string): name is ResearchToolName =>
  (RESEARCH_TOOL_NAMES as readonly string[]).includes(name);

export interface ResearchOutcome {
  parts: ResearchPart[];
  isError: boolean;
}

/** Activity-log summary of a call, or undefined when the input is invalid. */
export function describeCall(name: ResearchToolName, input: unknown): string | undefined {
  const tool = byName.get(name);
  const parsed = tool?.schema.safeParse(input);
  return tool && parsed?.success ? tool.describe(parsed.data) : undefined;
}

export class ResearchSession {
  private readonly used = new Map<string, number>();
  private readonly results = new Map<string, ResearchPart[]>();
  private readonly ctx: ResearchContext;

  constructor(ctx: ResearchContext) {
    this.ctx = ctx;
  }

  async call(name: ResearchToolName, input: unknown): Promise<ResearchOutcome> {
    const tool = byName.get(name);
    if (!tool) return failure(`Unknown tool ${name}.`);
    const parsed = tool.schema.safeParse(input);
    if (!parsed.success) return failure(`Invalid input: ${z.prettifyError(parsed.error)}`);

    const key = `${name}:${JSON.stringify(parsed.data)}`;
    const earlier = this.results.get(key);
    if (earlier) return { parts: [text(REPEAT_NOTICE), ...earlier], isError: false };

    const used = (this.used.get(name) ?? 0) + 1;
    if (used > tool.budget) return failure(budgetExhausted(tool.budget));
    this.used.set(name, used);
    try {
      const parts = await tool.run(parsed.data, this.ctx);
      this.results.set(key, parts);
      const notice = used >= tool.budget * 0.75 ? [text(budgetNotice(used, tool.budget))] : [];
      return { parts: [...parts, ...notice], isError: false };
    } catch (err) {
      if (err instanceof ResearchError) return failure(err.message);
      throw err;
    }
  }
}

const failure = (message: string): ResearchOutcome => ({ parts: [text(message)], isError: true });
