import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  type RunEvidence,
  RunEvidenceSchema,
  type RunResult,
  ScenarioSchema,
} from "@reproflow/event-schema";
import { generate } from "@reproflow/playwright-generator";
import { classify } from "./classify.js";

export { classify, summarize } from "./classify.js";

export const RUNNER_IMAGE = "reproflow-runner:local";
export const infrastructureEvidence = (): RunEvidence => ({
  outcome: "infrastructure-failed",
  observedPath: "[REDACTED]",
  postalCodeError: false,
  checkoutStatuses: [],
  completedSteps: 0,
  durationMs: 0,
  browserVersion: null,
});

export function containerArgs(name: string) {
  return [
    "run",
    "--rm",
    "--init",
    "--name",
    name,
    "--pull=never",
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--user=pwuser",
    "--pids-limit=256",
    "--memory=1g",
    "--cpus=2",
    "--shm-size=256m",
    "--tmpfs=/tmp:rw,nosuid,size=256m",
    "--tmpfs=/work:rw,nosuid,size=64m,mode=1777",
    "-i",
    RUNNER_IMAGE,
  ];
}

export async function runIsolated(
  raw: unknown,
  source: string,
  variant: "buggy" | "fixed",
  index = 1,
  signal?: AbortSignal,
): Promise<RunResult> {
  const scenario = ScenarioSchema.parse(raw);
  const generated = generate(scenario);
  if (source !== generated.source)
    throw new Error("Only the canonical generated test can run in this POC");
  if (
    !Number.isInteger(index) ||
    index < 1 ||
    index > 5 ||
    !["buggy", "fixed"].includes(variant)
  )
    throw new Error("Invalid run options");
  const name = `reproflow-${randomUUID()}`;
  const started = Date.now();
  const evidence = await new Promise<RunEvidence>((resolve) => {
    if (signal?.aborted) {
      resolve(infrastructureEvidence());
      return;
    }
    const child = spawn("docker", containerArgs(name), {
      stdio: ["pipe", "pipe", "ignore"],
    });
    let output = "";
    let settled = false;
    let stopping = false;
    const finish = (value: RunEvidence) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      resolve(value);
    };
    const stop = () => {
      if (stopping || settled) return;
      stopping = true;
      const cleanup = spawn("docker", ["rm", "-f", name], {
        stdio: "ignore",
        timeout: 5000,
      });
      cleanup.once("error", () => finish(infrastructureEvidence()));
      cleanup.once("close", () => finish(infrastructureEvidence()));
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => {
      stop();
    }, 45000);
    signal?.addEventListener("abort", stop, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 32000) {
        stop();
      }
    });
    child.stdin.on("error", () => {});
    child.once("error", () => finish(infrastructureEvidence()));
    child.once("close", (code) => {
      if (stopping) return;
      try {
        if (code !== 0) throw new Error("runner_failed");
        finish(RunEvidenceSchema.parse(JSON.parse(output)));
      } catch {
        stop();
      }
    });
    child.stdin.end(JSON.stringify({ scenario, source, variant }));
  });
  if (evidence.outcome === "infrastructure-failed" && evidence.durationMs === 0)
    evidence.durationMs = Date.now() - started;
  return {
    index,
    variant,
    status: classify(evidence, scenario),
    evidence,
    testSha256: generated.sha256,
  };
}
