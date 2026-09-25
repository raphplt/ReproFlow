import { z } from "zod";

/** Initial capture target. Extend through a versioned trace contract later. */
export const BrowserEnvironmentSchema = z.strictObject({
  browser: z.literal("chromium"),
  viewport: z.strictObject({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  userAgent: z.string().trim().min(1),
});

export type BrowserEnvironment = z.infer<typeof BrowserEnvironmentSchema>;

export const RecordingStatusSchema = z.enum([
  "recording",
  "uploaded",
  "processing",
  "completed",
  "failed",
]);

export type RecordingStatus = z.infer<typeof RecordingStatusSchema>;

/** Pipeline status only; execution evidence is required to classify a result. */
export const ReproductionStatusSchema = z.enum([
  "draft",
  "generated",
  "running",
  "reproduced",
  "flaky",
  "not_reproduced",
  "failed",
]);

export type ReproductionStatus = z.infer<typeof ReproductionStatusSchema>;
