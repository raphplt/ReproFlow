import type {
  ElementEvidence,
  ElementScenario,
} from "../packages/event-schema/src/element.js";

export const elementScenario = (): ElementScenario => ({
  schemaVersion: 2,
  kind: "component-value",
  project: {
    id: "synthetic-component",
    policy: "synthetic-numeric-v1",
    targets: {
      price: {
        locator: { kind: "placeholder", value: "Price" },
        allowedValues: ["", "0", "12"],
      },
    },
  },
  viewport: { width: 1280, height: 800 },
  steps: [
    { sequence: 0, action: { type: "fill", target: "price", value: "0" } },
  ],
  oracle: { target: "price", expectedValue: "0", confirmedByUser: true },
  observedValue: "",
});
export const applicationScenario = (): ElementScenario => ({
  ...elementScenario(),
  kind: "application-value",
  application: {
    entryPath: "/catalog",
    readyTarget: { kind: "role", role: "heading", name: "Synthetic Card" },
    responsePath: "/api/cards",
    queryKey: "priceMin",
    queryValue: "0",
  },
});
export const applicationBundle = `
document.getElementById('root').innerHTML = '<h1>Synthetic Card</h1><input type="number" placeholder="Price">';
fetch('/api/cards');
document.querySelector('input').addEventListener('input', e => {
  e.target.value = '';
  history.pushState(null, '', '/catalog?priceMin=0');
  fetch('/api/cards?priceMin=0');
});`;

export const elementEvidence = (): ElementEvidence => ({
  outcome: "oracle-failed",
  targetState: "ok",
  observedValue: "",
  runtimeError: false,
  completedSteps: 1,
  durationMs: 100,
  browserVersion: "153.0.0.0",
});
export const elementBundle = (fixed = false) => `
document.getElementById('root').innerHTML = '<input type="number" placeholder="Price">';
document.querySelector('input').addEventListener('input', event => {
  if (!${fixed} && event.target.value === '0') event.target.value = '';
});`;
