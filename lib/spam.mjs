const INTERNAL_FIELDS = new Set([
  "website",
  "fax",
  "_honey",
  "form_ts",
  "fp_js",
  "fp_check",
  "_next",
  "_captcha",
  "_template",
  "_subject",
  "_replyto"
]);

const DISPOSABLE = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "moakt.com"
]);

const SPAM_TEXT = /viagra|cialis|crypto\s*pump|seo\s*backlink|guest\s*post|porn|casino|loan\s*approval|whatsapp\s*marketing/i;

const hits = new Map();

export function proofFromTimestamp(ts) {
  return String((Number(ts) % 997) + 17);
}

export function clientIp(req) {
  const forwarded = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim();
  return forwarded || (req.socket?.remoteAddress || "").toString() || "unknown";
}

export function isAllowedBrowser(req) {
  const origin = String(req.headers.origin || "");
  const referer = String(req.headers.referer || "");
  const source = origin || referer;
  if (!source) return true;
  try {
    const host = new URL(source).hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host === "faradaypack.vercel.app") return true;
    if (host.endsWith(".vercel.app") && host.includes("faradaypack")) return true;
    return false;
  } catch {
    return false;
  }
}

export function rateLimitOk(ip, max = 4, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= max) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

function urlCount(text) {
  return (String(text || "").match(/https?:\/\/|www\./gi) || []).length;
}

function emailDomain(email) {
  return String(email || "").split("@")[1]?.toLowerCase().trim() || "";
}

export function assessSpam(data) {
  if (String(data.website || data.fax || data._honey || "").trim()) {
    return { ok: false, silent: true, reason: "honeypot" };
  }

  const ts = Number(data.form_ts);
  if (!Number.isFinite(ts)) {
    return { ok: false, silent: false, reason: "token" };
  }
  const age = Date.now() - ts;
  if (age < 4000) {
    return { ok: false, silent: false, reason: "too_fast" };
  }
  if (age > 2 * 60 * 60 * 1000) {
    return { ok: false, silent: false, reason: "expired" };
  }
  if (String(data.fp_js) !== "1" || String(data.fp_check) !== proofFromTimestamp(ts)) {
    return { ok: false, silent: false, reason: "token" };
  }

  const domain = emailDomain(data.email);
  if (DISPOSABLE.has(domain)) {
    return { ok: false, silent: false, reason: "email" };
  }

  const blob = `${data.nombre || ""} ${data.empresa || ""} ${data.mensaje || ""} ${data.medidas || ""}`;
  if (SPAM_TEXT.test(blob) || urlCount(data.nombre) || urlCount(data.empresa) || urlCount(blob) >= 3) {
    return { ok: false, silent: true, reason: "content" };
  }

  return { ok: true };
}

export function publicLead(data) {
  const row = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (INTERNAL_FIELDS.has(key)) continue;
    row[key] = value;
  }
  return row;
}
