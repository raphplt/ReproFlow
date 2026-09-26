// Synthetic test data only; acceptance tests use an actual Chromium recording.
export const scenarioFixture = () => ({
  schemaVersion: 1 as const,
  recordingId: "00000000-0000-4000-8000-000000000001",
  fixture: "demo-shop-v1" as const,
  viewport: { width: 1440, height: 1000 },
  steps: [
    {
      action: { type: "goto" as const, path: "/cart" as const },
      sourceSequences: [0],
    },
    {
      action: { type: "click" as const, target: "edit-address" as const },
      sourceSequences: [1],
    },
    {
      action: {
        type: "fill" as const,
        target: "postal-code" as const,
        value: "69001" as const,
      },
      sourceSequences: [2],
    },
    {
      action: { type: "click" as const, target: "save-address" as const },
      sourceSequences: [3, 4],
    },
    {
      action: { type: "click" as const, target: "checkout" as const },
      sourceSequences: [5],
    },
  ],
  oracle: {
    expectedPath: "/checkout" as const,
    confirmedByUser: true as const,
  },
  observed: {
    path: "/cart" as const,
    postalCodeError: true,
    checkout500: true,
  },
});

export const traceFixture = () => ({
  schemaVersion: 1,
  recordingId: scenarioFixture().recordingId,
  status: "captured",
  policy: "demo-shop-v1",
  startedAtMs: 0,
  endedAtMs: 100,
  environment: {
    browser: "chromium",
    viewport: { width: 1440, height: 1000 },
    userAgent: "Synthetic fixture",
  },
  droppedEvents: 0,
  events: [
    { type: "navigation", pagePath: "/cart" },
    { type: "click", pagePath: "/cart", target: "edit-address" },
    { type: "input", pagePath: "/cart", target: "postal-code", value: "69001" },
    { type: "click", pagePath: "/cart", target: "save-address" },
    { type: "submit", pagePath: "/cart", target: "address-form" },
    { type: "click", pagePath: "/cart", target: "checkout" },
    { type: "network", pagePath: "/api/checkout", method: "POST", status: 500 },
    {
      type: "console-error",
      pagePath: "/cart",
      code: "ADDRESS_POSTAL_CODE_MISSING",
    },
  ].map((payload, sequence) => ({
    payload,
    sequence,
    timestampMs: sequence + 1,
  })),
  brokenState: {
    afterSequence: 7,
    timestampMs: 50,
    expectedPath: "/checkout",
    observedPath: "/cart",
    confirmedByUser: true,
  },
});
