import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import {
  applicationBundle,
  applicationScenario,
  elementBundle,
  elementScenario,
} from "../../../tests/element-fixtures.js";
import { captureElement } from "../src/element.js";

async function fixture(
  bundle: string,
  run: (url: string) => Promise<void>,
  apiStatus = 200,
) {
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/api/")) {
      response
        .writeHead(apiStatus, { "Content-Type": "application/json" })
        .end('{"synthetic":true}');
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end(`<div id="root"></div><script>${bundle}</script>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture unavailable");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("scripted numeric capture", () => {
  it("captures only after API and navigation readiness on the application route", async () => {
    await fixture(applicationBundle, async (url) => {
      const result = await captureElement(applicationScenario(), url);
      expect(result.observedValue).toBe("");
      expect(result.application?.entryPath).toBe("/catalog");
    });
  });
  it("rejects a broken application API instead of recording a misleading mismatch", async () => {
    await fixture(
      applicationBundle,
      async (url) => {
        await expect(
          captureElement(applicationScenario(), url),
        ).rejects.toThrow("Fixture API not ready");
      },
      500,
    );
  });
  it.each([
    "https://example.test/",
    "http://127.0.0.1/private",
    "http://127.0.0.1/?token=synthetic",
    "http://127.0.0.1/#private",
  ])("rejects a nonfixture URL %s before opening a browser", async (url) => {
    await expect(captureElement(elementScenario(), url)).rejects.toThrow(
      "local synthetic fixture",
    );
  });
  it("observes the rendered value, not the attempted input", async () => {
    await fixture(elementBundle(), async (url) => {
      const capture = await captureElement(elementScenario(), url);
      expect(capture.steps[0]?.action).toMatchObject({ value: "0" });
      expect(capture.observedValue).toBe("");
    });
    await fixture(elementBundle(true), async (url) => {
      expect((await captureElement(elementScenario(), url)).observedValue).toBe(
        "0",
      );
    });
  });
  it("rejects nonallowlisted observations before returning capture data", async () => {
    await fixture(
      `${elementBundle()}\ndocument.querySelector('input').addEventListener('input', e => e.target.value = '987654');`,
      async (url) => {
        await expect(captureElement(elementScenario(), url)).rejects.toThrow(
          "masked",
        );
      },
    );
  });
  it("rejects private input types", async () => {
    await fixture(
      "document.getElementById('root').innerHTML = '<input type=password placeholder=Price>';",
      async (url) => {
        await expect(captureElement(elementScenario(), url)).rejects.toThrow(
          "Unsupported input",
        );
      },
    );
  });
});
