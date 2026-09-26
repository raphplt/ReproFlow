import {
  ElementEvidenceSchema,
  ElementScenarioSchema,
} from "@reproflow/event-schema";
import { generateElement } from "@reproflow/playwright-generator";
import { elementInfrastructure } from "./element.js";
import { classifyElement } from "./element-classify.js";
import { executeIsolated } from "./isolation.js";

export async function captureApplicationIsolated(
  raw: unknown,
  imageId: string,
  signal?: AbortSignal,
) {
  const scenario = ElementScenarioSchema.parse(raw);
  if (!scenario.application)
    throw new Error("Application configuration required");
  const result = await executeIsolated(
    {
      kind: "application-value",
      mode: "capture",
      scenario,
      source: generateElement(scenario).source,
      variant: "buggy",
    },
    (value) => ElementScenarioSchema.parse(value),
    () => null,
    signal,
    { kind: "tcg-stack", imageId },
  );
  if (!result) throw new Error("Isolated application capture failed");
  if (
    JSON.stringify({ ...result, observedValue: scenario.observedValue }) !==
    JSON.stringify(scenario)
  )
    throw new Error("Capture changed the confirmed scenario");
  return result;
}

export async function runApplicationIsolated(
  raw: unknown,
  source: string,
  variant: "buggy" | "fixed",
  index: number,
  imageId: string,
  signal?: AbortSignal,
) {
  const scenario = ElementScenarioSchema.parse(raw);
  const generated = generateElement(scenario);
  if (
    !scenario.application ||
    generated.source !== source ||
    !["buggy", "fixed"].includes(variant) ||
    !Number.isInteger(index) ||
    index < 1 ||
    index > 5
  )
    throw new Error("Invalid application run");
  const evidence = await executeIsolated(
    { kind: "application-value", mode: "replay", scenario, source, variant },
    (value) => ElementEvidenceSchema.parse(value),
    elementInfrastructure,
    signal,
    { kind: "tcg-stack", imageId },
  );
  return {
    index,
    variant,
    status: classifyElement(evidence, scenario),
    evidence,
    testSha256: generated.sha256,
    imageId,
  };
}
