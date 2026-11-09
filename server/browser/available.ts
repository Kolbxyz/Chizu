// Whether the browser can start: playwright-core finds its Chromium
// build (installed with `npx playwright-core install chromium`).
import { existsSync } from "node:fs";

let availability: Promise<boolean> | undefined;

export function browserAvailable(): Promise<boolean> {
  availability ??= import("playwright-core").then(({ chromium }) =>
    existsSync(chromium.executablePath()),
  );
  return availability;
}
