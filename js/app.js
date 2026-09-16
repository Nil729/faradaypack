const TICKER_ITEMS = [
  "Sobres.es rosa ZIP · desde 0,12 €/ud",
  "RAJAPACK pack 500 · 87,25 €",
  "Unite 100×150 · 0,33 €/ud",
  "Bürklin shielding 200×150 ×100 · 17,06 €",
  "Bürklin 255×200 ×100 · 29,64 €",
  "RAJAPACK metalizada ×100 · 44,85 €",
  "RS PRO negras pack 10 · 20,80 €",
  "Protektive Pak 255×305 ×100 · 35,70 €",
  "IEC 61340-5-1 · ANSI/ESD S20.20"
];

const PRICE_TIERS = {
  rosa: { 500: 0.16, 1000: 0.13, 5000: 0.10, 10000: 0.085, market: 0.175 },
  shielding: { 500: 0.28, 1000: 0.16, 5000: 0.13, 10000: 0.11, market: 0.30 },
  negras: { 500: 0.32, 1000: 0.26, 5000: 0.22, 10000: 0.18, market: 0.38 },
  mbb: { 500: 0.42, 1000: 0.34, 5000: 0.28, 10000: 0.24, market: 0.43 }
};

function unitPrice(family, qty) {
  const t = PRICE_TIERS[family];
  if (qty >= 10000) return t[10000];
  if (qty >= 5000) return t[5000];
  if (qty >= 1000) return t[1000];
  return t[500];
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
  const loop = [...TICKER_ITEMS, ...TICKER_ITEMS]
    .map((t) => `<span><b>ESD</b> ${t}</span>`)
    .join("");
  track.innerHTML = loop;
}

function initCalc() {
  const product = document.getElementById("calc-product");
  const qty = document.getElementById("calc-qty");
  const total = document.getElementById("calc-total");
  const unit = document.getElementById("calc-unit");
  const compare = document.getElementById("calc-compare");
  if (!product) return;

  const render = () => {
    const n = Math.max(500, Number(qty.value) || 500);
    qty.value = n;
    const u = unitPrice(product.value, n);
    const market = PRICE_TIERS[product.value].market * n;
    const ours = u * n;
    total.textContent = euro(ours);
    unit.textContent = `${euro(u)} / ud`;
    const save = market - ours;
    compare.textContent = save > 0
      ? `Frente a una referencia de mercado de ${euro(market)}, el test Faraday Pack ahorra ~${euro(save)} en este volumen.`
      : "Ajuste el volumen para ver el gap frente a canal industrial.";
  };

  product.addEventListener("change", render);
  qty.addEventListener("input", render);
  render();
}

function initForm() {
  const form = document.getElementById("lead-form");
  const status = document.getElementById("form-status");
  if (!form) return;

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

    if (!form.reportValidity()) {
      status.className = "form-status err";
      status.textContent = "Revise los campos obligatorios.";
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.lang = document.documentElement.lang;
    data.page = location.href;
    data.createdAt = new Date().toISOString();
    data.personalEmail = /@(gmail|hotmail|outlook|yahoo|icloud)\./i.test(data.email);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("fail");
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "generate_lead", product: data.producto, volumen: data.volumen });
      location.href = "gracias.html";
    } catch {
      const backup = JSON.parse(localStorage.getItem("fp-leads") || "[]");
      backup.push(data);
      localStorage.setItem("fp-leads", JSON.stringify(backup));
      status.className = "form-status ok";
      status.textContent = "Solicitud guardada en este navegador. Le redirigimos a la confirmación.";
      setTimeout(() => { location.href = "gracias.html"; }, 700);
    }
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
