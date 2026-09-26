import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReportSchema } from "@reproflow/event-schema";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { captureDemo } from "../src/capture.js";
import { reproduce } from "../src/pipeline.js";
import { startWorkbench } from "../src/server.js";

describe("reference acceptance", () => {
  it("records in Chromium, generates once, fails on the bug and passes the exact same test after the fix", async () => {
    const root = await mkdtemp(join(tmpdir(), "reproflow-pipeline-"));
    try {
      const trace = await captureDemo(true);
      expect(trace?.status).toBe("captured");
      if (trace) trace.environment.userAgent = "SYNTHETIC_SECRET_USER_AGENT";
      const report = await reproduce(trace, root, 3);
      expect(report.state).toBe("complete");
      expect(report.runs.map((run) => run.status)).toEqual([
        "reproduced",
        "reproduced",
        "reproduced",
        "not_reproduced",
        "not_reproduced",
        "not_reproduced",
      ]);
      const source = await readFile(
        join(root, report.id, "reproduction.spec.js"),
        "utf8",
      );
      expect(createHash("sha256").update(source).digest("hex")).toBe(
        report.testSha256,
      );
      expect(new Set(report.runs.map((run) => run.testSha256)).size).toBe(1);
      const saved = ReportSchema.parse(
        JSON.parse(
          await readFile(join(root, report.id, "report.json"), "utf8"),
        ),
      );
      expect(saved).toEqual(report);
      const recording = await readFile(
        join(root, report.id, "recording.json"),
        "utf8",
      );
      expect(recording).not.toContain("SYNTHETIC_SECRET_USER_AGENT");
      const server = await startWorkbench(root);
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        for (const viewport of [
          { width: 1440, height: 1000 },
          { width: 390, height: 844 },
        ]) {
          await page.setViewportSize(viewport);
          await page.goto(server.url);
          await page.getByRole("link", { name: /Checkout ·/ }).click();
          await page.getByText("Validé", { exact: true }).waitFor();
          expect(await page.locator("tbody tr").count()).toBe(6);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.getByText("Voir le test généré", { exact: true }).click();
          expect(await page.locator("pre").textContent()).toContain(
            'new URL("/checkout", baseURL)',
          );
          if (process.env.REPROFLOW_SCREENSHOT_DIR)
            await page.screenshot({
              path: join(
                process.env.REPROFLOW_SCREENSHOT_DIR,
                `report-${viewport.width}.png`,
              ),
              fullPage: true,
            });
        }
        const downloaded = await fetch(
          `${server.url}/artifacts/${report.id}/reproduction.spec.js`,
        );
        expect(await downloaded.text()).toBe(source);
        await page
          .getByRole("button", { name: "Relancer", exact: true })
          .click();
        await page.waitForURL(`${server.url}/`);
        await page
          .getByRole("button", { name: "Annuler", exact: true })
          .click();
        await page.getByText("Opération annulée.", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Importer une trace" }).click();
        await page.locator("#trace").setInputFiles({
          name: "invalid.json",
          mimeType: "application/json",
          buffer: Buffer.from("not-json"),
        });
        await page.getByRole("button", { name: "Générer et vérifier" }).click();
        await page
          .getByText("Trace JSON invalide ou trop volumineuse.")
          .waitFor();
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
        await server.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
