// Command line and environment of one Claude CLI run: which tools exist, which
// are pre-approved, the sandbox for Bash, and the reporter's MCP configuration.
import { fileURLToPath } from "node:url";
import { delimiter, join } from "node:path";
import { BROWSER_TOOL_NAMES } from "../shared/browser.ts";
import { CLAUDE_CODE_TOOLS, systemPrompt, type Capabilities } from "../shared/prompt.ts";
import { RESEARCH_TOOL_NAMES } from "../shared/research/types.ts";
import { hasPythonEnv, pythonDir, sandboxSettings } from "./sandbox.ts";

const REPORTER = fileURLToPath(new URL("./mcp/reporter.ts", import.meta.url));
export const MCP_PREFIX = "mcp__chizu__";
const BASE_MCP_TOOLS = ["report_clue", "report_estimate", "zoom_image", ...RESEARCH_TOOL_NAMES];

export interface InvocationOptions extends Capabilities {
  jobDir: string;
  imageCount: number;
  /** The job's working directory: photos for code, and where Bash may write. */
  cwd: string;
  dataDir: string;
  resume?: string;
}

export function cliInvocation(opts: InvocationOptions): { args: string[]; env: NodeJS.ProcessEnv } {
  // The task tools keep the run's plan in the CLI's own state; they reach neither files nor network.
  const builtIn = [
    "WebSearch",
    "WebFetch",
    "TaskCreate",
    "TaskUpdate",
    "TaskList",
    "TaskGet",
    ...(opts.code ? ["Bash"] : []),
  ];
  const mcpTools = [
    ...BASE_MCP_TOOLS,
    ...(opts.code ? ["view_image"] : []),
    ...(opts.browser ? BROWSER_TOOL_NAMES : []),
  ].map((tool) => `${MCP_PREFIX}${tool}`);
  const mcpConfig = {
    mcpServers: {
      chizu: { command: process.execPath, args: [REPORTER, opts.jobDir, String(opts.imageCount)] },
    },
  };
  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--strict-mcp-config',
    '--mcp-config', JSON.stringify(mcpConfig),
    '--tools', builtIn.join(','),
    '--allowedTools', ...builtIn, ...mcpTools,
    '--setting-sources', 'project',
    '--system-prompt', systemPrompt(CLAUDE_CODE_TOOLS, opts),
  ]; // prettier-ignore
  if (opts.code) args.push("--settings", JSON.stringify(sandboxSettings(opts.cwd, opts.dataDir)));
  if (process.env.CHIZU_MODEL) args.push("--model", process.env.CHIZU_MODEL);
  if (opts.resume) args.push("--resume", opts.resume);

  const path =
    opts.code && hasPythonEnv(opts.dataDir)
      ? `${join(pythonDir(opts.dataDir), "bin")}${delimiter}${process.env.PATH ?? ""}`
      : process.env.PATH;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: path,
    // The CLI connects MCP servers in the background by default, so the first
    // turn could start before the reporter tools exist. Wait for them instead,
    // with room for slow file systems (loading the MCP SDK from a Windows drive
    // under WSL takes about 20 s).
    MCP_CONNECTION_NONBLOCKING: "0",
    MCP_TIMEOUT: process.env.MCP_TIMEOUT ?? "120000",
    // Switches reach the reporter through the environment.
    CHIZU_WORK_DIR: opts.code ? opts.cwd : "",
    CHIZU_BROWSER: opts.browser ? "1" : "",
  };
  return { args, env };
}
