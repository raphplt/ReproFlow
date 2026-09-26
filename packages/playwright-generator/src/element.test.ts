import { describe, expect, it } from "vitest";
import { elementScenario } from "../../../tests/element-fixtures.js";
import { elementLocatorSource, generateElement } from "./element.js";

describe("component generator", () => {
  it("is canonical and preserves the confirmed value", () => {
    const scenario = elementScenario();
    const generated = generateElement(scenario);
    expect(generated).toEqual(generateElement(scenario));
    expect(generated.source).toContain('toHaveValue("0")');
    expect(generated.source).toContain("toHaveCount(1)");
    expect(generated.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("quotes configured locators rather than interpolating executable code", () => {
    const value = '"); throw new Error("injection"); //';
    expect(elementLocatorSource({ kind: "label", value })).toBe(
      `page.getByLabel(${JSON.stringify(value)}, { exact: true })`,
    );
    expect(elementLocatorSource({ kind: "testId", value: "price" })).toBe(
      'page.getByTestId("price")',
    );
    expect(
      elementLocatorSource({ kind: "role", role: "button", name: "Filters" }),
    ).toBe('page.getByRole("button", { name: "Filters", exact: true })');
  });
});
