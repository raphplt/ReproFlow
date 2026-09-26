import { describe, expect, it } from "vitest";
import { scenarioFixture } from "../../../tests/fixtures.js";
import { generate } from "./index.js";

describe("generator", () => {
  it("is deterministic and retains the confirmed oracle", () => {
    const scenario = scenarioFixture();
    expect(generate(scenario)).toEqual(generate(structuredClone(scenario)));
    expect(generate(scenario).source).toContain(
      'await expect(page).toHaveURL(new URL("/checkout", baseURL).href)',
    );
    expect(generate(scenario).source).toContain(
      'getByTestId("postal-code").fill("69001")',
    );
  });
  it("rejects executable text, changed assertions and unconfirmed expectations", () => {
    const scenario = scenarioFixture();
    expect(() =>
      generate({
        ...scenario,
        oracle: { expectedPath: "/cart", confirmedByUser: true },
      }),
    ).toThrow();
    expect(() =>
      generate({
        ...scenario,
        oracle: { expectedPath: "/checkout", confirmedByUser: false },
      }),
    ).toThrow();
    expect(() =>
      generate({
        ...scenario,
        steps: [
          {
            action: {
              type: "fill",
              target: "postal-code",
              value: '"; process.exit()',
            },
            sourceSequences: [1],
          },
        ],
      }),
    ).toThrow();
  });
});
