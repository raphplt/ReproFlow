import { describe, expect, it } from "vitest";
import { traceFixture } from "../../../tests/fixtures.js";
import { reconstruct } from "./index.js";

describe("reconstruction", () => {
  it("deduplicates click/submit and stops at the user marker", () => {
    const trace = traceFixture();
    trace.events.push({
      sequence: 8,
      timestampMs: 60,
      payload: { type: "click", pagePath: "/cart", target: "checkout" },
    });
    const scenario = reconstruct(trace);
    expect(scenario.steps).toHaveLength(5);
    expect(scenario.steps[3]?.sourceSequences).toEqual([3, 4]);
    expect(scenario.observed).toEqual({
      path: "/cart",
      postalCodeError: true,
      checkout500: true,
    });
  });
  it("coalesces adjacent typing, including masked intermediate prefixes", () => {
    const trace = traceFixture();
    trace.events.splice(2, 0, {
      sequence: 2,
      timestampMs: 3,
      payload: {
        type: "input",
        target: "postal-code",
        pagePath: "/cart",
        value: "[REDACTED]",
      },
    });
    trace.events.forEach((event, index) => {
      event.sequence = index;
      event.timestampMs = index + 1;
    });
    trace.brokenState.afterSequence = 8;
    expect(reconstruct(trace).steps[2]).toEqual({
      action: { type: "fill", target: "postal-code", value: "69001" },
      sourceSequences: [2, 3],
    });
  });
  it("preserves fills across a rerender or state boundary", () => {
    const trace = traceFixture();
    trace.events.splice(
      3,
      0,
      {
        sequence: 3,
        timestampMs: 4,
        payload: { type: "navigation", pagePath: "/cart" },
      },
      {
        sequence: 4,
        timestampMs: 5,
        payload: {
          type: "input",
          target: "postal-code",
          pagePath: "/cart",
          value: "75001",
        },
      },
    );
    trace.events.forEach((event, index) => {
      event.sequence = index;
      event.timestampMs = index + 1;
    });
    trace.brokenState.afterSequence = 9;
    expect(
      reconstruct(trace).steps.filter((step) => step.action.type === "fill"),
    ).toHaveLength(2);
    expect(reconstruct(trace).steps[3]?.action).toEqual({
      type: "expect-path",
      path: "/cart",
    });
  });
  it("replays keyboard form submission without requiring a click", () => {
    const trace = traceFixture();
    trace.events.splice(3, 1);
    trace.events.forEach((event, index) => {
      event.sequence = index;
    });
    trace.brokenState.afterSequence = 6;
    expect(reconstruct(trace).steps[3]?.action.type).toBe("submit");
  });
  it.each(["unknown", "address-form"])(
    "rejects ambiguous click target %s",
    (target) => {
      const trace = traceFixture();
      const event = trace.events[1];
      if (event) event.payload.target = target;
      expect(() => reconstruct(trace)).toThrow("unsupported_action");
    },
  );
  it("rejects a final masked value and missing oracle", () => {
    const trace = traceFixture();
    const event = trace.events[2];
    if (event) event.payload.value = "[REDACTED]";
    expect(() => reconstruct(trace)).toThrow("masked_input");
    expect(() =>
      reconstruct({ ...trace, status: "incomplete", brokenState: null }),
    ).toThrow("incomplete_capture");
  });
});
