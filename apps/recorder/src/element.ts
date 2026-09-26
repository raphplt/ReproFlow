import {
  type ElementLocator,
  type ElementScenario,
  ElementScenarioSchema,
} from "@reproflow/event-schema";
import { chromium, type Page } from "playwright";

function locate(page: Page, locator: ElementLocator) {
  switch (locator.kind) {
    case "role":
      return page.getByRole(locator.role, { name: locator.name, exact: true });
    case "testId":
      return page.getByTestId(locator.value);
    case "label":
      return page.getByLabel(locator.value, { exact: true });
    case "placeholder":
      return page.getByPlaceholder(locator.value, { exact: true });
  }
}

/** Scripted capture of a trusted synthetic fixture, not a general manual recorder. */
export async function captureElement(
  raw: unknown,
  url: string,
): Promise<ElementScenario> {
  const scenario = ElementScenarioSchema.parse(raw);
  const origin = new URL(url);
  if (
    origin.protocol !== "http:" ||
    origin.hostname !== "127.0.0.1" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("A local synthetic fixture is required");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: scenario.viewport,
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin.origin
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(3000);
    let runtimeError = false;
    page.on("pageerror", () => {
      runtimeError = true;
    });
    const application = scenario.application;
    const matches = (
      response: import("playwright").Response,
      filtered: boolean,
    ) => {
      const location = new URL(response.url());
      return (
        location.origin === origin.origin &&
        response.request().method() === "GET" &&
        location.pathname === application?.responsePath &&
        (!filtered ||
          location.searchParams.get(application.queryKey) ===
            application.queryValue)
      );
    };
    const initial = application
      ? page
          .waitForResponse((response) => matches(response, false), {
            timeout: 10000,
          })
          .catch(() => null)
      : null;
    const filtered = application
      ? page
          .waitForResponse((response) => matches(response, true), {
            timeout: 15000,
          })
          .catch(() => null)
      : null;
    await page.goto(new URL(application?.entryPath ?? "/", origin).href);
    if (application) {
      if ((await initial)?.status() !== 200)
        throw new Error("Fixture API not ready");
      await locate(page, application.readyTarget).waitFor({
        state: "visible",
        timeout: 5000,
      });
    }
    for (const { action } of scenario.steps) {
      const configured = scenario.project.targets[action.target];
      if (!configured) throw new Error("Unknown target");
      const target = locate(page, configured.locator);
      await target.waitFor({ state: "visible" });
      if ((await target.count()) !== 1) throw new Error("Ambiguous target");
      if (action.type === "click") await target.click();
      else {
        if (
          !(await target.evaluate(
            (el) => el instanceof HTMLInputElement && el.type === "number",
          ))
        )
          throw new Error("Unsupported input");
        await target.fill(action.value);
      }
    }
    if (application) {
      if ((await filtered)?.status() !== 200)
        throw new Error("Fixture API not ready");
      await page.waitForURL(
        (location) =>
          location.pathname === application.entryPath &&
          location.searchParams.get(application.queryKey) ===
            application.queryValue,
        { timeout: 5000 },
      );
    }
    const configured = scenario.project.targets[scenario.oracle.target];
    if (!configured) throw new Error("Missing oracle target");
    const target = locate(page, configured.locator);
    if (
      (await target.count()) !== 1 ||
      !(await target.evaluate(
        (el) => el instanceof HTMLInputElement && el.type === "number",
      ))
    )
      throw new Error("Invalid oracle target");
    // Flush React's event/render cycle before observing the controlled input.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const observedValue = await target.inputValue();
    if (runtimeError) throw new Error("Fixture runtime failure");
    if (!configured.allowedValues.includes(observedValue))
      throw new Error("Observation masked by capture policy");
    return ElementScenarioSchema.parse({ ...scenario, observedValue });
  } finally {
    await browser.close();
  }
}
