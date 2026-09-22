import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, appendFile, readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLead, isValidLead, notifyLead } from "./lib/leads.mjs";
import {
  assessSpam,
  clientIp,
  isAllowedBrowser,
  publicLead,
  rateLimitOk
} from "./lib/spam.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const LEADS_KEY = process.env.LEADS_KEY || "faraday-dev";
const LEADS_FILE = join(ROOT, "data", "leads.jsonl");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

async function saveLead(data, ip) {
  await mkdir(join(ROOT, "data"), { recursive: true });
  const row = buildLead(publicLead(data), ip);
  await appendFile(LEADS_FILE, `${JSON.stringify(row)}\n`, "utf8");
  const notify = await notifyLead(row);
  return { ...row, emailed: notify.emailed };
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathName = decodeURIComponent(url.pathname);
  if (pathName === "/") pathName = "/index.html";
  const file = normalize(join(ROOT, pathName));
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    send(res, 404, "No encontrado", "text/plain; charset=utf-8");
    return;
  }
  const type = MIME[extname(file)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/leads") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let data;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      send(res, 400, JSON.stringify({ ok: false, error: "JSON inválido" }));
      return;
    }
    if (!isAllowedBrowser(req)) {
      send(res, 403, JSON.stringify({ ok: false, error: "Origen no permitido" }));
      return;
    }
    const ip = clientIp(req);
    const spam = assessSpam(data);
    if (spam.silent) {
      send(res, 201, JSON.stringify({ ok: true, dropped: true }));
      return;
    }
    if (!spam.ok) {
      send(res, spam.reason === "too_fast" ? 429 : 403, JSON.stringify({ ok: false, error: spam.reason }));
      return;
    }
    if (!rateLimitOk(ip)) {
      send(res, 429, JSON.stringify({ ok: false, error: "rate" }));
      return;
    }
    if (!isValidLead(data)) {
      send(res, 422, JSON.stringify({ ok: false, error: "Faltan datos de contacto" }));
      return;
    }
    const saved = await saveLead(data, ip);
    send(res, 201, JSON.stringify({ ok: true, id: saved.id, emailed: Boolean(saved.emailed) }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/leads") {
    const key = url.searchParams.get("key") || req.headers["x-leads-key"];
    if (key !== LEADS_KEY) {
      send(res, 401, JSON.stringify({ ok: false, error: "Clave incorrecta" }));
      return;
    }
    if (!existsSync(LEADS_FILE)) {
      send(res, 200, JSON.stringify([]));
      return;
    }
    const raw = await readFile(LEADS_FILE, "utf8");
    const leads = raw.trim() ? raw.trim().split("\n").map((line) => JSON.parse(line)) : [];
    send(res, 200, JSON.stringify(leads));
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  send(res, 405, "Método no permitido", "text/plain; charset=utf-8");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Faraday Pack en http://localhost:${PORT}`);
});
