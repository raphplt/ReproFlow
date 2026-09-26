const { spawn, execFile } = require("node:child_process");
const { mkdir } = require("node:fs/promises");
const { openSync, closeSync } = require("node:fs");
const http = require("node:http");
const { promisify } = require("node:util");
const { Client } = require("pg");
const exec = promisify(execFile);

/** Starts real TCG services against a fresh, synthetic in-container database. */
exports.start = async function start(variant) {
  if (!["buggy", "fixed"].includes(variant)) throw new Error("invalid_variant");
  const children = [];
  const clients = new Set();
  const launch = (file, args, options = {}) => {
    const log = openSync(`/work/service-${children.length}.log`, "w", 0o600);
    const child = spawn(file, args, {
      stdio: ["ignore", log, log],
      ...options,
    });
    closeSync(log);
    child.on("error", () => {});
    children.push(child);
    return child;
  };
  let gateway;
  const close = async () => {
    for (const client of clients) await client.end().catch(() => {});
    clients.clear();
    if (gateway) {
      gateway.closeAllConnections();
      await new Promise((resolve) => gateway.close(resolve));
    }
    for (const child of children.reverse()) child.kill("SIGTERM");
    await exec("/usr/lib/postgresql/16/bin/pg_ctl", [
      "-D",
      "/work/postgres",
      "-m",
      "immediate",
      "-w",
      "stop",
    ]).catch(() => {});
  };
  try {
    await mkdir("/work/postgres", { recursive: true });
    await exec("/usr/lib/postgresql/16/bin/initdb", [
      "-D",
      "/work/postgres",
      "-U",
      "reproflow",
      "-A",
      "trust",
      "--no-locale",
      "--encoding=UTF8",
    ]);
    await exec("/usr/lib/postgresql/16/bin/pg_ctl", [
      "-D",
      "/work/postgres",
      "-l",
      "/work/postgres.log",
      "-o",
      "-h 127.0.0.1 -k /work -c fsync=off",
      "-w",
      "start",
    ]);
    const admin = new Client({
      host: "127.0.0.1",
      user: "reproflow",
      database: "postgres",
    });
    clients.add(admin);
    admin.on("error", () => {});
    await admin.connect();
    await admin.query("CREATE DATABASE reproflow");
    await admin.end();
    clients.delete(admin);
    const database = new Client({
      host: "127.0.0.1",
      user: "reproflow",
      database: "reproflow",
    });
    clients.add(database);
    database.on("error", () => {});
    await database.connect();
    await database.query(
      'CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    );
    await database.query(
      "CREATE OR REPLACE FUNCTION public.immutable_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$ SELECT public.unaccent('public.unaccent', $1) $$;",
    );
    const api = launch(process.execPath, ["dist/main.js"], {
      cwd: "/opt/tcg/apps/api",
      env: {
        ...process.env,
        PORT: "3001",
        NODE_ENV: "test",
        JWT_SECRET: "synthetic-reproflow-local-only",
        JWT_REFRESH_SECRET: "synthetic-reproflow-refresh-only",
      },
    });
    await ready("http://127.0.0.1:3001/api/health/live", api);
    await database.query(`INSERT INTO card (id, game, "localId", "tcgDexId") VALUES ('00000000-0000-4000-8000-000000000001','POKEMON','001','synthetic-001');
      INSERT INTO card_translation (card_id, locale, name) VALUES ('00000000-0000-4000-8000-000000000001','fr','ReproFlow Synthetic Card'), ('00000000-0000-4000-8000-000000000001','en','ReproFlow Synthetic Card');`);
    await database.end();
    clients.delete(database);
    const web = launch(process.execPath, ["server.js"], {
      cwd: `/opt/tcg-${variant}/apps/web`,
      env: {
        ...process.env,
        PORT: "3002",
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
      },
    });
    await ready("http://127.0.0.1:3002/fr/marketplace/cards", web);
    gateway = http.createServer((request, response) => {
      if (
        request.headers.host !== "127.0.0.1:3000" ||
        (request.headers.origin &&
          request.headers.origin !== "http://127.0.0.1:3000")
      ) {
        response.writeHead(403).end();
        return;
      }
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: request.url.startsWith("/api/") ? 3001 : 3002,
          path: request.url,
          method: request.method,
          headers: { ...request.headers, host: "127.0.0.1:3000" },
        },
        (incoming) => {
          response.writeHead(incoming.statusCode, incoming.headers);
          incoming.pipe(response);
        },
      );
      upstream.on("error", () => {
        response.writeHead(502).end();
      });
      request.pipe(upstream);
    });
    await new Promise((resolve, reject) => {
      gateway.once("error", reject);
      gateway.listen(3000, "127.0.0.1", resolve);
    });
    return { url: "http://127.0.0.1:3000", close };
  } catch (error) {
    await close();
    throw error;
  }
};

async function ready(url, child) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("service_exited");
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("service_not_ready");
}
