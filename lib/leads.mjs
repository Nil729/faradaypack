const LEAD_FIELDS = [
  ["nombre", "Nombre"],
  ["cargo", "Cargo"],
  ["empresa", "Empresa"],
  ["cif", "CIF"],
  ["email", "Email"],
  ["telefono", "Teléfono"],
  ["provincia", "Provincia"],
  ["producto", "Producto"],
  ["volumen", "Volumen"],
  ["urgencia", "Urgencia"],
  ["medidas", "Medidas"],
  ["mensaje", "Mensaje"],
  ["lang", "Idioma"],
  ["utm_source", "utm_source"],
  ["utm_medium", "utm_medium"],
  ["utm_campaign", "utm_campaign"],
  ["gclid", "gclid"],
  ["page", "Página"],
  ["createdAt", "Fecha"],
  ["id", "ID"]
];

export function isValidLead(data) {
  return Boolean(
    data
    && typeof data.nombre === "string" && data.nombre.trim().length > 1
    && typeof data.empresa === "string" && data.empresa.trim().length > 1
    && typeof data.email === "string" && /.+@.+\..+/.test(data.email)
    && typeof data.telefono === "string" && data.telefono.replace(/\D/g, "").length >= 9
    && data.gdpr
  );
}

export function buildLead(data, ip) {
  return {
    ...data,
    id: `fp_${Date.now()}`,
    ip,
    createdAt: data.createdAt || new Date().toISOString()
  };
}

export function leadInbox() {
  return process.env.LEADS_EMAIL || "nil.pinyana@gmail.com";
}

export function leadEmailPayload(row) {
  const payload = {
    _subject: `Nueva solicitud Faraday Pack: ${row.empresa || ""} · ${row.producto || ""}`,
    _template: "table",
    _captcha: "false",
    _replyto: row.email || leadInbox()
  };
  for (const [key, label] of LEAD_FIELDS) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      payload[label] = String(value);
    }
  }
  return payload;
}

async function emailViaFormSubmit(row) {
  const to = leadInbox();
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://faradaypack.vercel.app",
      Referer: "https://faradaypack.vercel.app/"
    },
    body: JSON.stringify(leadEmailPayload(row))
  });
  const body = await res.text();
  let parsed = {};
  try { parsed = JSON.parse(body); } catch { parsed = { message: body }; }
  const success = parsed.success === true || parsed.success === "true";
  const activating = /activation|activate form/i.test(String(parsed.message || body));
  if (!res.ok && !activating) {
    throw new Error(`FormSubmit ${res.status}: ${body.slice(0, 300)}`);
  }
  if (!success && !activating) {
    throw new Error(`FormSubmit: ${parsed.message || body.slice(0, 300)}`);
  }
  return { activating, body: parsed };
}

async function emailViaResend(row) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return false;
  const to = leadInbox();
  const text = Object.entries(leadEmailPayload(row))
    .filter(([key]) => !key.startsWith("_"))
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.LEADS_FROM || "Faraday Pack <onboarding@resend.dev>",
      to: [to],
      reply_to: row.email || to,
      subject: `Nueva solicitud Faraday Pack: ${row.empresa || ""} · ${row.producto || ""}`,
      text
    })
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return true;
}

export async function notifyLead(row) {
  const errors = [];
  let emailed = false;

  const webhook = process.env.NOTIFY_WEBHOOK;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row)
      });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
    } catch (error) {
      errors.push(String(error.message || error));
    }
  }

  try {
    if (await emailViaResend(row)) emailed = true;
  } catch (error) {
    errors.push(String(error.message || error));
  }

  if (!emailed) {
    try {
      await emailViaFormSubmit(row);
      emailed = true;
    } catch (error) {
      errors.push(String(error.message || error));
    }
  }

  return { emailed, errors };
}
