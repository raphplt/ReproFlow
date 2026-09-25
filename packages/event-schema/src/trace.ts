import { z } from "zod";
import { BrowserEnvironmentSchema } from "./environment.js";

// Deliberately narrow capture policy for the synthetic demo, not arbitrary sites.
export const DemoPathSchema = z.enum([
  "/cart",
  "/checkout",
  "/api/checkout",
  "[REDACTED]",
]);
export const DemoTargetSchema = z.enum([
  "edit-address",
  "postal-code",
  "save-address",
  "address-form",
  "checkout",
  "unknown",
]);
export const CapturedValueSchema = z.union([
  z.literal("[REDACTED]"),
  z.enum(["75001", "69001"]),
]);
export const CapturePayloadSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("navigation"), pagePath: DemoPathSchema }),
  z.strictObject({
    type: z.literal("click"),
    pagePath: DemoPathSchema,
    target: DemoTargetSchema,
  }),
  z.strictObject({
    type: z.literal("input"),
    pagePath: DemoPathSchema,
    target: DemoTargetSchema,
    value: CapturedValueSchema,
  }),
  z.strictObject({
    type: z.literal("submit"),
    pagePath: DemoPathSchema,
    target: DemoTargetSchema,
  }),
  z.strictObject({
    type: z.literal("console-error"),
    pagePath: DemoPathSchema,
    code: z.enum(["ADDRESS_POSTAL_CODE_MISSING", "[REDACTED]"]),
  }),
  z.strictObject({
    type: z.literal("network"),
    pagePath: DemoPathSchema,
    method: z.enum(["GET", "POST", "OTHER"]),
    status: z.number().int().min(100).max(599).nullable(),
  }),
]);
export type CapturePayload = z.infer<typeof CapturePayloadSchema>;
export const TraceEventSchema = z.strictObject({
  sequence: z.number().int().nonnegative(),
  timestampMs: z.number().int().nonnegative(),
  payload: CapturePayloadSchema,
});
export type TraceEvent = z.infer<typeof TraceEventSchema>;

export const RecordingTraceSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    recordingId: z.uuid(),
    status: z.enum(["captured", "incomplete"]),
    policy: z.literal("demo-shop-v1"),
    startedAtMs: z.number().int().nonnegative(),
    endedAtMs: z.number().int().nonnegative(),
    environment: BrowserEnvironmentSchema,
    droppedEvents: z.number().int().nonnegative(),
    events: z.array(TraceEventSchema).max(2000),
    brokenState: z
      .strictObject({
        afterSequence: z.number().int().min(-1),
        timestampMs: z.number().int().nonnegative(),
        expectedPath: z.literal("/checkout"),
        observedPath: DemoPathSchema,
        confirmedByUser: z.literal(true),
      })
      .nullable(),
  })
  .superRefine((trace, ctx) => {
    const invalid = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (trace.endedAtMs < trace.startedAtMs)
      invalid("Recording ends before it starts");
    let previousTime = trace.startedAtMs;
    for (const [index, event] of trace.events.entries()) {
      if (event.sequence !== index)
        invalid("Event sequence must be contiguous and ordered");
      if (
        event.timestampMs < previousTime ||
        event.timestampMs > trace.endedAtMs
      )
        invalid("Event outside ordered recording interval");
      previousTime = event.timestampMs;
    }
    if (trace.brokenState) {
      const marker = trace.brokenState;
      if (
        marker.afterSequence >= trace.events.length ||
        marker.timestampMs < trace.startedAtMs ||
        marker.timestampMs > trace.endedAtMs
      )
        invalid("Broken-state marker outside recording");
    }
    if (
      trace.status === "captured" &&
      (!trace.brokenState || trace.droppedEvents > 0)
    )
      invalid(
        "Complete capture needs a confirmed marker and no dropped events",
      );
  });
export type RecordingTrace = z.infer<typeof RecordingTraceSchema>;
