import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  RecordingTraceSchema,
  type Report,
  ReportSchema,
} from "@reproflow/event-schema";
import { generate } from "@reproflow/playwright-generator";
import { reconstruct } from "@reproflow/reconstruction";
import { runIsolated } from "@reproflow/runner";
import { renderReport } from "./views.js";

export async function reproduce(
  raw: unknown,
  root: string,
  count = 3,
  onProgress?: (report: Report) => void,
  signal?: AbortSignal,
) {
  if (!Number.isInteger(count) || count < 1 || count > 5)
    throw new Error("invalid_run_count");
  const trace = RecordingTraceSchema.parse(raw);
  const scenario = reconstruct(trace);
  const generated = generate(scenario);
  const report: Report = {
    schemaVersion: 1,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    scenario,
    source: generated.source,
    testSha256: generated.sha256,
    runs: [],
    state: "running",
  };
  const directory = join(root, report.id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // Normalize the only free-form trace field before persisting an imported recording.
  await writeFile(
    join(directory, "recording.json"),
    JSON.stringify(
      {
        ...trace,
        environment: {
          ...trace.environment,
          userAgent: "ReproFlow synthetic capture",
        },
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  await writeFile(
    join(directory, "scenario.json"),
    JSON.stringify(scenario, null, 2),
    { mode: 0o600 },
  );
  await writeFile(join(directory, "reproduction.spec.js"), generated.source, {
    mode: 0o600,
  });
  const save = async () => {
    ReportSchema.parse(report);
    await writeFile(
      join(directory, "report.json.tmp"),
      JSON.stringify(report, null, 2),
      { mode: 0o600 },
    );
    await rename(
      join(directory, "report.json.tmp"),
      join(directory, "report.json"),
    );
    await writeFile(
      join(directory, "report.html"),
      renderReport(report, false),
      { mode: 0o600 },
    );
    onProgress?.(report);
  };
  await save();
  try {
    for (const variant of ["buggy", "fixed"] as const) {
      for (let index = 1; index <= count; index++) {
        if (signal?.aborted) {
          report.state = "failed";
          await save();
          return report;
        }
        report.runs.push(
          await runIsolated(scenario, generated.source, variant, index, signal),
        );
        await save();
        // An unavailable runner is actionable once; do not repeat identical infrastructure failures.
        if (report.runs.at(-1)?.status === "infrastructure_failure") {
          report.state = "failed";
          await save();
          return report;
        }
      }
    }
    report.state = "complete";
    await save();
    return report;
  } catch {
    report.state = "failed";
    await save();
    throw new Error("pipeline_failed");
  }
}
