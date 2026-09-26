import { z } from "zod";

export * from "./environment.js";
export * from "./reproduction.js";
export * from "./trace.js";

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
