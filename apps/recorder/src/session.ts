import { randomUUID } from "node:crypto";
import {
  type BrowserEnvironment,
  type CapturePayload,
  type RecordingTrace,
  RecordingTraceSchema,
  type TraceEvent,
} from "@reproflow/event-schema";

export class CaptureSession {
  private events: TraceEvent[] = [];
  private droppedEvents = 0;
  private brokenState: RecordingTrace["brokenState"] = null;
  private startedAtMs = Date.now();
  private lastTime = this.startedAtMs;
  private stopped = false;
  private recordingId = randomUUID();

  constructor(private environment: BrowserEnvironment) {}

  private now() {
    this.lastTime = Math.max(this.lastTime, Date.now());
    return this.lastTime;
  }

  append(payload: CapturePayload) {
    if (this.stopped) return;
    if (this.events.length >= 2000) {
      this.droppedEvents++;
      return;
    }
    this.events.push({
      sequence: this.events.length,
      timestampMs: this.now(),
      payload,
    });
  }

  markBroken(observedPath: CapturePayload["pagePath"]) {
    if (this.stopped) throw new Error("Capture is already stopped");
    this.brokenState = {
      afterSequence: this.events.length - 1,
      timestampMs: this.now(),
      expectedPath: "/checkout",
      observedPath,
      confirmedByUser: true,
    };
  }

  stop(): RecordingTrace {
    if (this.stopped) throw new Error("Capture is already stopped");
    this.stopped = true;
    return RecordingTraceSchema.parse({
      schemaVersion: 1,
      recordingId: this.recordingId,
      status:
        this.brokenState && !this.droppedEvents ? "captured" : "incomplete",
      policy: "demo-shop-v1",
      startedAtMs: this.startedAtMs,
      endedAtMs: this.now(),
      environment: this.environment,
      droppedEvents: this.droppedEvents,
      events: this.events,
      brokenState: this.brokenState,
    });
  }
}
