import { generateElement } from "@reproflow/playwright-generator";
import { describe, expect, it } from "vitest";
import {
  elementEvidence,
  elementScenario,
} from "../../../tests/element-fixtures.js";
import { runElementIsolated } from "./element.js";
import { classifyElement } from "./element-classify.js";

describe("component evidence classification", () => {
  it("requires the captured mismatch and completed actions", () => {
    expect(classifyElement(elementEvidence(), elementScenario())).toBe(
      "reproduced",
    );
    expect(
      classifyElement(
        { ...elementEvidence(), observedValue: "12" },
        elementScenario(),
      ),
    ).toBe("inconclusive");
    expect(
      classifyElement(
        { ...elementEvidence(), outcome: "passed", observedValue: "0" },
        elementScenario(),
      ),
    ).toBe("not_reproduced");
  });
  it.each(["missing", "ambiguous", "unsupported"] as const)(
    "does not reproduce an %s target",
    (targetState) => {
      expect(
        classifyElement(
          { ...elementEvidence(), targetState },
          elementScenario(),
        ),
      ).toBe("generation_failure");
    },
  );
  it("rejects incomplete, masked and runtime-failing evidence", () => {
    expect(
      classifyElement(
        { ...elementEvidence(), completedSteps: 0 },
        elementScenario(),
      ),
    ).toBe("generation_failure");
    expect(
      classifyElement(
        { ...elementEvidence(), targetState: "masked" },
        elementScenario(),
      ),
    ).toBe("inconclusive");
    expect(
      classifyElement(
        { ...elementEvidence(), runtimeError: true },
        elementScenario(),
      ),
    ).toBe("infrastructure_failure");
    expect(
      classifyElement(
        { ...elementEvidence(), observedValue: "999" },
        elementScenario(),
      ),
    ).toBe("inconclusive");
  });
  it("rejects noncanonical source without starting Docker", async () => {
    await expect(
      runElementIsolated(elementScenario(), "arbitrary code", "", "buggy", 1),
    ).rejects.toThrow("Invalid");
  });
  it("honors pre-cancelled runs", async () => {
    const scenario = elementScenario();
    const run = await runElementIsolated(
      scenario,
      generateElement(scenario).source,
      "",
      "buggy",
      1,
      AbortSignal.abort(),
    );
    expect(run.status).toBe("infrastructure_failure");
  });
});
