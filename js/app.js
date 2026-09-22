const TICKER_ITEMS = [
  "Bolsas antiestáticas rosa ZIP · desde 0,11 €/ud",
  "Shielding 150×200 · desde 0,19 €/ud",
  "Conductoras negras · desde 0,25 €/ud",
  "MBB / barrera de humedad · desde 0,32 €/ud",
  "Pack de muestras · 49 €",
  "Pymes y gran cuenta · atención personalizada",
  "IEC 61340-5-1 · ANSI/ESD S20.20",
  "Salida desde Barcelona"
];

const PRICE_TIERS = {
  rosa: { 250: 0.22, 500: 0.19, 1000: 0.16, 5000: 0.13, 10000: 0.11 },
  shielding: { 250: 0.36, 500: 0.32, 1000: 0.26, 5000: 0.22, 10000: 0.19 },
  negras: { 250: 0.48, 500: 0.42, 1000: 0.35, 5000: 0.29, 10000: 0.25 },
  mbb: { 250: 0.58, 500: 0.52, 1000: 0.44, 5000: 0.36, 10000: 0.32 }
};

function unitPrice(family, qty) {
  const t = PRICE_TIERS[family];
  if (qty >= 10000) return t[10000];
  if (qty >= 5000) return t[5000];
  if (qty >= 1000) return t[1000];
  if (qty >= 500) return t[500];
  return t[250];
}

function euro(n) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

function captureUtm() {
  const params = new URLSearchParams(location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "gclid"].forEach((key) => {
    const value = params.get(key);
    if (value) sessionStorage.setItem(key, value);
    const input = document.querySelector(`[name="${key}"]`);
    if (input) input.value = sessionStorage.getItem(key) || "";
  });
}

function applyLang(lang) {
  const dict = I18N[lang] || I18N.es;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) el.innerHTML = dict[key];
  });
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
  });
  localStorage.setItem("fp-lang", lang);
  const url = new URL(location.href);
  url.searchParams.set("lang", lang);
  history.replaceState({}, "", url);
}

function initTicker() {
  const track = document.getElementById("ticker");
  if (!track) return;
  track.innerHTML = TICKER_ITEMS.map((t) => `<span>${t}</span>`).join("");
}

function initCalc() {
  const product = document.getElementById("calc-product");
  const qty = document.getElementById("calc-qty");
  const total = document.getElementById("calc-total");
  const unit = document.getElementById("calc-unit");
  const compare = document.getElementById("calc-compare");
  if (!product) return;

  const render = () => {
    const n = Math.max(250, Number(qty.value) || 250);
    qty.value = n;
    const u = unitPrice(product.value, n);
    const ours = u * n;
    total.textContent = euro(ours);
    unit.textContent = `${euro(u)} / ud`;
    compare.textContent = "Sin IVA ni portes. Confirmamos tarifa según medida, stock y cadencia de entrega.";
  };

  product.addEventListener("change", render);
  qty.addEventListener("input", render);
  render();
}

function t(key, fallback) {
  const lang = document.documentElement.lang || "es";
  return (I18N[lang] && I18N[lang][key]) || fallback;
}

function inboxAddress() {
  return ["nil.pinyana", "gmail.com"].join("@");
}

function proofFromTimestamp(ts) {
  return String((Number(ts) % 997) + 17);
}

function initForm() {
  const form = document.getElementById("lead-form");
  const status = document.getElementById("form-status");
  const submit = document.getElementById("lead-submit");
  if (!form) return;
  const started = Date.now();
  const tsField = document.getElementById("form_ts");
  const jsField = document.getElementById("fp_js");
  const checkField = document.getElementById("fp_check");
  if (tsField) tsField.value = String(started);
  if (jsField) jsField.value = "1";
  if (checkField) checkField.value = proofFromTimestamp(started);

  const arm = () => {
    if (Date.now() - started >= 4000 && submit) submit.disabled = false;
  };
  setTimeout(arm, 4000);
  form.addEventListener("input", arm, { once: true });

  document.querySelectorAll("[data-product]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const select = document.getElementById("producto");
      if (select) select.value = btn.dataset.product;
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.className = "form-status";
    status.textContent = "Enviando...";
    if (submit) submit.disabled = true;

    const honey = ["website", "fax", "_honey"]
      .map((name) => (form.elements[name]?.value || "").trim())
      .some(Boolean);
    if (honey) {
      location.href = "gracias.html";
      return;
    }

    if (Date.now() - started < 4000) {
      status.className = "form-status err";
      status.textContent = t("form.wait", "Espere un instante y vuelva a enviar.");
      if (submit) submit.disabled = false;
      return;
    }

    if (!form.reportValidity()) {
      status.className = "form-status err";
      status.textContent = "Revise los campos obligatorios.";
      if (submit) submit.disabled = false;
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.lang = document.documentElement.lang;
    data.page = location.href;
    data.createdAt = new Date().toISOString();
    data.personalEmail = /@(gmail|hotmail|outlook|yahoo|icloud)\./i.test(data.email);

    const replyto = document.getElementById("lead-replyto");
    if (replyto) replyto.value = data.email || inboxAddress();
    const subject = form.querySelector("[name=_subject]");
    if (subject) {
      subject.value = `Nueva solicitud Faraday Pack: ${data.empresa || ""} · ${data.producto || ""}`;
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json().catch(() => ({}));
      if (result.dropped) {
        location.href = "gracias.html";
        return;
      }
      if (res.status === 429) {
        status.className = "form-status err";
        status.textContent = t("form.wait", "Espere un instante y vuelva a enviar.");
        if (submit) submit.disabled = false;
        return;
      }
      if (res.status === 403) {
        status.className = "form-status err";
        status.textContent = t("form.spam", "No hemos podido enviar la solicitud. Pruebe de nuevo o escriba a nil.pinyana@gmail.com.");
        if (submit) submit.disabled = false;
        return;
      }
    } catch {
      /* el correo sale por FormSubmit aunque la API falle */
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "generate_lead", product: data.producto, volumen: data.volumen });
    ["website", "fax", "_honey", "form_ts", "fp_js", "fp_check"].forEach((name) => {
      const el = form.elements[name];
      if (el) el.disabled = true;
    });
    form.action = "https://formsubmit.co/" + inboxAddress();
    form.submit();
  });
}

function initChrome() {
  const nav = document.getElementById("nav");
  const toggle = document.querySelector("[data-menu]");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  const cookie = document.getElementById("cookie");
  if (cookie && !localStorage.getItem("fp-cookie")) cookie.classList.add("show");
  document.getElementById("cookie-ok")?.addEventListener("click", () => {
    localStorage.setItem("fp-cookie", "1");
    cookie.classList.remove("show");
  });

  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => applyLang(btn.dataset.lang));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const lang = params.get("lang") || localStorage.getItem("fp-lang") || "es";
  applyLang(lang);
  captureUtm();
  initTicker();
  initCalc();
  initForm();
  initChrome();
});
