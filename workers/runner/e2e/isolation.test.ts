import { execFile } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { generate } from "@reproflow/playwright-generator";
import { describe, expect, it } from "vitest";
import { scenarioFixture } from "../../../tests/fixtures.js";
import { containerArgs, runIsolated } from "../src/index.js";

describe("real isolated runner", () => {
  it("removes the active container when cancelled", async () => {
    const list = async () =>
      (
        await promisify(execFile)("docker", [
          "ps",
          "-q",
          "--filter",
          "name=reproflow-",
        ])
      ).stdout
        .trim()
        .split("\n")
        .filter(Boolean);
    const before = new Set(await list());
    const scenario = scenarioFixture();
    const controller = new AbortController();
    const pending = runIsolated(
      scenario,
      generate(scenario).source,
      "buggy",
      1,
      controller.signal,
    );
    let started = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if ((await list()).some((id) => !before.has(id))) {
        started = true;
        break;
      }
      await setTimeout(100);
    }
    controller.abort();
    const result = await pending;
    expect(started).toBe(true);
    expect(result.status).toBe("infrastructure_failure");
    expect((await list()).filter((id) => !before.has(id))).toEqual([]);
  });
  it("denies filesystem writes and outbound network in a non-root container", async () => {
    const args = containerArgs(`reproflow-isolation-${Date.now()}`);
    args.splice(args.length - 1, 0, "--entrypoint=node");
    args.push(
      "-e",
      `const fs=require('node:fs'),net=require('node:net'); let writable=false;try{fs.writeFileSync('/opt/reproflow/package.json','changed');writable=true}catch{}; const socket=net.connect(443,'1.1.1.1');let network=false;socket.on('connect',()=>{network=true;socket.destroy()});socket.on('error',()=>{});setTimeout(()=>{socket.destroy();console.log(JSON.stringify({writable,network,uid:process.getuid(),host:fs.existsSync('/Users/raph')}))},500);`,
    );
    const { stdout } = await promisify(execFile)("docker", args, {
      timeout: 15000,
    });
    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      writable: false,
      network: false,
      host: false,
    });
    expect(result.uid).not.toBe(0);
  });
  it("classifies an unavailable target element as generation failure", async () => {
    const scenario = scenarioFixture();
    scenario.steps.splice(1, 2);
    const result = await runIsolated(
      scenario,
      generate(scenario).source,
      "buggy",
    );
    expect(result.status).toBe("generation_failure");
    expect(result.evidence.completedSteps).toBe(1);
  });
  it("does not classify an unrelated assertion failure as reproduction", async () => {
    const scenario = scenarioFixture();
    scenario.steps.splice(1);
    const result = await runIsolated(
      scenario,
      generate(scenario).source,
      "buggy",
    );
    expect(result.status).toBe("inconclusive");
    expect(result.evidence.outcome).toBe("oracle-failed");
  });
});
