import { spawn } from "node:child_process";
import { readFile, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { startDemoShop } from "@reproflow/demo-shop";
import {
  ElementEvidenceSchema,
  ElementScenarioSchema,
  RunEvidenceSchema,
  ScenarioSchema,
} from "@reproflow/event-schema";
import { generate, generateElement } from "@reproflow/playwright-generator";
import { captureElement } from "@reproflow/recorder";
import {
  MAX_COMPONENT_BYTES,
  startComponentFixture,
} from "./component-fixture.js";

async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > MAX_COMPONENT_BYTES * 2)
      throw new Error("input_limit");
  }
  const request = JSON.parse(input);
  const application = request.kind === "application-value";
  const component = request.kind === "component-value" || application;
  if (!component && input.length > 100000) throw new Error("input_limit");
  const generated = component
    ? generateElement(ElementScenarioSchema.parse(request.scenario))
    : generate(ScenarioSchema.parse(request.scenario));
  if (
    request.source !== generated.source ||
    ((!component || application) &&
      !["buggy", "fixed"].includes(request.variant)) ||
    (component && !application && typeof request.bundle !== "string") ||
    (application &&
      (request.scenario.kind !== "application-value" ||
        !["capture", "replay"].includes(request.mode)))
  )
    throw new Error("invalid_request");
  await symlink(
    "/opt/reproflow/workers/runner/node_modules",
    "/work/node_modules",
  );
  await writeFile("/work/package.json", '{"type":"module"}');
  await writeFile("/work/reproduction.spec.js", generated.source);
  const adapter = application
    ? (createRequire(import.meta.url)("/opt/tcg/stack.cjs") as {
        start: (
          variant: "buggy" | "fixed",
        ) => Promise<{ url: string; close: () => Promise<void> }>;
      })
    : null;
  const shop = adapter
    ? await adapter.start(request.variant)
    : component
      ? await startComponentFixture(request.bundle)
      : await startDemoShop({ fixed: request.variant === "fixed" });
  try {
    if (application && request.mode === "capture") {
      process.stdout.write(
        JSON.stringify(await captureElement(request.scenario, shop.url)),
      );
      return;
    }
    await writeFile(
      "/work/playwright.config.cjs",
      `module.exports = ${JSON.stringify({
        testDir: "/work",
        testMatch: "reproduction.spec.js",
        workers: 1,
        retries: 0,
        timeout: 20000,
        globalTimeout: 25000,
        expect: { timeout: 2000 },
        reporter: [["/opt/reproflow/workers/runner/dist/reporter.js"]],
        outputDir: "/work/test-results",
        use: {
          baseURL: shop.url,
          browserName: "chromium",
          headless: true,
          actionTimeout: 2000,
          navigationTimeout: 5000,
          trace: "off",
          screenshot: "off",
          video: "off",
          serviceWorkers: "block",
        },
      })};`,
    );
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          "/opt/reproflow/workers/runner/node_modules/@playwright/test/cli.js",
          "test",
          "--config=/work/playwright.config.cjs",
        ],
        {
          cwd: "/work",
          stdio: "ignore",
          env: {
            PATH: "/usr/local/bin:/usr/bin:/bin",
            HOME: "/tmp",
            PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright",
          },
        },
      );
      child.once("error", reject);
      child.once("close", () => resolve());
    });
    const evidence = (
      component ? ElementEvidenceSchema : RunEvidenceSchema
    ).parse(JSON.parse(await readFile("/work/evidence.json", "utf8")));
    process.stdout.write(JSON.stringify(evidence));
  } finally {
    await shop.close();
  }
}
main().catch(() => {
  process.exitCode = 1;
});
