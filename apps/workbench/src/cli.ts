import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureDemo } from "./capture.js";
import { reproduce } from "./pipeline.js";
import { startWorkbench } from "./server.js";

async function main() {
  const [command = "serve", file] = process.argv.slice(2);
  const root = resolve("artifacts/reproductions");
  if (command === "serve") {
    const server = await startWorkbench(root);
    console.info(`ReproFlow : ${server.url}`);
    const stop = () => {
      void server.close().then(() => process.exit());
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    return;
  }
  if (
    !["poc", "record", "import"].includes(command) ||
    (command === "import" && !file)
  )
    throw new Error("invalid_command");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  const trace: unknown =
    command === "import" && file
      ? JSON.parse(await readFile(resolve(file), "utf8"))
      : await captureDemo(command === "poc", controller.signal);
  if (!trace) {
    console.info("Capture annulée.");
    return;
  }
  const report = await reproduce(
    trace,
    root,
    3,
    (current) => {
      const run = current.runs.at(-1);
      if (current.state === "running" && run)
        console.info(`${run.variant} #${run.index} : ${run.status}`);
    },
    controller.signal,
  );
  console.info(`Rapport : ${resolve(root, report.id, "report.html")}`);
  console.info(`Test SHA-256 : ${report.testSha256}`);
  const success =
    report.state === "complete" &&
    report.runs.every(
      (run) =>
        run.status ===
        (run.variant === "buggy" ? "reproduced" : "not_reproduced"),
    );
  if (!success) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Opération interrompue. Vérifier la trace, Chromium (pnpm browser:install), Docker et l’image (pnpm runner:build).",
  );
  process.exitCode = 1;
});
