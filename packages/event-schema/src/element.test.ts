import { describe, expect, it } from "vitest";
import {
  applicationScenario,
  elementScenario,
} from "../../../tests/element-fixtures.js";
import { ElementScenarioSchema } from "./element.js";

describe("component scenario boundary", () => {
  it("rejects long invalid paths and repeated separators", () => {
    const scenario = applicationScenario();
    for (const field of ["entryPath", "responsePath"]) {
      for (const value of [`/${"a".repeat(190)}!`, "/catalog//cards"]) {
        expect(
          ElementScenarioSchema.safeParse({
            ...scenario,
            application: { ...scenario.application, [field]: value },
          }).success,
        ).toBe(false);
      }
    }
  });
  it("requires explicit application readiness and forbids external URLs", () => {
    expect(ElementScenarioSchema.parse(applicationScenario()).kind).toBe(
      "application-value",
    );
    expect(
      ElementScenarioSchema.safeParse({
        ...elementScenario(),
        kind: "application-value",
      }).success,
    ).toBe(false);
    const scenario = applicationScenario();
    expect(
      ElementScenarioSchema.safeParse({
        ...scenario,
        application: { ...scenario.application, entryPath: "//external.test" },
      }).success,
    ).toBe(false);
    expect(
      ElementScenarioSchema.safeParse({ ...scenario, kind: "component-value" })
        .success,
    ).toBe(false);
  });
  it("accepts explicitly allowed synthetic values", () => {
    expect(ElementScenarioSchema.parse(elementScenario())).toEqual(
      elementScenario(),
    );
  });
  it.each([
    {
      oracle: {
        target: "constructor",
        expectedValue: "0",
        confirmedByUser: true,
      },
    },
    {
      steps: [
        { sequence: 0, action: { type: "click", target: "constructor" } },
      ],
    },
    { oracle: { target: "price", expectedValue: "0", confirmedByUser: false } },
    { observedValue: "someone@example.test" },
    { observedValue: "45" },
    {
      steps: [
        { sequence: 2, action: { type: "fill", target: "price", value: "0" } },
      ],
    },
    {
      steps: [
        {
          sequence: 0,
          action: { type: "fill", target: "unknown", value: "0" },
        },
      ],
    },
    {
      steps: [
        { sequence: 0, action: { type: "fill", target: "price", value: "45" } },
      ],
    },
    { rawDom: "private content" },
  ])("rejects unconfirmed, masked, invalid or extra data", (patch) => {
    expect(
      ElementScenarioSchema.safeParse({ ...elementScenario(), ...patch })
        .success,
    ).toBe(false);
  });
});
