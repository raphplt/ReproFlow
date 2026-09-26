import { createHash } from "node:crypto";
import {
  type ElementLocator,
  ElementScenarioSchema,
} from "@reproflow/event-schema";

export function elementLocatorSource(locator: ElementLocator): string {
  if (locator.kind === "role")
    return `page.getByRole(${JSON.stringify(locator.role)}, { name: ${JSON.stringify(locator.name)}, exact: true })`;
  const method = {
    testId: "getByTestId",
    label: "getByLabel",
    placeholder: "getByPlaceholder",
  }[locator.kind];
  return `page.${method}(${JSON.stringify(locator.value)}${locator.kind === "testId" ? "" : ", { exact: true }"})`;
}

export function generateElement(raw: unknown) {
  const scenario = ElementScenarioSchema.parse(raw);
  const target = scenario.project.targets[scenario.oracle.target];
  if (!target) throw new Error("Missing oracle target");
  const application = scenario.application;
  const source = `import { test, expect } from "@playwright/test";
test.use({ viewport: ${JSON.stringify(scenario.viewport)} });
test("confirmed component value", async ({ page, browser }, testInfo) => {
  const evidence = { targetState: "missing", observedValue: null, runtimeError: false, browserVersion: browser.version() };
  page.on("pageerror", () => { evidence.runtimeError = true; });
${
  application
    ? `  evidence.applicationReady = false;
  const responseMatches = (response, filtered) => {
    const url = new URL(response.url());
    return response.request().method() === "GET" && url.origin === new URL(page.url()).origin && url.pathname === ${JSON.stringify(application.responsePath)} && (!filtered || url.searchParams.get(${JSON.stringify(application.queryKey)}) === ${JSON.stringify(application.queryValue)});
  };
  const initialResponse = page.waitForResponse(response => responseMatches(response, false), { timeout: 10000 }).catch(() => null);
  const filteredResponse = page.waitForResponse(response => responseMatches(response, true), { timeout: 15000 }).catch(() => null);
`
    : ""
}  const target = ${elementLocatorSource(target.locator)};
  const observe = async () => {
    const count = await target.count();
    evidence.targetState = count === 0 ? "missing" : count > 1 ? "ambiguous" : "unsupported";
    evidence.observedValue = null;
    if (count !== 1) return;
    const safe = await target.evaluate(el => el instanceof HTMLInputElement && el.type === "number");
    if (!safe) return;
    const value = await target.inputValue();
    evidence.targetState = ${JSON.stringify(target.allowedValues)}.includes(value) ? "ok" : "masked";
    if (evidence.targetState === "ok") evidence.observedValue = value;
  };
  try {
    await page.goto(${JSON.stringify(application?.entryPath ?? "/")});
${
  application
    ? `    const initial = await initialResponse;
    if (!initial || initial.status() !== 200) throw new Error("fixture_not_ready");
    await expect(${elementLocatorSource(application.readyTarget)}).toBeVisible({ timeout: 5000 });
`
    : ""
}${scenario.steps
  .map(({ action }, index) => {
    const configured = scenario.project.targets[action.target];
    if (!configured) throw new Error("Missing target");
    const locator = elementLocatorSource(configured.locator);
    const operation =
      action.type === "click"
        ? "await target.click();"
        : `await expect(target).toHaveAttribute("type", "number"); await target.fill(${JSON.stringify(action.value)});`;
    return `    await test.step("replay:${index}", async () => { const target = ${locator}; await expect(target).toHaveCount(1); ${operation} });`;
  })
  .join("\n")}
${
  application
    ? `    const filtered = await filteredResponse;
    if (!filtered || filtered.status() !== 200) throw new Error("fixture_not_ready");
    await expect(page).toHaveURL(location => location.pathname === ${JSON.stringify(application.entryPath)} && location.searchParams.get(${JSON.stringify(application.queryKey)}) === ${JSON.stringify(application.queryValue)}, { timeout: 5000 });
    evidence.applicationReady = true;
`
    : ""
}    await test.step("confirmed-oracle", async () => {
      await observe();
      await expect(target).toHaveCount(1);
      await expect(target).toHaveAttribute("type", "number");
      await expect(target).toHaveValue(${JSON.stringify(scenario.oracle.expectedValue)});
    });
  } finally {
    try { await observe(); } catch { evidence.targetState = "missing"; evidence.observedValue = null; }
    await testInfo.attach("reproflow-element-evidence", { body: JSON.stringify(evidence), contentType: "application/json" });
  }
});
`;
  return { source, sha256: createHash("sha256").update(source).digest("hex") };
}
