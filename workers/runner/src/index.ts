import {
  type RunEvidence,
  RunEvidenceSchema,
  type RunResult,
  ScenarioSchema,
} from "@reproflow/event-schema";
import { generate } from "@reproflow/playwright-generator";
import { classify } from "./classify.js";
import { executeIsolated } from "./isolation.js";

export {
  captureApplicationIsolated,
  runApplicationIsolated,
} from "./application.js";
export { classify, summarize } from "./classify.js";
export { startComponentFixture } from "./component-fixture.js";
export { runElementIsolated } from "./element.js";
export { containerArgs, RUNNER_IMAGE } from "./isolation.js";

export const infrastructureEvidence = (): RunEvidence => ({
  outcome: "infrastructure-failed",
  observedPath: "[REDACTED]",
  postalCodeError: false,
  checkoutStatuses: [],
  completedSteps: 0,
  durationMs: 0,
  browserVersion: null,
});

export async function runIsolated(
  raw: unknown,
  source: string,
  variant: "buggy" | "fixed",
  index = 1,
  signal?: AbortSignal,
): Promise<RunResult> {
  const scenario = ScenarioSchema.parse(raw);
  const generated = generate(scenario);
  if (source !== generated.source)
    throw new Error("Only the canonical generated test can run in this POC");
  if (
    !Number.isInteger(index) ||
    index < 1 ||
    index > 5 ||
    !["buggy", "fixed"].includes(variant)
  )
    throw new Error("Invalid run options");
  const started = Date.now();
  const evidence = await executeIsolated(
    { scenario, source, variant },
    (raw) => RunEvidenceSchema.parse(raw),
    infrastructureEvidence,
    signal,
  );
  if (evidence.outcome === "infrastructure-failed" && evidence.durationMs === 0)
    evidence.durationMs = Date.now() - started;
  return {
    index,
    variant,
    status: classify(evidence, scenario),
    evidence,
    testSha256: generated.sha256,
  };
}
