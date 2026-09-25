import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export async function startDemoShop(
  options: { port?: number; fixed?: boolean } = {},
) {
  const assets = new Map<string, { content: Buffer; type: string }>();
  for (const [name, type] of [
    ["index.html", "text/html"],
    ["app.js", "text/javascript"],
    ["styles.css", "text/css"],
  ]) {
    if (!name || !type) continue;
    assets.set(`/${name}`, {
      content: await readFile(new URL(`../public/${name}`, import.meta.url)),
      type,
    });
  }
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/api/checkout" && req.method === "POST") {
      let body = "";
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 1024) {
            res.writeHead(413).end();
            return;
          }
        }
        const input: unknown = JSON.parse(body);
        if (
          typeof input !== "object" ||
          input === null ||
          !("addressEdited" in input) ||
          typeof input.addressEdited !== "boolean"
        ) {
          res.writeHead(400).end();
          return;
        }
        const broken = input.addressEdited && !options.fixed;
        res.writeHead(broken ? 500 : 200, {
          "Content-Type": "application/json",
        });
        res.end(
          JSON.stringify(
            broken
              ? { error: "ADDRESS_POSTAL_CODE_MISSING" }
              : { nextPath: "/checkout" },
          ),
        );
      } catch {
        if (!res.headersSent) res.writeHead(400);
        res.end();
      }
      return;
    }
    if (req.method !== "GET") {
      res.writeHead(405).end();
      return;
    }
    const asset = assets.get(
      ["/", "/cart", "/checkout"].includes(path) ? "/index.html" : path,
    );
    if (!asset) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": `${asset.type}; charset=utf-8` });
    res.end(asset.content);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
