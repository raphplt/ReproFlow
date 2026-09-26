import { generateElement } from "@reproflow/playwright-generator";
import { describe, expect, it } from "vitest";
import {
  applicationScenario,
  elementBundle,
  elementScenario,
} from "../../../tests/element-fixtures.js";
import { runElementIsolated } from "../src/element.js";

describe("isolated component oracle", () => {
  it("does not reproduce an application bug when API readiness is absent", async () => {
    const scenario = applicationScenario();
    if (scenario.application) scenario.application.entryPath = "/";
    const result = await runElementIsolated(
      scenario,
      generateElement(scenario).source,
      elementBundle(),
      "buggy",
      1,
    );
    expect(result.status).toBe("infrastructure_failure");
    expect(result.evidence.applicationReady).toBe(false);
  });
  it("runs the exact same test red then green", async () => {
    const scenario = elementScenario();
    const test = generateElement(scenario);
    const red = await runElementIsolated(
      scenario,
      test.source,
      elementBundle(),
      "buggy",
      1,
    );
    const green = await runElementIsolated(
      scenario,
      test.source,
      elementBundle(true),
      "fixed",
      1,
    );
    expect(red.status).toBe("reproduced");
    expect(green.status).toBe("not_reproduced");
    expect(red.testSha256).toBe(green.testSha256);
    expect(red.evidence.observedValue).toBe("");
    expect(green.evidence.observedValue).toBe("0");
  });
  it.each([
    [
      "missing",
      "document.getElementById('root').innerHTML = '';",
      "generation_failure",
    ],
    [
      "ambiguous",
      "document.getElementById('root').innerHTML = '<input type=number placeholder=Price><input type=number placeholder=Price>';",
      "generation_failure",
    ],
    [
      "runtime error",
      `${elementBundle()}\nthrow new Error('private error text');`,
      "infrastructure_failure",
    ],
    [
      "masked",
      `${elementBundle()}\ndocument.querySelector('input').addEventListener('input', e => e.target.value = '987654');`,
      "inconclusive",
    ],
  ])(
    "does not mistake %s for the reported bug",
    async (_label, bundle, status) => {
      const scenario = elementScenario();
      const run = await runElementIsolated(
        scenario,
        generateElement(scenario).source,
        bundle,
        "buggy",
        1,
      );
      expect(run.status).toBe(status);
      expect(JSON.stringify(run)).not.toContain("private error text");
      expect(JSON.stringify(run)).not.toContain("987654");
    },
  );
});
