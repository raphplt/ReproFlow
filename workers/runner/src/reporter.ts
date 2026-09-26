import { writeFileSync } from "node:fs";
import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from "@playwright/test/reporter";
import {
  ElementEvidenceSchema,
  type RunEvidence,
  RunEvidenceSchema,
} from "@reproflow/event-schema";

export default class EvidenceReporter implements Reporter {
  private completedSteps = 0;
  private oracleFailed = false;
  private oraclePassed = false;

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep) {
    if (step.category !== "test.step") return;
    if (step.title.startsWith("replay:") && !step.error) this.completedSteps++;
    if (step.title === "confirmed-oracle") {
      this.oracleFailed = Boolean(step.error);
      this.oraclePassed = !step.error;
    }
  }

  onTestEnd(_test: TestCase, result: TestResult) {
    const attachment = result.attachments.find((item) =>
      ["reproflow-evidence", "reproflow-element-evidence"].includes(item.name),
    );
    const unavailable = result.errors.some((error) =>
      /net::ERR_|browser.*closed|Target.*closed|browser.*crashed/i.test(
        error.message ?? "",
      ),
    );
    const outcome: RunEvidence["outcome"] =
      unavailable || result.status === "timedOut"
        ? "infrastructure-failed"
        : result.status === "passed" && this.oraclePassed
          ? "passed"
          : this.oracleFailed
            ? "oracle-failed"
            : "replay-failed";
    try {
      const data: unknown = JSON.parse(attachment?.body?.toString() ?? "null");
      if (!data || typeof data !== "object") return;
      const schema =
        attachment?.name === "reproflow-element-evidence"
          ? ElementEvidenceSchema
          : RunEvidenceSchema;
      const parsed = schema.safeParse({
        ...data,
        completedSteps: this.completedSteps,
        durationMs: result.duration,
        outcome,
      });
      if (parsed.success)
        writeFileSync("/work/evidence.json", JSON.stringify(parsed.data));
    } catch {
      // No raw Playwright error or page content crosses the container boundary.
    }
  }
}
