import type { ElementEvidence, ElementScenario } from "@reproflow/event-schema";

export function classifyElement(
  evidence: ElementEvidence,
  scenario: ElementScenario,
) {
  if (
    evidence.outcome === "infrastructure-failed" ||
    evidence.runtimeError ||
    (scenario.application && evidence.applicationReady !== true)
  )
    return "infrastructure_failure";
  if (
    evidence.outcome === "replay-failed" ||
    evidence.completedSteps !== scenario.steps.length ||
    ["missing", "ambiguous", "unsupported"].includes(evidence.targetState)
  )
    return "generation_failure";
  const allowed =
    scenario.project.targets[scenario.oracle.target]?.allowedValues;
  if (
    evidence.targetState !== "ok" ||
    evidence.observedValue === null ||
    !allowed?.includes(evidence.observedValue)
  )
    return "inconclusive";
  if (
    evidence.outcome === "passed" &&
    evidence.observedValue === scenario.oracle.expectedValue
  )
    return "not_reproduced";
  if (
    evidence.outcome === "oracle-failed" &&
    evidence.observedValue !== scenario.oracle.expectedValue &&
    evidence.observedValue === scenario.observedValue
  )
    return "reproduced";
  return "inconclusive";
}
