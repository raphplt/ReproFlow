import type {
  RunEvidence,
  RunResult,
  RunStatus,
  Scenario,
} from "@reproflow/event-schema";

export function classify(evidence: RunEvidence, scenario: Scenario): RunStatus {
  if (
    evidence.outcome === "infrastructure-failed" ||
    evidence.checkoutStatuses.includes(null)
  )
    return "infrastructure_failure";
  if (
    evidence.outcome === "replay-failed" ||
    evidence.completedSteps !== scenario.steps.length
  )
    return "generation_failure";
  if (
    evidence.outcome === "passed" &&
    evidence.observedPath === scenario.oracle.expectedPath
  )
    return "not_reproduced";
  if (
    evidence.outcome === "oracle-failed" &&
    evidence.observedPath === scenario.observed.path &&
    scenario.observed.path !== scenario.oracle.expectedPath &&
    scenario.observed.postalCodeError &&
    scenario.observed.checkout500 &&
    evidence.postalCodeError &&
    evidence.checkoutStatuses.includes(500)
  )
    return "reproduced";
  return "inconclusive";
}

export function summarize(runs: RunResult[]) {
  const reproduced = runs.filter((run) => run.status === "reproduced").length;
  const passed = runs.filter((run) => run.status === "not_reproduced").length;
  const comparable =
    new Set(
      runs
        .filter(
          (run) =>
            run.status === "reproduced" || run.status === "not_reproduced",
        )
        .map(
          (run) =>
            `${run.variant}:${run.testSha256}:${run.evidence.browserVersion}`,
        ),
    ).size <= 1;
  const status =
    comparable && reproduced && passed
      ? "flaky"
      : runs.length > 0 && runs.every((run) => run.status === runs[0]?.status)
        ? runs[0]?.status
        : "inconclusive";
  return {
    status,
    total: runs.length,
    reproduced,
    passed,
    unusable: runs.length - reproduced - passed,
  };
}
