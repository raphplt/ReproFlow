import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";
import { captureElement } from "../../apps/recorder/dist/recorder.js";
import { generateElement } from "../../packages/playwright-generator/dist/index.js";
import {
  runElementIsolated,
  startComponentFixture,
} from "../../workers/runner/dist/index.js";

const { values } = parseArgs({
  options: {
    repo: { type: "string" },
    "before-ref": { type: "string" },
    "confirm-zero": { type: "boolean", default: false },
    "capture-only": { type: "boolean", default: false },
    field: { type: "string", default: "min" },
  },
});
if (
  !values.repo ||
  !values["confirm-zero"] ||
  !/^[a-f0-9]{40}$/.test(values["before-ref"] ?? "") ||
  !["min", "max"].includes(values.field)
) {
  throw new Error(
    "Usage: pnpm pilot:tcg --repo /path/to/tcg-nexus --before-ref <full-commit> --confirm-zero [--field min|max] [--capture-only]. Confirm that entering 0 must retain the visible value 0.",
  );
}
const repo = path.resolve(values.repo);
const web = path.join(repo, "apps/web");
const componentPath =
  "apps/web/app/[locale]/(main)/marketplace/_components/MarketplaceSearch.tsx";
const component = path.join(repo, componentPath);
const git = (...args) =>
  execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 2_000_000,
  }).trimEnd();
const baseline = execFileSync(
  "git",
  ["show", `${values["before-ref"]}:${componentPath}`],
  { cwd: repo, encoding: "utf8", maxBuffer: 500_000 },
);
const current = await readFile(component, "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const output = path.resolve("artifacts/pilots", randomUUID());
await mkdir(output, { recursive: true });

// Build only trusted, local source. No Next server, dotenv loading, backend or seed.
const require = createRequire(path.join(repo, "package.json"));
const esbuild = require("esbuild");
const entry = `import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import messages from "./messages/fr.json";
import MarketplaceSearch from ${JSON.stringify(component)};
function Fixture() {
  const [filters, setFilters] = useState({ search: "", sortBy: "name", sortOrder: "ASC" });
  const [showFilters, setShowFilters] = useState(false);
  return <NextIntlClientProvider locale="fr" timeZone="UTC" messages={messages}>
    <MarketplaceSearch filters={filters} activeFiltersCount={0} showFilters={showFilters}
      setShowFilters={setShowFilters} resetFilters={() => setFilters({ search: "", sortBy: "name", sortOrder: "ASC" })}
      series={[]} sets={[]} updateFilters={patch => setFilters(previous => ({ ...previous, ...patch }))} />
  </NextIntlClientProvider>;
}
createRoot(document.getElementById("root")).render(<Fixture />);`;

async function bundle(source) {
  const result = await esbuild.build({
    absWorkingDir: repo,
    stdin: {
      contents: entry,
      loader: "tsx",
      resolveDir: web,
      sourcefile: "reproflow-component-fixture.tsx",
    },
    bundle: true,
    write: false,
    minify: true,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    metafile: true,
    alias: { "@": web },
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.NEXT_PUBLIC_API_URL": '"/api"',
      "process.env.NEXT_PUBLIC_SEALED_CDN_URL": '"/disabled"',
    },
    plugins: [
      {
        name: "baseline-component",
        setup(build) {
          build.onLoad({ filter: /MarketplaceSearch\.tsx$/ }, (args) =>
            args.path === component
              ? {
                  contents: source,
                  loader: "tsx",
                  resolveDir: path.dirname(component),
                }
              : undefined,
          );
        },
      },
    ],
  });
  const inputHashes = {};
  for (const filename of Object.keys(result.metafile.inputs).sort()) {
    if (filename === "apps/web/reproflow-component-fixture.tsx") {
      inputHashes[filename] = hash(entry);
      continue;
    }
    inputHashes[filename] = hash(
      path.resolve(repo, filename) === component
        ? source
        : await readFile(path.resolve(repo, filename)),
    );
  }
  return { source: result.outputFiles[0].text, inputHashes };
}

