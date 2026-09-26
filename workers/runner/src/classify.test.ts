import type { RunEvidence, RunResult, Scenario } from "@reproflow/event-schema";
import { generate } from "@reproflow/playwright-generator";
import { describe, expect, it } from "vitest";
import { scenarioFixture } from "../../../tests/fixtures.js";
import { classify, summarize } from "./classify.js";
import { containerArgs, runIsolated } from "./index.js";

const scenario: Scenario = scenarioFixture();
const evidence: RunEvidence = {
  outcome: "oracle-failed",
  observedPath: "/cart",
  postalCodeError: true,
  checkoutStatuses: [500],
  completedSteps: 5,
  durationMs: 2000,
  browserVersion: "149.0.0.0",
};
describe("evidence classification", () => {
  it("requires the full matching signature and completed replay", () => {
    expect(classify(evidence, scenario)).toBe("reproduced");
    expect(classify({ ...evidence, completedSteps: 4 }, scenario)).toBe(
      "generation_failure",
    );
    expect(classify({ ...evidence, outcome: "replay-failed" }, scenario)).toBe(
      "generation_failure",
    );
    expect(classify({ ...evidence, postalCodeError: false }, scenario)).toBe(
      "inconclusive",
    );
    expect(classify({ ...evidence, checkoutStatuses: [503] }, scenario)).toBe(
      "inconclusive",
    );
    expect(classify({ ...evidence, checkoutStatuses: [null] }, scenario)).toBe(
      "infrastructure_failure",
    );
    expect(
      classify(
        {
          ...evidence,
          outcome: "passed",
          observedPath: "/checkout",
          checkoutStatuses: [200],
        },
        scenario,
      ),
    ).toBe("not_reproduced");
  });
  it("does not call infrastructure errors or different variants flaky", () => {
    const base: RunResult = {
      variant: "buggy",
      index: 1,
      evidence,
      testSha256: generate(scenario).sha256,
      status: "reproduced",
    };
    expect(
      summarize([base, { ...base, index: 2, status: "infrastructure_failure" }])
        .status,
    ).toBe("inconclusive");
    expect(
      summarize([base, { ...base, index: 2, status: "not_reproduced" }]).status,
    ).toBe("flaky");
    expect(
      summarize([
        base,
        { ...base, index: 2, status: "not_reproduced" },
        {
          ...base,
          index: 3,
          status: "infrastructure_failure",
          evidence: { ...evidence, browserVersion: null },
        },
      ]).status,
    ).toBe("flaky");
    expect(
      summarize([base, { ...base, variant: "fixed", status: "not_reproduced" }])
        .status,
    ).toBe("inconclusive");
  });
  it("uses a system isolation boundary and refuses altered source before execution", async () => {
    const args = containerArgs("test");
    expect(args).toContain("--network=none");
    expect(args).toContain("--read-only");
    expect(args).toContain("--cap-drop=ALL");
    expect(args.join(" ")).not.toContain("--volume");
    await expect(
      runIsolated(scenario, "process.exit(0)", "buggy"),
    ).rejects.toThrow("canonical");
  });
});
