import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const shared = await read("AGENTS.md");
assert(shared.includes("RTK.md"), "AGENTS.md must reference RTK.md");
await read("RTK.md");

const claude = await read("CLAUDE.md");
assert(/^@AGENTS\.md$/m.test(claude), "CLAUDE.md must import AGENTS.md");
assert(/^@RTK\.md$/m.test(claude), "CLAUDE.md must import RTK.md");

for (const name of ["reproflow-verify", "reproflow-review"]) {
  const source = new URL(`.agents/skills/${name}/SKILL.md`, root);
  const alias = new URL(`.claude/skills/${name}/SKILL.md`, root);
  assert.equal(
    await realpath(alias),
    await realpath(source),
    `Claude skill ${name} must link to its shared source`,
  );
  const content = await readFile(source, "utf8");
  assert(
    content.startsWith(`---\nname: ${name}\n`),
    `Invalid skill name: ${name}`,
  );
  assert(
    /^description: .+$/m.test(content),
    `Missing skill description: ${name}`,
  );
}

for (const path of [
  "README.md",
  "docs/architecture.md",
  "docs/roadmap.md",
  "docs/product-brief.md",
  "docs/agent-workflow.md",
]) {
  assert((await read(path)).trim().length > 0, `Missing context: ${path}`);
}

console.info("Agent instructions, shared skills and context files: OK");
