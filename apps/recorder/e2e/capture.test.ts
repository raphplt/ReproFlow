import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDemoShop } from "@reproflow/demo-shop";
import { RecordingTraceSchema } from "@reproflow/event-schema";
import { describe, expect, it } from "vitest";
import { exportTrace } from "../src/export.js";
import { launchRecorder } from "../src/recorder.js";

describe("real Chromium capture", () => {
  it.each([false, true])(
    "records the same checkout actions (fixed=%s)",
    async (fixed) => {
      const shop = await startDemoShop({ fixed });
      const directory = await mkdtemp(join(tmpdir(), "reproflow-e2e-"));
      let recorder: Awaited<ReturnType<typeof launchRecorder>> | undefined;
      try {
        recorder = await launchRecorder({ baseUrl: shop.url, headless: true });
        const { page } = recorder;
        await page.getByTestId("start-recording").click();
        await page
          .getByText("Enregistrement en cours", { exact: true })
          .waitFor();
        await page.getByTestId("edit-address").click();
        await page.getByLabel("Code postal", { exact: true }).fill("69001");
        await page.getByTestId("save-address").click();
        const response = page.waitForResponse((item) =>
          item.url().endsWith("/api/checkout"),
        );
        await page.getByTestId("checkout").click();
        expect((await response).status()).toBe(fixed ? 200 : 500);
        if (fixed) {
          await page.waitForURL(`${shop.url}/checkout`);
          await page
            .getByText("Prêt à finaliser la commande.", { exact: true })
            .waitFor();
        } else {
          await page.getByRole("alert").waitFor({ state: "visible" });
          await page.getByTestId("confirm-expected").check();
          await page.getByTestId("mark-broken").click();
          await page
            .getByText("État cassé marqué · attendu confirmé")
            .waitFor();
        }
        await page.getByTestId("stop-recording").click();
        const trace = await recorder.finished;
        expect(trace).not.toBeNull();
        const path = await exportTrace(trace, directory);
        const parsed = RecordingTraceSchema.parse(
          JSON.parse(await readFile(path, "utf8")),
        );
        expect(parsed.status).toBe(fixed ? "incomplete" : "captured");
        expect(
          parsed.events.some(
            ({ payload }) =>
              payload.type === "input" && payload.value === "69001",
          ),
        ).toBe(true);
        expect(
          parsed.events.some(
            ({ payload }) =>
              payload.type === "submit" && payload.target === "address-form",
          ),
        ).toBe(true);
        expect(
          parsed.events.some(
            ({ payload }) =>
              payload.type === "network" &&
              payload.status === (fixed ? 200 : 500),
          ),
        ).toBe(true);
        if (!fixed) {
          expect(parsed.brokenState).toMatchObject({
            expectedPath: "/checkout",
            observedPath: "/cart",
            confirmedByUser: true,
          });
          expect(
            parsed.events.some(
              ({ payload }) =>
                payload.type === "console-error" &&
                payload.code === "ADDRESS_POSTAL_CODE_MISSING",
            ),
          ).toBe(true);
        }
        // Synthetic UI artifact only; never enable screenshots for arbitrary user captures.
        if (!fixed && process.env.REPROFLOW_SCREENSHOT)
          await page.screenshot({
            path: process.env.REPROFLOW_SCREENSHOT,
            fullPage: true,
          });
      } finally {
        await recorder?.close();
        await shop.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it("redacts password, free text, DOM metadata, URL and console secrets before export", async () => {
    const shop = await startDemoShop();
    let recorder: Awaited<ReturnType<typeof launchRecorder>> | undefined;
    try {
      recorder = await launchRecorder({ baseUrl: shop.url, headless: true });
      const { page } = recorder;
      await page.getByTestId("start-recording").click();
      await page
        .getByText("Enregistrement en cours", { exact: true })
        .waitFor();
      await page.evaluate(() => {
        const fields = [
          {
            type: "password",
            id: "postal-code",
            value: "69001",
            sensitive: false,
          },
          { type: "text", id: "postal-code", value: "75001", sensitive: true },
          {
            type: "text",
            id: "SECRET_METADATA",
            value: "SECRET_VALUE",
            sensitive: false,
          },
        ];
        for (const field of fields) {
          const input = document.createElement("input");
          input.type = field.type;
          input.setAttribute("data-testid", field.id);
          input.value = field.value;
          if (field.sensitive) input.setAttribute("data-sensitive", "");
          input.setAttribute("aria-label", "SECRET_LABEL");
          document.body.append(input);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        history.pushState({}, "", "/cart?token=SECRET_QUERY#SECRET_FRAGMENT");
        console.error("SECRET_CONSOLE");
      });
      await page.getByTestId("stop-recording").click();
      const trace = RecordingTraceSchema.parse(await recorder.finished);
      expect(
        trace.events.filter(({ payload }) => payload.type === "input"),
      ).toHaveLength(3);
      expect(
        trace.events
          .filter(({ payload }) => payload.type === "input")
          .every(
            ({ payload }) =>
              payload.type === "input" && payload.value === "[REDACTED]",
          ),
      ).toBe(true);
      expect(JSON.stringify(trace)).not.toContain("SECRET_");
      expect(
        trace.events.some(
          ({ payload }) =>
            payload.type === "console-error" && payload.code === "[REDACTED]",
        ),
      ).toBe(true);
      expect(trace.brokenState).toBeNull();
      expect(trace.status).toBe("incomplete");
    } finally {
      await recorder?.close();
      await shop.close();
    }
  });

  it("does not record before start and cancels cleanly if the browser closes", async () => {
    const shop = await startDemoShop();
    let recorder: Awaited<ReturnType<typeof launchRecorder>> | undefined;
    try {
      recorder = await launchRecorder({ baseUrl: shop.url, headless: true });
      await recorder.page.getByTestId("edit-address").click();
      await recorder.page
        .getByLabel("Code postal", { exact: true })
        .fill("69001");
      await recorder.page.getByTestId("start-recording").click();
      await recorder.page
        .getByText("Enregistrement en cours", { exact: true })
        .waitFor();
      expect(await recorder.page.getByTestId("postal-code").inputValue()).toBe(
        "75001",
      );
      await recorder.close();
      expect(await recorder.finished).toBeNull();
    } finally {
      await recorder?.close();
      await shop.close();
    }
  });
});
