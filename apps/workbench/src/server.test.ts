import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startWorkbench } from "./server.js";
import { escapeHtml } from "./views.js";

describe("local workbench", () => {
  it("escapes untrusted content", () => {
    expect(escapeHtml('<script>"&')).toBe("&lt;script&gt;&quot;&amp;");
  });
  it("rejects foreign origins, invalid traces and traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "reproflow-ui-"));
    const server = await startWorkbench(root);
    try {
      const home = await fetch(server.url);
      expect(home.status).toBe(200);
      expect(await home.text()).toContain("Aucune reproduction");
      expect(
        (
          await fetch(`${server.url}/api/capture`, {
            method: "POST",
            headers: {
              origin: "https://example.com",
              "content-type": "application/json",
            },
            body: '{"automated":true}',
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await fetch(`${server.url}/api/import`, {
            method: "POST",
            headers: { origin: server.url, "content-type": "application/json" },
            body: "{}",
          })
        ).status,
      ).toBe(400);
      expect(
        (await fetch(`${server.url}/artifacts/unknown/report.json`)).status,
      ).toBe(404);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
