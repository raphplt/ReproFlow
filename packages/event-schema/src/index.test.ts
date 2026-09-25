import { describe, expect, it } from "vitest";
import { BrowserEnvironmentSchema } from "./index.js";

const environment = {
  browser: "chromium",
  viewport: { width: 1440, height: 900 },
  userAgent: "ReproFlow synthetic fixture",
};

describe("browser environment boundary", () => {
  it("accepts a serialized capture environment", () => {
    const payload: unknown = JSON.parse(JSON.stringify(environment));
    expect(BrowserEnvironmentSchema.parse(payload)).toEqual(environment);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1440"])(
    "rejects invalid viewport width %s without coercion",
    (width) => {
      expect(
        BrowserEnvironmentSchema.safeParse({
          ...environment,
          viewport: { ...environment.viewport, width },
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    { ...environment, cookie: "synthetic-secret" },
    {
      ...environment,
      viewport: { ...environment.viewport, token: "synthetic" },
    },
  ])("rejects undeclared fields instead of forwarding them", (payload) => {
    expect(BrowserEnvironmentSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an environment outside the initial browser scope", () => {
    expect(
      BrowserEnvironmentSchema.safeParse({ ...environment, browser: "firefox" })
        .success,
    ).toBe(false);
  });
});
