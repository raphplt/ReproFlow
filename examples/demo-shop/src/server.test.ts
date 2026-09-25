import { describe, expect, it } from "vitest";
import { startDemoShop } from "./server.js";

describe("demo shop checkout", () => {
  it.each([false, true])(
    "has deterministic buggy/fixed mode (fixed=%s)",
    async (fixed) => {
      const shop = await startDemoShop({ fixed });
      try {
        const checkout = (addressEdited: boolean) =>
          fetch(`${shop.url}/api/checkout`, {
            method: "POST",
            body: JSON.stringify({ addressEdited }),
          });
        expect((await checkout(false)).status).toBe(200);
        expect((await checkout(true)).status).toBe(fixed ? 200 : 500);
        expect((await fetch(`${shop.url}/cart`)).status).toBe(200);
        expect((await fetch(`${shop.url}/missing`)).status).toBe(404);
        expect(
          (
            await fetch(`${shop.url}/api/checkout`, {
              method: "POST",
              body: "invalid",
            })
          ).status,
        ).toBe(400);
      } finally {
        await shop.close();
      }
    },
  );
});
