import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

export const RUNNER_IMAGE = "reproflow-runner:local";

export type RunnerProfile = { kind: "tcg-stack"; imageId: string };

export function containerArgs(name: string, profile?: RunnerProfile) {
  if (
    profile &&
    (profile.kind !== "tcg-stack" ||
      !/^sha256:[a-f0-9]{64}$/.test(profile.imageId))
  )
    throw new Error("Invalid runner profile");
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
    profile ? "--pids-limit=512" : "--pids-limit=256",
    profile ? "--memory=2g" : "--memory=1g",
    "--cpus=2",
    "--shm-size=256m",
    "--tmpfs=/tmp:rw,nosuid,size=256m",
    profile
      ? "--tmpfs=/work:rw,nosuid,size=512m,mode=1777"
      : "--tmpfs=/work:rw,nosuid,size=64m,mode=1777",
    "-i",
    profile?.imageId ?? RUNNER_IMAGE,
  ];
}

/** Shared process boundary for canonical tests, regardless of oracle type. */
export function executeIsolated<T>(
  request: unknown,
  parse: (raw: unknown) => T,
  unavailable: () => T,
  signal?: AbortSignal,
  profile?: RunnerProfile,
): Promise<T> {
  if (profile) containerArgs("validation", profile);
  return new Promise<T>((resolve) => {
    if (signal?.aborted) {
      resolve(unavailable());
      return;
    }
    const name = `reproflow-${randomUUID()}`;
    const child = spawn("docker", containerArgs(name, profile), {
      stdio: ["pipe", "pipe", "ignore"],
    });
    let output = "";
    let settled = false;
    let stopping = false;
    const finish = (value: T) => {
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
      cleanup.once("error", () => finish(unavailable()));
      cleanup.once("close", () => finish(unavailable()));
      child.kill("SIGKILL");
    };
    const timer = setTimeout(stop, profile ? 120000 : 45000);
    signal?.addEventListener("abort", stop, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 32000) stop();
    });
    child.stdin.on("error", () => {});
    child.once("error", () => finish(unavailable()));
    child.once("close", (code) => {
      if (stopping) return;
      try {
        if (code !== 0) throw new Error("runner_failed");
        finish(parse(JSON.parse(output)));
      } catch {
        stop();
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
