import { spawn } from "node:child_process";
import { readFile, symlink, writeFile } from "node:fs/promises";
import { startDemoShop } from "@reproflow/demo-shop";
import { RunEvidenceSchema, ScenarioSchema } from "@reproflow/event-schema";
import { generate } from "@reproflow/playwright-generator";

async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 100000) throw new Error("input_limit");
  }
  const request = JSON.parse(input);
  const scenario = ScenarioSchema.parse(request.scenario);
  const generated = generate(scenario);
  if (
    request.source !== generated.source ||
    !["buggy", "fixed"].includes(request.variant)
  )
    throw new Error("invalid_request");
  await symlink(
    "/opt/reproflow/workers/runner/node_modules",
    "/work/node_modules",
  );
  await writeFile("/work/package.json", '{"type":"module"}');
  await writeFile("/work/reproduction.spec.js", generated.source);
  const shop = await startDemoShop({ fixed: request.variant === "fixed" });
  try {
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
    const evidence = RunEvidenceSchema.parse(
      JSON.parse(await readFile("/work/evidence.json", "utf8")),
    );
    process.stdout.write(JSON.stringify(evidence));
  } finally {
    await shop.close();
  }
}
main().catch(() => {
  process.exitCode = 1;
});
