// Screen for the browser on Linux machines without one: an Xvfb virtual display,
// so Chromium runs as a normal windowed browser out of sight instead of headless.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { VIEWPORT } from "../../shared/browser.ts";

const START_TIMEOUT_MS = 10_000;

export interface Display {
  /** Environment for the browser process: DISPLAY when a virtual one was started. */
  env: NodeJS.ProcessEnv;
  /** True for an Xvfb display, which has no GPU. */
  virtual: boolean;
  close: () => void;
}

/** Linux needs an X11 or Wayland display for a window; other systems always have one. */
export function hasDisplay(): boolean {
  return (
    process.platform !== "linux" || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY)
  );
}

/**
 * The display the browser will use: the machine's own when it has one, else a
 * new Xvfb server. Resolves to undefined when neither exists (Xvfb missing),
 * and the browser then runs headless.
 */
export async function acquireDisplay(): Promise<Display | undefined> {
  if (hasDisplay()) return { env: process.env, virtual: false, close: () => undefined };
  // -displayfd makes Xvfb pick a free display number and print it on stdout.
  const xvfb = spawn(
    "Xvfb",
    [
      "-displayfd",
      "1",
      "-screen",
      "0",
      `${VIEWPORT.width}x${VIEWPORT.height + 200}x24`,
      "-nolisten",
      "tcp",
    ],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  const number = await new Promise<string | undefined>((resolve) => {
    const timer = setTimeout(() => resolve(undefined), START_TIMEOUT_MS);
    xvfb.once("error", () => resolve(undefined)); // Xvfb is not installed.
    createInterface({ input: xvfb.stdout }).once("line", (line) => {
      clearTimeout(timer);
      resolve(/^\d+$/.test(line.trim()) ? line.trim() : undefined);
    });
  });
  if (number === undefined) {
    xvfb.kill();
    return undefined;
  }
  return {
    env: { ...process.env, DISPLAY: `:${number}` },
    virtual: true,
    close: () => xvfb.kill(),
  };
}
