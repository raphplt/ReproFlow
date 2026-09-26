import { describe, expect, it } from "vitest";
import {
  MAX_COMPONENT_BYTES,
  startComponentFixture,
} from "./component-fixture.js";

describe("component fixture boundary", () => {
  it("serves exactly two routes and rejects foreign hosts and origins", async () => {
    const fixture = await startComponentFixture("synthetic bundle");
    try {
      expect((await fetch(fixture.url)).status).toBe(200);
      expect(await (await fetch(`${fixture.url}/fixture.js`)).text()).toBe(
        "synthetic bundle",
      );
      expect((await fetch(`${fixture.url}/.env`)).status).toBe(404);
      expect((await fetch(fixture.url, { method: "POST" })).status).toBe(404);
      expect(
        (
          await fetch(fixture.url, {
            headers: { Origin: "https://foreign.test" },
          })
        ).status,
      ).toBe(403);
      const foreignHostStatus = await new Promise<number | undefined>(
        (resolve, reject) => {
          get(
            fixture.url,
            { headers: { Host: "foreign.test" } },
            (response) => {
              response.resume();
              resolve(response.statusCode);
            },
          ).once("error", reject);
        },
      );
      expect(foreignHostStatus).toBe(403);
      expect(
        (await fetch(fixture.url)).headers.get("content-security-policy"),
      ).toContain("connect-src 'none'");
    } finally {
      await fixture.close();
    }
  });
  it("bounds decoded fixture size", async () => {
    await expect(
      startComponentFixture("a".repeat(MAX_COMPONENT_BYTES + 1)),
    ).rejects.toThrow("size limit");
  });
});

import { get } from "node:http";