const buggy = await bundle(baseline);
const field = values.field;
const draft = {
  schemaVersion: 2,
  kind: "component-value",
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
const fixture = await startComponentFixture(buggy.source);
let scenario;
try {
  scenario = await captureElement(draft, fixture.url);
} finally {
  await fixture.close();
}
const generated = generateElement(scenario);
await writeFile(
  path.join(output, "scenario.json"),
  JSON.stringify(scenario, null, 2),
);
await writeFile(path.join(output, "reproduction.spec.js"), generated.source);
await writeFile(path.join(output, "buggy.js"), buggy.source);
console.log(
  `Captured price ${field}: expected ${JSON.stringify(scenario.oracle.expectedValue)}, observed ${JSON.stringify(scenario.observedValue)}.`,
);
console.log(`Artifacts: ${output}`);
if (values["capture-only"]) process.exit(0);
if (scenario.observedValue === scenario.oracle.expectedValue)
  throw new Error("Baseline did not show the expected defect");
if (current === baseline)
  throw new Error("No local correction to compare; use --capture-only first");
const fixed = await bundle(current);
const unchangedInputs = (inputs) =>
  Object.fromEntries(
    Object.entries(inputs).filter(([name]) => name !== componentPath),
  );
if (
  JSON.stringify(unchangedInputs(buggy.inputHashes)) !==
  JSON.stringify(unchangedInputs(fixed.inputHashes))
) {
  throw new Error(
    "Fixture dependencies changed between builds; comparison refused",
  );
}
await writeFile(path.join(output, "fixed.js"), fixed.source);
const report = {
  schemaVersion: 2,
  kind: "component-pilot",
  state: "running",
  createdAt: new Date().toISOString(),
  scope:
    "Real MarketplaceSearch component; synthetic React parent; no Next routing, API, database or production data.",
  provenance: {
    baselineCommit: values["before-ref"],
    checkoutCommit: git("rev-parse", "HEAD"),
    componentPath,
    baselineComponentSha256: hash(baseline),
    fixedComponentSha256: hash(current),
    lockfileSha256: hash(await readFile(path.join(repo, "package-lock.json"))),
    esbuildVersion: esbuild.version,
    harnessSha256: hash(entry),
    buggyInputs: buggy.inputHashes,
    fixedInputs: fixed.inputHashes,
  },
  scenario,
  testSha256: generated.sha256,
  runs: [],
};
const save = () =>
  writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
await save();
const controller = new AbortController();
const cancel = () => controller.abort();
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);
try {
  for (const [variant, fixtureBundle] of [
    ["buggy", buggy.source],
    ["fixed", fixed.source],
  ]) {
    for (let index = 1; index <= 3; index++) {
      if (controller.signal.aborted) throw new Error("Pilot cancelled");
      const run = await runElementIsolated(
        scenario,
        generated.source,
        fixtureBundle,
        variant,
        index,
        controller.signal,
      );
      report.runs.push(run);
      await save();
      console.log(
        `${variant} ${index}/3: ${run.status} (${run.evidence.durationMs} ms)`,
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
        run.status ===
          (run.variant === "buggy" ? "reproduced" : "not_reproduced"),
    );
  report.state = accepted ? "complete" : "failed";
  await save();
  await writeFile(
    path.join(output, "summary.md"),
    `# TCG Nexus component pilot\n\n${report.scope}\n\nField: price ${field}. Expected: \`0\`. Captured: \`${scenario.observedValue || "(empty)"}\`.\n\nTest SHA-256: \`${generated.sha256}\`\n\n${report.runs.map((run) => `- ${run.variant} ${run.index}: ${run.status}; observed ${JSON.stringify(run.evidence.observedValue)}; ${run.evidence.durationMs} ms`).join("\n")}\n\nAcceptance: ${accepted ? "PASS" : "FAIL"}. No TCG Nexus push performed.\n`,
  );
  if (!accepted) process.exitCode = 1;
} catch (error) {
  report.state = "failed";
  await save();
  throw error;
} finally {
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
}
