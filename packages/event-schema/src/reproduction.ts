import { z } from "zod";

export const ReplayStepSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("goto"), path: z.literal("/cart") }),
  z.strictObject({
    type: z.literal("expect-path"),
    path: z.enum(["/cart", "/checkout"]),
  }),
  z.strictObject({
    type: z.literal("click"),
    target: z.enum(["edit-address", "postal-code", "save-address", "checkout"]),
  }),
  z.strictObject({
    type: z.literal("fill"),
    target: z.literal("postal-code"),
    value: z.enum(["75001", "69001"]),
  }),
  z.strictObject({
    type: z.literal("submit"),
    target: z.literal("address-form"),
  }),
]);
export const ScenarioSchema = z.strictObject({
  schemaVersion: z.literal(1),
  recordingId: z.uuid(),
  fixture: z.literal("demo-shop-v1"),
  viewport: z.strictObject({
    width: z.number().int().min(320).max(3840),
    height: z.number().int().min(240).max(2160),
  }),
  steps: z
    .array(
      z.strictObject({
        action: ReplayStepSchema,
        sourceSequences: z.array(z.number().int().nonnegative()).min(1),
      }),
    )
    .min(1)
    .max(100),
  oracle: z.strictObject({
    expectedPath: z.literal("/checkout"),
    confirmedByUser: z.literal(true),
  }),
  observed: z.strictObject({
    path: z.enum(["/cart", "/checkout"]),
    postalCodeError: z.boolean(),
    checkout500: z.boolean(),
  }),
});
export type Scenario = z.infer<typeof ScenarioSchema>;
export type ReplayStep = z.infer<typeof ReplayStepSchema>;
export const RunEvidenceSchema = z.strictObject({
  outcome: z.enum([
    "passed",
    "oracle-failed",
    "replay-failed",
    "infrastructure-failed",
  ]),
  observedPath: z.enum(["/cart", "/checkout", "[REDACTED]"]),
  postalCodeError: z.boolean(),
  checkoutStatuses: z
    .array(z.number().int().min(100).max(599).nullable())
    .max(100),
  completedSteps: z.number().int().nonnegative().max(100),
  durationMs: z.number().int().nonnegative(),
  browserVersion: z
    .string()
    .regex(/^\d+(\.\d+){1,3}$/)
    .nullable(),
});
export type RunEvidence = z.infer<typeof RunEvidenceSchema>;
export const RunStatusSchema = z.enum([
  "reproduced",
  "not_reproduced",
  "inconclusive",
  "generation_failure",
  "infrastructure_failure",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;
export const RunResultSchema = z.strictObject({
  index: z.number().int().min(1).max(5),
  variant: z.enum(["buggy", "fixed"]),
  status: RunStatusSchema,
  evidence: RunEvidenceSchema,
  testSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type RunResult = z.infer<typeof RunResultSchema>;

export const ReportSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  scenario: ScenarioSchema,
  source: z.string().max(50000),
  testSha256: z.string().regex(/^[a-f0-9]{64}$/),
  runs: z.array(RunResultSchema).max(10),
  state: z.enum(["running", "complete", "failed"]),
});
export type Report = z.infer<typeof ReportSchema>;
