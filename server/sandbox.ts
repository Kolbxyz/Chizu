// Code execution for the Claude Code engine: the CLI's Bash tool inside Claude
// Code's own sandbox (bubblewrap and socat on Linux and WSL2, Seatbelt on macOS).
// Commands can write only in the job's working directory, cannot read the
// user's home or other jobs, and reach only the research services.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Hosts sandboxed code may call: the research services and their image hosts. */
const ALLOWED_DOMAINS = [
  "nominatim.openstreetmap.org",
  "overpass-api.de",
  "commons.wikimedia.org",
  "upload.wikimedia.org",
  "*.wikipedia.org",
  "api.open-meteo.com",
  "server.arcgisonline.com",
];

const runs = (command: string, args: string[]) =>
  new Promise<boolean>((resolve) => {
    execFile(command, args, { timeout: 10_000 }, (error) => resolve(!error));
  });

let availability: Promise<boolean> | undefined;

/** Whether the sandbox can run here; Bash is never offered without it. */
export function sandboxAvailable(): Promise<boolean> {
  availability ??=
    process.platform === "darwin"
      ? Promise.resolve(true)
      : process.platform === "linux"
        ? Promise.all([runs("bwrap", ["--version"]), runs("socat", ["-V"])]).then((ok) =>
            ok.every(Boolean),
          )
        : Promise.resolve(false);
  return availability;
}

/** Optional Python environment made by scripts/setup-python.sh. */
export const pythonDir = (dataDir: string) => join(dataDir, "python");

export function hasPythonEnv(dataDir: string): boolean {
  return existsSync(join(pythonDir(dataDir), "bin", "python"));
}

/** Settings passed with --settings; the escape hatch and unsandboxed fallback are off. */
export function sandboxSettings(workDir: string, dataDir: string) {
  return {
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      autoAllowBashIfSandboxed: true,
      filesystem: {
        // On WSL /mnt holds the Windows drives, including the user's files.
        denyRead: ["~/", dataDir, "/mnt"],
        allowRead: [workDir, pythonDir(dataDir)],
      },
      network: { allowedDomains: ALLOWED_DOMAINS, strictAllowlist: true },
    },
  };
}
