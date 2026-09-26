import { createHash } from "node:crypto";
import { type ReplayStep, ScenarioSchema } from "@reproflow/event-schema";

export { generateElement } from "./element.js";

function statement(step: ReplayStep): string {
  switch (step.type) {
    case "goto":
      return `await page.goto(${JSON.stringify(step.path)});`;
    case "expect-path":
      return `await expect(page).toHaveURL(new URL(${JSON.stringify(step.path)}, baseURL).href);`;
    case "click":
      return `await page.getByTestId(${JSON.stringify(step.target)}).click();`;
    case "fill":
      return `await page.getByTestId("postal-code").fill(${JSON.stringify(step.value)});`;
    case "submit":
      return 'await page.getByTestId("postal-code").press("Enter");';
  }
}

export function generate(raw: unknown) {
  const scenario = ScenarioSchema.parse(raw);
  const source = `import { test, expect } from "@playwright/test";

// Fixture: fresh demo-shop-v1 cart, Chromium, synthetic postal codes only.
test.use({ viewport: ${JSON.stringify(scenario.viewport)} });
test("checkout after address update", async ({ page, baseURL, browser }, testInfo) => {
  const evidence = { observedPath: "[REDACTED]", postalCodeError: false, checkoutStatuses: [], browserVersion: browser.version() };
  page.on("console", (message) => {
    if (message.type() === "error" && message.text() === "ADDRESS_POSTAL_CODE_MISSING") evidence.postalCodeError = true;
  });
  page.on("response", (response) => {
    if (response.url() === new URL("/api/checkout", baseURL).href && response.request().method() === "POST" && evidence.checkoutStatuses.length < 100) evidence.checkoutStatuses.push(response.status());
  });
  page.on("requestfailed", (request) => {
    if (request.url() === new URL("/api/checkout", baseURL).href && evidence.checkoutStatuses.length < 100) evidence.checkoutStatuses.push(null);
  });
  try {
${scenario.steps.map(({ action }, index) => `    await test.step("replay:${index}", async () => { ${statement(action)} });`).join("\n")}
    await test.step("confirmed-oracle", async () => {
      await expect(page).toHaveURL(new URL(${JSON.stringify(scenario.oracle.expectedPath)}, baseURL).href);
    });
  } finally {
    const url = new URL(page.url());
    if (url.origin === new URL(baseURL).origin && ["/cart", "/checkout"].includes(url.pathname)) evidence.observedPath = url.pathname;
    await testInfo.attach("reproflow-evidence", { body: JSON.stringify(evidence), contentType: "application/json" });
  }
});
`;
  return { source, sha256: createHash("sha256").update(source).digest("hex") };
}
