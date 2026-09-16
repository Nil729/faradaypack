import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, appendFile, readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const LEADS_KEY = process.env.LEADS_KEY || "faraday-dev";
const LEADS_FILE = join(ROOT, "data", "leads.jsonl");
const WEBHOOK = process.env.NOTIFY_WEBHOOK || "";

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

function isValidLead(data) {
  return data
    && typeof data.nombre === "string" && data.nombre.trim().length > 1
    && typeof data.empresa === "string" && data.empresa.trim().length > 1
    && typeof data.email === "string" && /.+@.+\..+/.test(data.email)
    && typeof data.telefono === "string" && data.telefono.replace(/\D/g, "").length >= 9
    && data.gdpr;
}

async function saveLead(data) {
  await mkdir(join(ROOT, "data"), { recursive: true });
  const row = {
    ...data,
    id: `fp_${Date.now()}`,
    ip: data.ip,
    createdAt: data.createdAt || new Date().toISOString()
  };
  await appendFile(LEADS_FILE, `${JSON.stringify(row)}\n`, "utf8");
  if (WEBHOOK) {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row)
    }).catch(() => {});
  }
  return row;
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
    if (!isValidLead(data)) {
      send(res, 422, JSON.stringify({ ok: false, error: "Faltan datos de contacto" }));
      return;
    }
    data.ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString();
    const saved = await saveLead(data);
    send(res, 201, JSON.stringify({ ok: true, id: saved.id }));
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
