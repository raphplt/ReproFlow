import { createHash } from "node:crypto";
import {
  type ElementEvidence,
  ElementEvidenceSchema,
  ElementScenarioSchema,
} from "@reproflow/event-schema";
import { generateElement } from "@reproflow/playwright-generator";
import { MAX_COMPONENT_BYTES } from "./component-fixture.js";
import { classifyElement } from "./element-classify.js";
import { executeIsolated } from "./isolation.js";

export function elementInfrastructure(): ElementEvidence {
  return {
    outcome: "infrastructure-failed",
    targetState: "missing",
    observedValue: null,
    runtimeError: false,
    completedSteps: 0,
    durationMs: 0,
    browserVersion: null,
  };
}

export async function runElementIsolated(
  raw: unknown,
  source: string,
  bundle: string,
  variant: "buggy" | "fixed",
  index: number,
  signal?: AbortSignal,
) {
  const scenario = ElementScenarioSchema.parse(raw);
  const generated = generateElement(scenario);
  if (
    source !== generated.source ||
    Buffer.byteLength(bundle) > MAX_COMPONENT_BYTES ||
    !["buggy", "fixed"].includes(variant) ||
    !Number.isInteger(index) ||
    index < 1 ||
    index > 5
  )
    throw new Error("Invalid component run request");
  const start = Date.now();
  const evidence = await executeIsolated(
    { kind: "component-value", scenario, source, bundle },
    (raw) => ElementEvidenceSchema.parse(raw),
    elementInfrastructure,
    signal,
  );
  if (evidence.outcome === "infrastructure-failed")
    evidence.durationMs = Date.now() - start;
  return {
    index,
    variant,
    status: classifyElement(evidence, scenario),
    evidence,
    testSha256: generated.sha256,
    fixtureSha256: createHash("sha256").update(bundle).digest("hex"),
  };
}
