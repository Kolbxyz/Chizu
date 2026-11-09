import { describe, expect, it } from "vitest";
import { cliInvocation } from "./cliInvocation.ts";

const base = { jobDir: "/data/jobs/j1", imageCount: 1, cwd: "/data/work/j1", dataDir: "/data" };
const flag = (args: string[], name: string) => args[args.indexOf(name) + 1];

describe("cliInvocation", () => {
  it("offers neither Bash nor the browser by default", () => {
    const { args, env } = cliInvocation({ ...base, code: false, browser: false });
    expect(flag(args, "--tools")).toBe("WebSearch,WebFetch,TaskCreate,TaskUpdate,TaskList,TaskGet");
    expect(args).not.toContain("--settings");
    expect(args.join(" ")).not.toContain("browser_open");
    expect(env.CHIZU_BROWSER).toBe("");
    expect(env.CHIZU_WORK_DIR).toBe("");
  });

  it("sandboxes Bash with no escape hatch", () => {
    const { args, env } = cliInvocation({ ...base, code: true, browser: false });
    expect(flag(args, "--tools")?.endsWith(",Bash")).toBe(true);
    const settings = JSON.parse(flag(args, "--settings") ?? "{}");
    expect(settings.sandbox).toMatchObject({
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      network: { strictAllowlist: true },
    });
    expect(settings.sandbox.filesystem.denyRead).toEqual(expect.arrayContaining(["~/", "/data"]));
    expect(settings.sandbox.filesystem.allowRead).toContain("/data/work/j1");
    expect(args).toContain("mcp__chizu__view_image");
    expect(env.CHIZU_WORK_DIR).toBe("/data/work/j1");
  });

  it("keeps secrets out of the arguments", () => {
    const { args, env } = cliInvocation({
      ...base,
      code: false,
      browser: true,
      mapillaryToken: "MLY|1|secret",
    });
    expect(args.join(" ")).not.toContain("secret");
    expect(env.CHIZU_MAPILLARY_TOKEN).toBe("MLY|1|secret");
    expect(args).toContain("mcp__chizu__street_view");
    expect(env.CHIZU_BROWSER).toBe("1");
  });
});
