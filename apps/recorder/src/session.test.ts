import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecordingTraceSchema } from "@reproflow/event-schema";
import { describe, expect, it } from "vitest";
import { exportTrace } from "./export.js";
import { safeInteraction, safePath } from "./privacy.js";
import { CaptureSession } from "./session.js";

const environment = {
  browser: "chromium" as const,
  viewport: { width: 1440, height: 1000 },
  userAgent: "Synthetic test",
};

describe("capture session", () => {
  it("exports a versioned ordered trace and never overwrites an existing recording", async () => {
    const session = new CaptureSession(environment);
    session.append({ type: "navigation", pagePath: "/cart" });
    session.append({
      type: "input",
      pagePath: "/cart",
      target: "postal-code",
      value: "69001",
    });
    session.markBroken("/cart");
    const trace = session.stop();
    const directory = await mkdtemp(join(tmpdir(), "reproflow-"));
    try {
      const path = await exportTrace(trace, directory);
      expect(
        RecordingTraceSchema.parse(JSON.parse(await readFile(path, "utf8"))),
      ).toEqual(trace);
      expect(trace.status).toBe("captured");
      expect(trace.events.map((event) => event.sequence)).toEqual([0, 1]);
      await expect(exportTrace(trace, directory)).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    expect(() => session.stop()).toThrow("already stopped");
    session.append({ type: "navigation", pagePath: "/checkout" });
    expect(trace.events).toHaveLength(2);
  });

  it("does not silently label an unmarked or truncated trace complete", () => {
    expect(new CaptureSession(environment).stop().status).toBe("incomplete");
    const session = new CaptureSession(environment);
    for (let i = 0; i < 2002; i++)
      session.append({ type: "click", target: "checkout", pagePath: "/cart" });
    session.markBroken("/cart");
    const trace = session.stop();
    expect(trace.events).toHaveLength(2000);
    expect(trace.droppedEvents).toBe(2);
    expect(trace.status).toBe("incomplete");
  });

  it("rejects corrupted ordering, unsupported versions and a fabricated complete capture", () => {
    const session = new CaptureSession(environment);
    session.append({ type: "navigation", pagePath: "/cart" });
    const trace = session.stop();
    for (const invalid of [
      { ...trace, schemaVersion: 2 },
      { ...trace, status: "captured" },
      { ...trace, endedAtMs: 0 },
      { ...trace, events: [{ ...trace.events[0], sequence: 7 }] },
      { ...trace, events: [{ ...trace.events[0], timestampMs: 0 }] },
    ])
      expect(RecordingTraceSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("privacy at the process boundary", () => {
  it("keeps only allowed route names and removes query, fragment and external origins", () => {
    expect(
      safePath(
        "http://127.0.0.1:3000/cart?token=SECRET#email=PRIVATE",
        "http://127.0.0.1:3000",
      ),
    ).toBe("/cart");
    for (const url of [
      "http://127.0.0.1:3000/customer/PRIVATE",
      "https://PRIVATE.example/cart",
      "not-a-url",
    ])
      expect(safePath(url, "http://127.0.0.1:3000")).toBe("[REDACTED]");
  });
  it("rejects injected fields and arbitrary input values", () => {
    const payload = {
      type: "input",
      pagePath: "/cart",
      target: "postal-code",
      value: "69001",
    };
    expect(safeInteraction({ ...payload, cookie: "SECRET" })).toBeNull();
    expect(safeInteraction({ ...payload, value: "SECRET" })).toBeNull();
    expect(safeInteraction({ ...payload, target: "unknown" })).toEqual({
      ...payload,
      target: "unknown",
      value: "[REDACTED]",
    });
    expect(
      safeInteraction({
        type: "console-error",
        pagePath: "/cart",
        code: "ADDRESS_POSTAL_CODE_MISSING",
      }),
    ).toBeNull();
  });
});
