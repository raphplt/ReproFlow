import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs, promisify } from "node:util";
import { generateElement } from "../../../packages/playwright-generator/dist/index.js";
import {
  captureApplicationIsolated,
  runApplicationIsolated,
} from "../../../workers/runner/dist/index.js";

const { values } = parseArgs({
  options: {
    "confirm-zero": { type: "boolean", default: false },
    field: { type: "string", default: "min" },
  },
});
if (!values["confirm-zero"] || !["min", "max"].includes(values.field))
  throw new Error(
    "Usage: pnpm pilot:tcg:stack --confirm-zero [--field min|max]",
  );
const exec = promisify(execFile);
const imageId = (
  await exec("docker", [
    "image",
    "inspect",
    "reproflow-tcg:local",
    "--format={{.Id}}",
  ])
).stdout.trim();
if (!/^sha256:[a-f0-9]{64}$/.test(imageId))
  throw new Error("Invalid local image identity");
const provenance = JSON.parse(
  (
    await exec(
      "docker",
      [
        "run",
        "--rm",
        "--network=none",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--user=pwuser",
        "--entrypoint=node",
        imageId,
        "-e",
        "process.stdout.write(require('node:fs').readFileSync('/opt/tcg/provenance.json'))",
      ],
      { timeout: 15000 },
    )
  ).stdout,
);
const field = values.field;
const draft = {
  schemaVersion: 2,
  kind: "application-value",
  application: {
    entryPath: "/fr/marketplace/cards",
    readyTarget: {
      kind: "role",
      role: "heading",
      name: "ReproFlow Synthetic Card",
    },
    responsePath: "/api/marketplace/cards",
    queryKey: field === "min" ? "priceMin" : "priceMax",
    queryValue: "0",
  },
  project: {
    id: "tcg-nexus-marketplace",
    policy: "synthetic-numeric-v1",
    targets: {
      filters: {
        locator: { kind: "role", role: "button", name: "Filtres" },
        allowedValues: [],
      },
      price: {
        locator: { kind: "placeholder", value: field === "min" ? "0" : "9999" },
        allowedValues: ["", "0", "12"],
      },
    },
  },
  viewport: { width: 1280, height: 800 },
  steps: [
    { sequence: 0, action: { type: "click", target: "filters" } },
    { sequence: 1, action: { type: "fill", target: "price", value: "0" } },
  ],
  oracle: { target: "price", expectedValue: "0", confirmedByUser: true },
  observedValue: "",
};
const output = path.resolve("artifacts/application-pilots", randomUUID());
await mkdir(output, { recursive: true });
const report = {
  schemaVersion: 2,
  kind: "application-pilot",
  state: "capturing",
  createdAt: new Date().toISOString(),
  imageId,
  provenance,
  runs: [],
};
const save = async () => {
  await writeFile(
    path.join(output, "report.tmp"),
    JSON.stringify(report, null, 2),
  );
  await rename(
    path.join(output, "report.tmp"),
    path.join(output, "report.json"),
  );
};
const controller = new AbortController();
const cancel = () => controller.abort();
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);
try {
  await save();
  console.log(`Artifacts: ${output}`);
  const scenario = await captureApplicationIsolated(
    draft,
    imageId,
    controller.signal,
  );
  if (scenario.observedValue === scenario.oracle.expectedValue)
    throw new Error("Baseline did not reproduce the reported mismatch");
  const generated = generateElement(scenario);
  report.scenario = scenario;
  report.testSha256 = generated.sha256;
  report.state = "running";
  await writeFile(
    path.join(output, "scenario.json"),
    JSON.stringify(scenario, null, 2),
  );
  await writeFile(path.join(output, "reproduction.spec.js"), generated.source);
  await save();
  for (const variant of ["buggy", "fixed"]) {
    for (let index = 1; index <= 3; index++) {
      if (controller.signal.aborted) throw new Error("Pilot cancelled");
      const run = await runApplicationIsolated(
        scenario,
        generated.source,
        variant,
        index,
        imageId,
        controller.signal,
      );
      report.runs.push(run);
      await save();
      console.log(
        `${variant} ${index}/3: ${run.status}; applicationReady=${run.evidence.applicationReady === true}`,
      );
    }
  }
  const browsers = new Set(
    report.runs.map((run) => run.evidence.browserVersion),
  );
  const accepted =
    !controller.signal.aborted &&
    browsers.size === 1 &&
    !browsers.has(null) &&
    report.runs.every(
      (run) =>
        run.testSha256 === generated.sha256 &&
        run.imageId === imageId &&
        run.status ===
          (run.variant === "buggy" ? "reproduced" : "not_reproduced"),
    );
  report.state = accepted ? "complete" : "failed";
  await save();
  await writeFile(
    path.join(output, "summary.md"),
    `# TCG Nexus application pilot\n\nReal Next.js + NestJS API + PostgreSQL. Fresh synthetic database per run. No external network or host volumes.\n\nField: price ${field}. Test: \`${generated.sha256}\`\n\n${report.runs.map((run) => `- ${run.variant} ${run.index}: ${run.status}; observed ${JSON.stringify(run.evidence.observedValue)}; API/navigation ready: ${run.evidence.applicationReady === true}`).join("\n")}\n\nAcceptance: ${accepted ? "PASS" : "FAIL"}.\n`,
  );
  if (!accepted) process.exitCode = 1;
} catch (error) {
  report.state = "failed";
  await save();
  console.error(error.message);
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
}
