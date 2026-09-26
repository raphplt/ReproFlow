import {
  RecordingTraceSchema,
  type Scenario,
  ScenarioSchema,
} from "@reproflow/event-schema";

export class ReconstructionError extends Error {
  constructor(
    public readonly code:
      | "incomplete_capture"
      | "unsupported_action"
      | "missing_initial_state"
      | "masked_input"
      | "too_many_steps",
  ) {
    super(code);
  }
}

export function reconstruct(raw: unknown): Scenario {
  const trace = RecordingTraceSchema.parse(raw);
  const marker = trace.brokenState;
  if (trace.status !== "captured" || !marker || trace.droppedEvents > 0)
    throw new ReconstructionError("incomplete_capture");
  if (marker.observedPath !== "/cart" && marker.observedPath !== "/checkout")
    throw new ReconstructionError("unsupported_action");
  const steps: Scenario["steps"] = [];
  const events = trace.events.filter(
    (event) => event.sequence <= marker.afterSequence,
  );
  // Coalesce only contiguous input events. Any intervening event is a state boundary.
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (!event) continue;
    const payload = event.payload;
    const sourceSequences = [event.sequence];
    if (payload.type === "network" || payload.type === "console-error")
      continue;
    if (payload.pagePath !== "/cart" && payload.pagePath !== "/checkout")
      throw new ReconstructionError("unsupported_action");
    if (
      !steps.length &&
      (payload.type !== "navigation" || payload.pagePath !== "/cart")
    )
      throw new ReconstructionError("missing_initial_state");
    if (payload.type === "navigation") {
      steps.push({
        action: !steps.length
          ? { type: "goto", path: "/cart" }
          : { type: "expect-path", path: payload.pagePath },
        sourceSequences,
      });
    } else if (payload.type === "input") {
      if (payload.target !== "postal-code")
        throw new ReconstructionError("unsupported_action");
      let value = payload.value;
      while (events[index + 1]?.payload.type === "input") {
        const next = events[index + 1];
        if (
          next?.payload.type !== "input" ||
          next.payload.target !== payload.target ||
          next.payload.pagePath !== payload.pagePath
        )
          break;
        sourceSequences.push(next.sequence);
        value = next.payload.value;
        index++;
      }
      if (value === "[REDACTED]") throw new ReconstructionError("masked_input");
      steps.push({
        action: { type: "fill", target: "postal-code", value },
        sourceSequences,
      });
    } else if (payload.type === "submit") {
      if (payload.target !== "address-form")
        throw new ReconstructionError("unsupported_action");
      const previous = events[index - 1]?.payload;
      if (previous?.type === "click" && previous.target === "save-address") {
        steps.at(-1)?.sourceSequences.push(event.sequence);
      } else
        steps.push({
          action: { type: "submit", target: "address-form" },
          sourceSequences,
        });
    } else {
      if (payload.target === "unknown" || payload.target === "address-form")
        throw new ReconstructionError("unsupported_action");
      steps.push({
        action: { type: "click", target: payload.target },
        sourceSequences,
      });
    }
  }
  if (!steps.length) throw new ReconstructionError("missing_initial_state");
  if (steps.length > 100) throw new ReconstructionError("too_many_steps");
  return ScenarioSchema.parse({
    schemaVersion: 1,
    recordingId: trace.recordingId,
    fixture: "demo-shop-v1",
    viewport: trace.environment.viewport,
    steps,
    oracle: {
      expectedPath: marker.expectedPath,
      confirmedByUser: marker.confirmedByUser,
    },
    observed: {
      path: marker.observedPath,
      postalCodeError: events.some(
        ({ payload }) =>
          payload.type === "console-error" &&
          payload.code === "ADDRESS_POSTAL_CODE_MISSING",
      ),
      checkout500: events.some(
        ({ payload }) =>
          payload.type === "network" &&
          payload.pagePath === "/api/checkout" &&
          payload.method === "POST" &&
          payload.status === 500,
      ),
    },
  });
}
