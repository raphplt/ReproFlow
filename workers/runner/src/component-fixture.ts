import { createServer } from "node:http";

export const MAX_COMPONENT_BYTES = 4_000_000;

/** Serves only a synthetic, self-contained browser bundle; never reads host files. */
export async function startComponentFixture(bundle: string) {
  if (Buffer.byteLength(bundle) > MAX_COMPONENT_BYTES)
    throw new Error("Fixture exceeds size limit");
  const server = createServer((request, response) => {
    const address = server.address();
    const host =
      address && typeof address !== "string"
        ? `127.0.0.1:${address.port}`
        : null;
    if (
      !host ||
      request.headers.host !== host ||
      (request.headers.origin && request.headers.origin !== `http://${host}`)
    ) {
      response.writeHead(403).end();
      return;
    }
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    if (
      request.method !== "GET" ||
      !["/", "/fixture.js"].includes(request.url ?? "")
    ) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader(
      "Content-Type",
      request.url === "/"
        ? "text/html; charset=utf-8"
        : "text/javascript; charset=utf-8",
    );
    response.end(
      request.url === "/"
        ? '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Component fixture</title></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'
        : bundle,
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture unavailable");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
