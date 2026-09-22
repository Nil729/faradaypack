import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildLead, isValidLead, notifyLead } from "../lib/leads.mjs";
import {
  assessSpam,
  clientIp,
  isAllowedBrowser,
  publicLead,
  rateLimitOk
} from "../lib/spam.mjs";

export const config = { maxDuration: 15 };

const LEADS_FILE = join(process.cwd(), "data", "leads.jsonl");

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(body));
}

async function saveLocal(row) {
  if (process.env.VERCEL) return;
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await appendFile(LEADS_FILE, `${JSON.stringify(row)}\n`, "utf8");
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.status(204).end();
    return;
  }

  if (req.method === "POST") {
    if (!isAllowedBrowser(req)) {
      json(res, 403, { ok: false, error: "Origen no permitido" });
      return;
    }
    const data = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const ip = clientIp(req);
    const spam = assessSpam(data);
    if (spam.silent) {
      json(res, 201, { ok: true, dropped: true });
      return;
    }
    if (!spam.ok) {
      json(res, spam.reason === "too_fast" ? 429 : 403, { ok: false, error: spam.reason });
      return;
    }
    if (!rateLimitOk(ip)) {
      json(res, 429, { ok: false, error: "rate" });
      return;
    }
    if (!isValidLead(data)) {
      json(res, 422, { ok: false, error: "Faltan datos de contacto" });
      return;
    }
    const row = buildLead(publicLead(data), ip);
    await saveLocal(row);
    const notify = await notifyLead(row);
    json(res, 201, { ok: true, id: row.id, emailed: notify.emailed, notifyErrors: notify.errors });
    return;
  }

  if (req.method === "GET") {
    const key = req.query.key || req.headers["x-leads-key"];
    const expected = process.env.LEADS_KEY;
    if (!expected || key !== expected) {
      json(res, 401, { ok: false, error: "Clave incorrecta" });
      return;
    }
    if (process.env.VERCEL || !existsSync(LEADS_FILE)) {
      json(res, 200, []);
      return;
    }
    const raw = await readFile(LEADS_FILE, "utf8");
    const leads = raw.trim() ? raw.trim().split("\n").map((line) => JSON.parse(line)) : [];
    json(res, 200, leads);
    return;
  }

  json(res, 405, { ok: false, error: "Método no permitido" });
}
