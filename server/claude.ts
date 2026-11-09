// Runs the Claude CLI in print mode, talking stream-json over stdin/stdout, and
// translates its output into job events.
import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { describeBrowserCall, isBrowserTool } from "../shared/browser.ts";
import type { JobEvent } from "../shared/job.ts";
import { clueSchema, estimateSchema } from "../shared/schema.ts";
import { describeCall, isResearchTool } from "../shared/research/session.ts";
import { MCP_PREFIX, cliInvocation, type InvocationOptions } from "./cliInvocation.ts";

const RUN_TIMEOUT_MS = 30 * 60 * 1000;

type EventBody = JobEvent extends infer E ? (E extends JobEvent ? Omit<E, "t"> : never) : never;

export type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }
    >;

export interface RunOptions extends InvocationOptions {
  onEvent: (event: EventBody) => void;
  onSession: (sessionId: string) => void;
  /** Called once; `error` is set when the run did not finish normally. */
  onExit: (error?: string) => void;
}

export interface Run {
  /** Queues another user message in the live session. Returns false once input is closed. */
  send: (content: MessageContent) => boolean;
  cancel: () => void;
}

let availability: Promise<boolean> | undefined;

/** Whether the Claude Code CLI can be started; checked once per server process. */
export function claudeCodeAvailable(): Promise<boolean> {
  availability ??= new Promise((resolve) => {
    execFile(
      process.env.CHIZU_CLAUDE_BIN ?? "claude",
      ["--version"],
      { timeout: 15_000 },
      (error) => resolve(!error),
    );
  });
  return availability;
}

export function startRun(first: MessageContent, opts: RunOptions): Run {
  const { args, env } = cliInvocation(opts);
  const child = spawn(process.env.CHIZU_CLAUDE_BIN ?? "claude", args, {
    cwd: opts.cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let pending = 0;
  let inputOpen = true;
  let failure: string | undefined;
  let stderr = "";
  let exited = false;

  const send = (content: MessageContent) => {
    if (!inputOpen) return false;
    pending += 1;
    child.stdin.write(`${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`);
    return true;
  };
  const closeInput = () => {
    if (!inputOpen) return;
    inputOpen = false;
    child.stdin.end();
  };
  const timer = setTimeout(() => {
    failure = "timeout";
    child.kill("SIGTERM");
  }, RUN_TIMEOUT_MS);

  child.stdin.on("error", () => (inputOpen = false));
  child.stderr.on("data", (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));
  child.on("error", (err) => {
    failure = `cannot start claude: ${err.message}`;
  });
  child.on("close", (code) => {
    if (exited) return;
    exited = true;
    clearTimeout(timer);
    if (!failure && code !== 0) failure = stderr.trim() || `claude exited with code ${code}`;
    opts.onExit(failure);
  });

  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = parseLine(line);
    if (!message) return;
    if (message.type === "system" && message.subtype === "init") {
      const chizu = message.mcp_servers?.find((server) => server.name === "chizu");
      if (chizu?.status !== "connected") {
        // Without the reporter nothing can reach the UI; stop rather than let Claude guess.
        failure = `chizu tools unavailable (${chizu?.status ?? "missing"})`;
        child.kill("SIGTERM");
        return;
      }
      if (message.session_id) opts.onSession(message.session_id);
    } else if (message.type === "assistant") {
      for (const block of message.message?.content ?? []) {
        const event = blockToEvent(block);
        if (event) opts.onEvent(event);
      }
    } else if (message.type === "result") {
      opts.onEvent({
        kind: "usage",
        costUsd: message.total_cost_usd ?? 0,
        turns: message.num_turns ?? 0,
        durationMs: message.duration_ms ?? 0,
      });
      if (message.is_error) failure = message.result || message.subtype || "claude error";
      pending -= 1;
      if (pending <= 0) closeInput();
    }
  });

  send(first);
  return {
    send,
    cancel: () => {
      failure = "cancelled";
      child.kill("SIGTERM");
    },
  };
}

interface StreamBlock {
  type: string;
  name?: string;
  text?: string;
  input?: unknown;
}

interface StreamMessage {
  type: string;
  subtype?: string;
  session_id?: string;
  mcp_servers?: Array<{ name: string; status: string }>;
  message?: { content?: StreamBlock[] };
  result?: string;
  is_error?: boolean;
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
}

function parseLine(line: string): StreamMessage | undefined {
  try {
    const value: unknown = JSON.parse(line);
    return value && typeof value === "object" ? (value as StreamMessage) : undefined;
  } catch {
    return undefined; // Non-JSON lines are diagnostics, not protocol messages.
  }
}

export function blockToEvent(block: StreamBlock): EventBody | undefined {
  if (block.type === "text" && block.text?.trim())
    return { kind: "thought", text: block.text.trim() };
  if (block.type !== "tool_use") return undefined;
  const input = (block.input ?? {}) as Record<string, unknown>;
  switch (block.name) {
    case "mcp__chizu__report_clue": {
      const clue = clueSchema.safeParse(input);
      return clue.success ? { kind: "clue", clue: clue.data } : undefined;
    }
    case "mcp__chizu__report_estimate": {
      const estimate = estimateSchema.safeParse(input);
      return estimate.success ? { kind: "estimate", estimate: estimate.data } : undefined;
    }
    case "mcp__chizu__zoom_image":
      return typeof input.image === "number" ? { kind: "zoom", image: input.image } : undefined;
    case "WebSearch":
      return typeof input.query === "string" ? { kind: "search", query: input.query } : undefined;
    case "WebFetch":
      return typeof input.url === "string" ? { kind: "fetch", url: input.url } : undefined;
    case "TaskCreate": {
      const subject = input.subject ?? input.title ?? input.content;
      return typeof subject === "string"
        ? { kind: "task", detail: subject.slice(0, 140) }
        : undefined;
    }
    case "Bash": {
      const label = typeof input.description === "string" ? input.description : input.command;
      return typeof label === "string"
        ? { kind: "code", detail: label.split("\n")[0]?.slice(0, 140) ?? "" }
        : undefined;
    }
    default: {
      const tool = block.name?.startsWith(MCP_PREFIX) ? block.name.slice(MCP_PREFIX.length) : "";
      if (isResearchTool(tool)) {
        const detail = describeCall(tool, input);
        return detail === undefined ? undefined : { kind: "tool", tool, detail };
      }
      if (isBrowserTool(tool)) {
        const detail = describeBrowserCall(tool, input);
        return detail === undefined ? undefined : { kind: "tool", tool, detail };
      }
      return undefined;
    }
  }
}
