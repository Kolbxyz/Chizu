// One Chromium per analysis, started on first use. It runs as a normal windowed
// browser (Google serves its Street View imagery to it): on the machine's screen,
// or on an Xvfb virtual display when there is none, and headless only when
// neither exists. It has no profile (no cookies, no sign-in), blocks
// service workers and downloads, and sends all traffic through the guard proxy.
// Every action returns a screenshot.
import type { Browser, Page } from "playwright-core";
import { VIEWPORT } from "../../shared/browser.ts";
import { acquireDisplay, type Display } from "./display.ts";
import { startGuardProxy, type GuardProxy } from "./proxy.ts";

const NAVIGATION_TIMEOUT_MS = 45_000;
const DEFAULT_WAIT_MS = 1500;
/** Google Maps and Street View need a few seconds to fetch and draw their tiles. */
const MAPS_WAIT_MS = 6000;
const MAPS_URL = /^https:\/\/www\.google\.[a-z.]+\/maps/;
/** Google's EU cookie wall; refusing is an ordinary click on the page. */
const CONSENT_HOST = /^consent\.google\./;
const REFUSE = /^(Reject all|Tout refuser|Alle ablehnen|Rechazar todo|Rifiuta tutto)$/;

export interface Snapshot {
  url: string;
  title: string;
  /** Base64 JPEG of the viewport. */
  image: string;
}

/** Maps URL that opens Street View at the panorama nearest to a point. */
export function streetViewUrl(v: {
  lat: number;
  lng: number;
  heading?: number;
  pitch?: number;
  fov?: number;
}) {
  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
    viewpoint: `${v.lat},${v.lng}`,
    heading: String(Math.round(v.heading ?? 0)),
    pitch: String(Math.round(v.pitch ?? 0)),
    fov: String(Math.round(v.fov ?? 90)),
  });
  return `https://www.google.com/maps/@?${params}`;
}

export class BrowserSession {
  private started?: Promise<{
    browser: Browser;
    page: Page;
    proxy: GuardProxy;
    display?: Display;
  }>;

  async open(url: string, waitMs?: number): Promise<Snapshot> {
    const page = await this.page();
    // Google may redirect to its consent page while the first navigation is
    // still loading, so wait for whichever document ends up loaded.
    await page
      .goto(url, { waitUntil: "commit", timeout: NAVIGATION_TIMEOUT_MS })
      .catch((err: unknown) => {
        if (!(err instanceof Error && /interrupted by another navigation/.test(err.message)))
          throw err;
      });
    await page.waitForLoadState("domcontentloaded", { timeout: NAVIGATION_TIMEOUT_MS });
    if (CONSENT_HOST.test(new URL(page.url()).host)) {
      await page.getByRole("button", { name: REFUSE }).first().click();
      await page.waitForURL((next) => !CONSENT_HOST.test(next.host), {
        timeout: NAVIGATION_TIMEOUT_MS,
      });
    }
    return this.snapshot(waitMs ?? (MAPS_URL.test(page.url()) ? MAPS_WAIT_MS : DEFAULT_WAIT_MS));
  }

  /**
   * Opens Street View; `rendered` is false when the panorama area stayed black:
   * no coverage nearby, or a headless browser, to which Google serves only
   * user-uploaded 360° photos (its car imagery tiles answer 403).
   */
  async streetView(
    view: Parameters<typeof streetViewUrl>[0],
  ): Promise<Snapshot & { rendered: boolean }> {
    const snapshot = await this.open(streetViewUrl(view));
    return { ...snapshot, rendered: !(await isMostlyBlack(snapshot.image)) };
  }

  async click(x: number, y: number, waitMs?: number): Promise<Snapshot> {
    await (await this.page()).mouse.click(x, y);
    return this.snapshot(waitMs);
  }

  async drag(from: [number, number], to: [number, number], waitMs?: number): Promise<Snapshot> {
    const { mouse } = await this.page();
    await mouse.move(...from);
    await mouse.down();
    await mouse.move(...to, { steps: 12 });
    await mouse.up();
    return this.snapshot(waitMs);
  }

  async scroll(x: number, y: number, delta: number, waitMs?: number): Promise<Snapshot> {
    const { mouse } = await this.page();
    await mouse.move(x, y);
    await mouse.wheel(0, delta);
    return this.snapshot(waitMs);
  }

  async type(text: string, submit: boolean, waitMs?: number): Promise<Snapshot> {
    const { keyboard } = await this.page();
    await keyboard.type(text, { delay: 20 });
    if (submit) await keyboard.press("Enter");
    return this.snapshot(waitMs);
  }

  async key(key: string, waitMs?: number): Promise<Snapshot> {
    await (await this.page()).keyboard.press(key);
    return this.snapshot(waitMs);
  }

  /** Visible text of the page, cut to `maxChars`. */
  async read(maxChars: number): Promise<{ url: string; title: string; text: string }> {
    const page = await this.page();
    const text = await page.locator("body").innerText();
    return { url: page.url(), title: await page.title(), text: text.slice(0, maxChars) };
  }

  async close(): Promise<void> {
    if (!this.started) return;
    const { browser, proxy, display } = await this.started;
    await browser.close();
    proxy.close();
    display?.close();
  }

  private async snapshot(waitMs = DEFAULT_WAIT_MS): Promise<Snapshot> {
    const page = await this.page();
    await page.waitForTimeout(waitMs);
    const image = await page.screenshot({ type: "jpeg", quality: 80 });
    return { url: page.url(), title: await page.title(), image: image.toString("base64") };
  }

  private page(): Promise<Page> {
    this.started ??= launch();
    return this.started.then((s) => s.page);
  }
}

/** Whether the middle of a screenshot (where the panorama draws) is nearly black. */
export async function isMostlyBlack(jpegBase64: string): Promise<boolean> {
  const { default: sharp } = await import("sharp");
  const { channels } = await sharp(Buffer.from(jpegBase64, "base64"))
    .extract({ left: 320, top: 200, width: 640, height: 400 })
    .stats();
  return channels.slice(0, 3).every((channel) => channel.mean < 12);
}

async function launch() {
  // Loaded on first use: the CLI waits for the reporter to start, and most runs never browse.
  const { chromium } = await import("playwright-core");
  const proxy = await startGuardProxy();
  const display = await acquireDisplay();
  const headless = display === undefined;
  const browser = await chromium.launch({
    headless,
    env: display?.env,
    channel: "chromium",
    // `<-loopback>` makes Chromium send localhost through the proxy too, where it is refused.
    proxy: { server: proxy.url, bypass: "<-loopback>" },
    args: [
      // Headless and virtual displays have no GPU; software WebGL lets Maps draw.
      ...(headless || display?.virtual
        ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : []),
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    ],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: "en-US",
    serviceWorkers: "block",
    acceptDownloads: false,
  });
  const page = await context.newPage();
  // Keep a single tab: pop-ups are closed as they open.
  context.on("page", (extra) => void extra.close());
  return { browser, page, proxy, display };
}
