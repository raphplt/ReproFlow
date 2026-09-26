import type { RecordingTrace } from "@reproflow/event-schema";
import { chromium } from "playwright";
import { installCapture } from "./capture-script.js";
import { safeInteraction, safePath } from "./privacy.js";
import { CaptureSession } from "./session.js";

export async function launchRecorder(options: {
  baseUrl: string;
  headless?: boolean;
}) {
  const origin = new URL(options.baseUrl);
  if (
    origin.hostname !== "127.0.0.1" ||
    origin.protocol !== "http:" ||
    origin.username ||
    origin.password
  )
    throw new Error("This capture vertical supports only the local demo shop");
  const browser = await chromium.launch({
    headless: options.headless ?? false,
  });
  try {
    const userAgent = `ReproFlow/0.0 Chromium/${browser.version()}`;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      userAgent,
      serviceWorkers: "block",
    });
    // Limit this vertical to its fixture. No external pages, popups, or iframes are captured.
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin.origin
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    let session: CaptureSession | null = null;
    let state = "ready";
    let complete: (trace: RecordingTrace | null) => void = () => {};
    const finished = new Promise<RecordingTrace | null>((resolve) => {
      complete = resolve;
    });
    browser.on("disconnected", () => complete(null));
    context.on("page", (popup) => {
      if (popup !== page) void popup.close();
    });
    page.on("close", () => complete(null));
    const trusted = (frame: { url(): string }) => {
      try {
        return (
          frame === page.mainFrame() &&
          new URL(frame.url()).origin === origin.origin
        );
      } catch {
        return false;
      }
    };
    // Official APIs: https://playwright.dev/docs/api/class-browsercontext#browser-context-expose-binding
    await context.exposeBinding(
      "__reproflowEvent",
      ({ frame }, raw: unknown) => {
        if (!session || !trusted(frame)) return;
        const payload = safeInteraction(raw);
        if (payload)
          session.append({
            ...payload,
            pagePath: safePath(frame.url(), origin.origin),
          });
      },
    );
    await context.exposeBinding(
      "__reproflowControl",
      ({ frame }, action: unknown) => {
        if (!trusted(frame)) throw new Error("Unsupported frame");
        if (action === "start" && state === "ready") {
          session = new CaptureSession({
            browser: "chromium",
            viewport: { width: 1440, height: 1000 },
            userAgent,
          });
          state = "recording";
        } else if (
          action === "mark" &&
          session &&
          ["recording", "marked"].includes(state)
        ) {
          session.markBroken(safePath(page.url(), origin.origin));
          state = "marked";
        } else if (
          action === "stop" &&
          session &&
          ["recording", "marked"].includes(state)
        ) {
          const trace = session.stop();
          state = "stopped";
          complete(trace);
        } else if (action !== "status")
          throw new Error("Invalid capture transition");
        return { state };
      },
    );
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame())
        session?.append({
          type: "navigation",
          pagePath: safePath(frame.url(), origin.origin),
        });
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      session?.append({
        type: "console-error",
        pagePath: safePath(page.url(), origin.origin),
        code:
          message.text() === "ADDRESS_POSTAL_CODE_MISSING"
            ? "ADDRESS_POSTAL_CODE_MISSING"
            : "[REDACTED]",
      });
    });
    page.on("pageerror", () =>
      session?.append({
        type: "console-error",
        pagePath: safePath(page.url(), origin.origin),
        code: "[REDACTED]",
      }),
    );
    page.on("response", (response) => {
      const path = safePath(response.url(), origin.origin);
      if (path !== "/api/checkout") return;
      const method = response.request().method();
      session?.append({
        type: "network",
        pagePath: path,
        method: method === "POST" || method === "GET" ? method : "OTHER",
        status: response.status(),
      });
    });
    page.on("requestfailed", (request) => {
      if (safePath(request.url(), origin.origin) !== "/api/checkout") return;
      const method = request.method();
      session?.append({
        type: "network",
        pagePath: "/api/checkout",
        method: method === "POST" || method === "GET" ? method : "OTHER",
        status: null,
      });
    });
    await context.addInitScript(installCapture, { origin: origin.origin });
    await page.goto(`${origin.origin}/cart`);
    return { page, finished, close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
export { captureElement } from "./element.js";
