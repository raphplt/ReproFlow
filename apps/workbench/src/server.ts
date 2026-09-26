import { readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { type Report, ReportSchema } from "@reproflow/event-schema";
import { reconstruct } from "@reproflow/reconstruction";
import { captureDemo } from "./capture.js";
import { reproduce } from "./pipeline.js";
import { renderIndex, renderReport } from "./views.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export async function startWorkbench(root: string, port = 0) {
  const reports = new Map<string, Report>();
  for (const id of await readdir(root).catch(() => [] as string[])) {
    if (!uuid.test(id)) continue;
    try {
      const report = ReportSchema.parse(
        JSON.parse(await readFile(join(root, id, "report.json"), "utf8")),
      );
      if (report.id !== id) continue;
      if (report.state === "running") {
        report.state = "failed";
        await writeFile(
          join(root, id, "report.json"),
          JSON.stringify(report, null, 2),
          { mode: 0o600 },
        );
      }
      reports.set(id, report);
      if (report.state === "failed")
        await writeFile(
          join(root, id, "report.html"),
          renderReport(report, false),
          { mode: 0o600 },
        );
    } catch {
      /* Ignore corrupt or unrelated files; never render their contents. */
    }
  }
  let active: Promise<void> | null = null;
  let controller = new AbortController();
  let message = "";
  let origin = "";
  const processTrace = async (trace: unknown) => {
    await reproduce(
      trace,
      root,
      3,
      (report) => {
        reports.set(report.id, structuredClone(report));
      },
      controller.signal,
    );
  };
  const begin = (job: () => Promise<void>) => {
    message = "";
    controller = new AbortController();
    active = job()
      .catch(() => {
        message = controller.signal.aborted
          ? "Opération annulée."
          : "La capture ou la reconstruction a échoué. Vérifier l’oracle confirmé, les données synthétiques et Chromium.";
      })
      .finally(() => {
        if (controller.signal.aborted) message = "Opération annulée.";
        active = null;
      });
  };
  const server = createServer(async (request, response) => {
    const respond = (status: number, body: string, type = "text/html") => {
      response.writeHead(status, {
        "Content-Type": `${type}; charset=utf-8`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      });
      response.end(body);
    };
    try {
      if (request.headers.host !== new URL(origin).host) {
        respond(403, "Forbidden");
        return;
      }
      const path = new URL(request.url ?? "/", origin).pathname;
      if (request.method === "POST") {
        if (
          request.headers.origin !== origin ||
          request.headers["content-type"] !== "application/json"
        ) {
          respond(403, "Forbidden");
          return;
        }
        if (path === "/api/cancel") {
          controller.abort();
          respond(202, '{"accepted":true}', "application/json");
          return;
        }
        if (active) {
          respond(409, "Busy");
          return;
        }
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (Buffer.byteLength(body) > 500000) {
            respond(413, "Too large");
            return;
          }
        }
        const value: unknown = JSON.parse(body);
        // Recheck after consuming the body: overlapping requests must not start two jobs.
        if (active) {
          respond(409, "Busy");
          return;
        }
        if (path === "/api/capture") {
          if (
            !value ||
            typeof value !== "object" ||
            !("automated" in value) ||
            typeof value.automated !== "boolean"
          ) {
            respond(400, "Invalid request");
            return;
          }
          const automated = value.automated;
          begin(async () => {
            const trace = await captureDemo(automated, controller.signal);
            if (trace) await processTrace(trace);
            else message = "Capture annulée.";
          });
        } else if (path === "/api/import") {
          reconstruct(value);
          begin(() => processTrace(value));
        } else if (path.startsWith("/api/retry/")) {
          const id = path.slice("/api/retry/".length);
          if (!uuid.test(id) || !reports.has(id)) {
            respond(404, "Not found");
            return;
          }
          begin(async () =>
            processTrace(
              JSON.parse(
                await readFile(join(root, id, "recording.json"), "utf8"),
              ),
            ),
          );
        } else {
          respond(404, "Not found");
          return;
        }
        respond(202, '{"accepted":true}', "application/json");
        return;
      }
      if (request.method !== "GET") {
        respond(405, "Method not allowed");
        return;
      }
      if (path === "/") {
        respond(
          200,
          renderIndex(
            [...reports.values()].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            ),
            Boolean(active),
            message,
          ),
        );
        return;
      }
      const parts = path.split("/");
      const report = reports.get(parts[2] ?? "");
      if (parts[1] === "reproductions" && parts.length === 3 && report) {
        respond(200, renderReport(report));
        return;
      }
      if (parts[1] === "artifacts" && parts.length === 4 && report) {
        if (parts[3] === "recording.json") {
          respond(
            200,
            await readFile(join(root, report.id, "recording.json"), "utf8"),
            "application/json",
          );
          return;
        }
        if (parts[3] === "report.json") {
          respond(200, JSON.stringify(report, null, 2), "application/json");
          return;
        }
        if (parts[3] === "reproduction.spec.js") {
          respond(200, report.source, "text/plain");
          return;
        }
      }
      respond(404, "Not found");
    } catch {
      respond(400, "Invalid request");
    }
  });
  server.requestTimeout = 10000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url: origin,
    close: async () => {
      controller.abort();
      await active;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    },
  };
}
