import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";

const exec = promisify(execFile);
const { values } = parseArgs({
  options: { repo: { type: "string" }, "before-ref": { type: "string" } },
});
if (!values.repo || !/^[a-f0-9]{40}$/.test(values["before-ref"] ?? ""))
  throw new Error(
    "Usage: --repo <trusted-local-checkout> --before-ref <full-commit>",
  );
const repo = path.resolve(values.repo);
const component =
  "apps/web/app/[locale]/(main)/marketplace/_components/MarketplaceSearch.tsx";
const adapter = path.dirname(fileURLToPath(import.meta.url));
const context = path.resolve("artifacts/tcg-builds", randomUUID());
await mkdir(path.join(context, "source"), { recursive: true });
await mkdir(path.join(context, "adapter"));
const git = async (...args) =>
  (await exec("git", args, { cwd: repo, maxBuffer: 10_000_000 })).stdout;
if ((await git("status", "--porcelain")).trim())
  throw new Error(
    "Use a clean committed TCG checkout; no automatic mutation is performed",
  );
const commit = (await git("rev-parse", "HEAD")).trim();
const roots = [
  "package.json",
  "package-lock.json",
  "apps/api",
  "apps/web",
  "packages/typescript-config",
  "packages/ui",
  "packages/scan-contract",
  "packages/pokemon-dataset",
];
const files = (
  await git("ls-tree", "-r", "-z", "--name-only", commit, ...roots)
)
  .split("\0")
  .filter(Boolean)
  .filter(
    (filename) =>
      !filename
        .split("/")
        .some(
          (part) =>
            part.startsWith(".env") ||
            ["node_modules", ".next", "dist"].includes(part),
        ) && !filename.endsWith(".log"),
  );
if (
  !files.length ||
  files.some(
    (filename) =>
      filename.startsWith("/") || filename.split("/").includes(".."),
  )
)
  throw new Error("Invalid source snapshot");
await exec(
  "git",
  [
    "--literal-pathspecs",
    "archive",
    "--format=tar",
    `--output=${path.join(context, "source.tar")}`,
    commit,
    ...files,
  ],
  { cwd: repo },
);
await exec("tar", [
  "-xf",
  path.join(context, "source.tar"),
  "-C",
  path.join(context, "source"),
  "--exclude=.env*",
  "--exclude=*.log",
]);
const baseline = await git("show", `${values["before-ref"]}:${component}`);
const fixed = await readFile(path.join(context, "source", component), "utf8");
if (baseline === fixed)
  throw new Error("Baseline and current component are identical");
await writeFile(
  path.join(context, "adapter/MarketplaceSearch.buggy.tsx"),
  baseline,
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const provenance = {
  schemaVersion: 1,
  checkoutCommit: commit,
  baselineComponentCommit: values["before-ref"],
  component,
  baselineComponentSha256: hash(baseline),
  fixedComponentSha256: hash(fixed),
  archiveSha256: hash(await readFile(path.join(context, "source.tar"))),
  adapterSha256: hash(await readFile(path.join(adapter, "stack.cjs"))),
};
await writeFile(
  path.join(context, "adapter/provenance.json"),
  JSON.stringify(provenance, null, 2),
);
await copyFile(
  path.join(adapter, "stack.cjs"),
  path.join(context, "adapter/stack.cjs"),
);
await copyFile(
  path.join(adapter, "Dockerfile"),
  path.join(context, "Dockerfile"),
);
// Only the filtered snapshot and explicit adapter enter Docker, never the checkout or its .env files.
await writeFile(
  path.join(context, ".dockerignore"),
  "*\n!source/\n!source/**\n!adapter/\n!adapter/**\n**/.env*\n**/node_modules\n**/.next\n**/dist\n",
);
console.log(`Build context: ${context}`);
const { spawn } = await import("node:child_process");
const child = spawn("docker", ["build", "--tag=reproflow-tcg:local", context], {
  stdio: "inherit",
});
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("close", (code) => {
  process.exitCode = code ?? 1;
});
