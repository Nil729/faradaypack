# Faraday Pack

Landing B2B para **bolsas antiestáticas**, **bolsas ESD**, **embalaje ESD** y **embalaje para componentes electrónicos**. Mercado España / Catalunya. Diseñada para SEO, Google Ads y captación de leads de compra.

## Qué incluye

- Página única de conversión (`index.html`) con ES/CA
- Comparativa de **precios públicos de mercado** (septiembre 2026): Sobres.es, RAJAPACK, Unite/Mercateo, Bürklin, RS PRO, Protektive Pak
- Fotos de catálogo **propias** (no se copian imágenes de terceros)
- Formulario RFQ que guarda leads en `data/leads.jsonl`
- Página `/admin.html` para revisar solicitudes
- `/gracias.html` como URL de conversión de Google Ads
- Estimador de pedido y kit de validación a 39 €

## Arranque local

```bash
node server.mjs
```

Abre [http://localhost:4173](http://localhost:4173)

- Leads: `POST /api/leads`
- Listado: `GET /api/leads?key=faraday-dev` (cambia `LEADS_KEY` en producción)
- Admin: [http://localhost:4173/admin.html](http://localhost:4173/admin.html)

Opcional: copia `.env.example` y exporta `NOTIFY_WEBHOOK` (Make, n8n, Slack) para avisar de cada lead.

## Google Ads / SEO

1. Sustituye el dominio `faradaypack.es` en `index.html`, `robots.txt` y `sitemap.xml`.
2. Campaña Search: grupos de anuncios por keyword (`bolsas esd`, `bolsas antiestáticas`, `embalaje componentes electrónicos`).
3. URL final con UTM:

`https://faradaypack.es/?utm_source=google&utm_medium=cpc&utm_campaign=bolsas-esd&utm_content={creative}`

4. Conversión: página `gracias.html` (`dataLayer` event `conversion`).
5. Inserta gtag / Google Tag Manager en `index.html` y `gracias.html` cuando tengas el ID.
6. Teléfono y WhatsApp: reemplaza `600 000 000`.

## Aviso sobre precios de terceros

Los importes de otros proveedores son **referencias públicas** para que compras compare y para validar si el producto tiene salida. No hay relación comercial con esas marcas. Los precios Faraday Pack son de **test de demanda**, no una oferta vinculante.

## Antes de publicar

- NIF, domicilio y email reales en páginas legales
- Clave `LEADS_KEY` robusta
- HTTPS y copias de `leads.jsonl` (datos personales RGPD)
