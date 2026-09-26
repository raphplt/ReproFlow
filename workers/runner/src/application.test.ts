import { generateElement } from "@reproflow/playwright-generator";
import { describe, expect, it } from "vitest";
import {
  applicationScenario,
  elementEvidence,
} from "../../../tests/element-fixtures.js";
import {
  captureApplicationIsolated,
  runApplicationIsolated,
} from "./application.js";
import { classifyElement } from "./element-classify.js";
import { containerArgs } from "./isolation.js";

const imageId = `sha256:${"a".repeat(64)}`;
describe("application runner boundary", () => {
  it("does not relax network, mounts or privileges for a complete application", () => {
    const args = containerArgs("synthetic", { kind: "tcg-stack", imageId });
    for (const required of [
      "--network=none",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--user=pwuser",
      "--memory=2g",
      "--pids-limit=512",
    ])
      expect(args).toContain(required);
    expect(args.at(-1)).toBe(imageId);
    expect(
      args.some(
        (arg) => arg.startsWith("--volume") || arg.startsWith("--publish"),
      ),
    ).toBe(false);
    expect(() =>
      containerArgs("synthetic", {
        kind: "tcg-stack",
        imageId: "untrusted:latest",
      }),
    ).toThrow("profile");
  });
  it("requires application readiness even when the mismatch matches", () => {
    expect(classifyElement(elementEvidence(), applicationScenario())).toBe(
      "infrastructure_failure",
    );
    expect(
      classifyElement(
        { ...elementEvidence(), applicationReady: true },
        applicationScenario(),
      ),
    ).toBe("reproduced");
  });
  it("rejects noncanonical code before starting a container", async () => {
    await expect(
      runApplicationIsolated(
        applicationScenario(),
        "arbitrary",
        "buggy",
        1,
        imageId,
      ),
    ).rejects.toThrow("Invalid application run");
  });
  it("cancels both capture and replay before starting a container", async () => {
    const scenario = applicationScenario();
    await expect(
      captureApplicationIsolated(scenario, imageId, AbortSignal.abort()),
    ).rejects.toThrow("capture failed");
    const result = await runApplicationIsolated(
      scenario,
      generateElement(scenario).source,
      "buggy",
      1,
      imageId,
      AbortSignal.abort(),
    );
    expect(result.status).toBe("infrastructure_failure");
  });
});
