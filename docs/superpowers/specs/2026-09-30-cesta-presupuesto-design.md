# Design — Cart + "Obtener presupuesto" via own Telegram bot

**Date:** 2026-09-30
**Status:** approved (via brainstorming session)
**Repo:** `C:\Users\corra\Desktop\catalogo` (Next.js + Supabase)

## Problem

Today every product page sends an **independent** order to the shop owner's Telegram the
moment the customer presses the button. There is no way to configure several items and send
them together, and there is no way for the customer to state where the order must ship —
which matters because **shipping is an extra cost** the owner adds to the quote.

## Goal

Turn the per-product "send now" button into an **add-to-cart** action. The customer builds a
cart, and when ready presses **"Obtener presupuesto"**, provides **province + locality**, and
the whole cart is delivered to the owner's Telegram in one go. The customer then sees an
on-site confirmation: *"Te atenderemos lo antes posible"*. The customer never talks to the
bot and needs no Telegram account.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Cart UI | **Both**: a header cart icon with counter opening a side **drawer**, plus a dedicated **`/cesta` page** |
| Customer notice | **On-site confirmation** only. No bot message to the customer |
| Locality | **Province dropdown** (52 provinces) **+ locality text** |
| Customer data | Collected **once in the cart** (not on each product page) |
| Persistence | **`sessionStorage`** (survives reloads, dies on tab close) |
| Owner message | **Photo album** (`sendMediaGroup`) **+ separate summary message** |
| Album edge cases | Batch >10 into several albums; items without a photo appear only in the summary; no photos → summary only |
| Send failure | Keep the **plan B**: copy cart text to clipboard + offer `t.me/<username>` |

## Current state (evidence)

| Fact | Evidence |
|---|---|
| Two near-duplicated order implementations, each sends immediately | `components/ProductPurchase.tsx` (`pedir()`, L26-55) and `components/KitCustomizer.tsx` (`pedir()`, L51-86) |
| Both collect customer data on the product page | `DatosCliente` rendered inside both components |
| One shared button with Telegram styling + states | `components/BotonTelegram.tsx` |
| Server route validates and delegates to the sender | `app/api/pedido/route.ts` (37 lines) |
| Validation + message builder are pure and tested | `lib/pedido.ts`, `tests/pedido.test.ts` |
| Telegram sender picks `sendPhoto`/`sendMessage`, one retry | `lib/telegram.ts` (`enviarPedido`, `enviarConReintento`) |
| Simple products vs kits split at the page level | `app/producto/[slug]/page.tsx` L69-74 |
| Rate limiting per IP already exists | `lib/rate-limit.ts`, used by the route |
| Test runner is vitest, node env, `tests/**/*.test.ts` | `vitest.config.ts`, `tests/*.test.ts` |

## Architecture

The browser must **never** hold the bot token; all Telegram traffic stays server-side.

```
[Product page] --"Agregar a la cesta"--> [CestaContext + sessionStorage]
                                                |
[Header cart icon + counter] / [/cesta page] ---+
                                                v
                          "Obtener presupuesto" (province + locality)
                                                | POST /api/presupuesto
                                                v
              [Route Handler: validate + rate-limit] --> [lib/telegram.ts]
                                                |  sendMediaGroup (batches of 2-10)
                                                |  sendMessage (summary)
                                                v
                                          Owner's Telegram
```

- Public network boundary: **`POST /api/presupuesto`** (new). Receives the cart + customer +
  province + locality as JSON, validates it, and sends it.
- Server-only secrets stay `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`.
- Plan B public var `NEXT_PUBLIC_TELEGRAM_USERNAME` stays (clipboard + `t.me` fallback).

## Cart model

One cart item:

```ts
type ItemCesta = {
  id: string;          // stable line id
  title: string;       // product title (with variant suffix for kits)
  productUrl: string;  // absolute product URL
  imageUrl?: string;   // first image, when available
  talla: string;
  cantidad: number;    // 1-99
  color?: string;
  personalizacion?: string;
  parches?: string[];
  notas?: string;
};
```

- Adding the **same product with the same options** merges into the existing line, summing
  `cantidad` (clamped at 99). Different options → a new line.
- Persistence key: `cesta:v1` in `sessionStorage`, storing `{ items: ItemCesta[] }`.
- The persisted blob is parsed defensively; an invalid/old blob is discarded.

## User flow

1. **Product page** (`ProductPurchase` / `KitCustomizer`): configure the item, then press
   **"Agregar a la cesta"**. The old "Pedir por Telegram" button and the per-product
   `DatosCliente` form are removed. Immediate feedback: "Añadido a la cesta ✓".
2. **Header cart icon** with a live counter opens the **drawer** (item list, quantity edit,
   remove, and a "Ver cesta completa" link).
3. **`/cesta` page**: editable item list + a single customer form (**nombre**, **teléfono**
   required; **Telegram username** optional) + **province `<select>`** + **locality text** +
   **"Obtener presupuesto"** button.
4. On success: the site shows *"¡Gracias! Te atenderemos lo antes posible"* and the cart is
   cleared.
5. On failure: the cart stays, the full text (items + province + locality) is copied to the
   clipboard, and a link to `t.me/<username>` is offered.

## Telegram message

Two deliveries, both through the existing `enviarConReintento`:

1. **Photos** — for items that have an `imageUrl`:
   - 1 photo → `sendPhoto` (short caption).
   - ≥2 photos → `sendMediaGroup`, in **batches of 10** (Telegram allows 2-10 per album).
   - Album first-photo caption: short header only (e.g. `🛒 Presupuesto — N artículos`).
   - Album failure is non-fatal: the summary is still attempted.
2. **Summary** — always sent via `sendMessage` (`parse_mode: HTML`), containing:
   - `🛒 Nuevo presupuesto (N artículos)`
   - One block per item: title, `Talla · Cantidad · Color`, personalización, parches, notas,
     and `<a href="productUrl">Ver producto</a>`.
   - Customer: nombre, phone (`tel:` link), optional Telegram link.
   - `📍 Envío: <localidad> (<provincia>)` — flagged as **shipping is an extra**.

The overall send succeeds if the summary succeeds (photos are best-effort).

### Example summary

```
🛒 Nuevo presupuesto (2 artículos)

1. 📦 Camiseta Real Madrid 2026-27
   Talla: M · Cantidad: 2 · Color: Blanco
   Personalización: GARCÍA 10 (plantilla)
   🔗 Ver producto

2. 📦 Bufanda Real Madrid
   Talla: Única · Cantidad: 1
   🔗 Ver producto

👤 Cliente: Ana Pérez
📞 +34 612 345 678
📍 Envío: Alcobendas (Madrid) — el envío es un extra
```

No prices are shown: the owner replies with the quote including shipping.

## Files

| File | Role |
|---|---|
| `lib/cesta.ts` (new) | `ItemCesta` type, pure reducer (`agregar`/`quitar`/`actualizarCantidad`/`vaciar`), `sessionStorage` (de)serialization — unit-testable |
| `components/CestaProvider.tsx` (new) | React context + `useCesta()` hook, backed by `sessionStorage` |
| `components/CestaDrawer.tsx` (new) | Side drawer with the item list |
| `components/BotonCesta.tsx` (new) | Header cart icon + live counter that opens the drawer |
| `app/cesta/page.tsx` (new) | Cart page + checkout form + confirmation |
| `components/CestaCheckout.tsx` (new) | Customer/province/locality form + submit + states |
| `components/Header.tsx` | Mount `<BotonCesta />` |
| `app/layout.tsx` | Wrap children in `<CestaProvider>` |
| `components/ProductPurchase.tsx`, `components/KitCustomizer.tsx` | Replace the send button with "Agregar a la cesta"; drop `DatosCliente` |
| `components/BotonTelegram.tsx` | Reuse/generalize (or add `BotonAgregar`) for the add-to-cart states |
| `components/DatosCliente.tsx` | Kept, moved to the cart checkout |
| `lib/provincias.ts` (new) | The 52 Spanish provinces |
| `lib/pedido.ts` | Add `validarPresupuesto` + `construirResumen` (keeping `escapeHtml`) |
| `lib/telegram.ts` | Add `enviarPresupuesto` (album batching + summary) |
| `app/api/presupuesto/route.ts` (new) | `POST`: parse, validate, rate-limit, delegate, map status |
| tests | `validarPresupuesto`, `construirResumen`, `enviarPresupuesto` batching, cart reducer |

`app/api/pedido/route.ts` and the single-order path are removed once nothing calls them.

## Validation, security and limits

- Validate field types and lengths; reject oversized bodies (Content-Length guard + parse
  failure handling); honeypot `hp` must be empty; per-IP rate limit via `lib/rate-limit.ts`.
- Limits: max **20 items**; `cantidad` 1-99; `localidad` ≤ 80 chars; `nombre` ≤ 60;
  `telefono` valid (`telefonoValido`); `provincia` must be in the known list.
- Empty cart → the "Obtener presupuesto" button is disabled.
- Never echo raw Telegram errors to the client.

## Testing

- **vitest** (node env):
  - `lib/cesta.ts`: add/merge/remove/update-quantity/vaciar; corrupt `sessionStorage` blob is
    discarded.
  - `validarPresupuesto`: valid payload; rejects bad/missing/oversized fields, unknown
    province, >20 items, filled honeypot.
  - `construirResumen`: HTML escaping, optional-field handling, item list + shipping line.
  - `enviarPresupuesto` (mocked `fetch`): `sendPhoto` for 1 item, `sendMediaGroup` for ≥2,
    batching >10, summary always sent, album failure still succeeds via the summary.
- **Optional E2E (Playwright):** add two products → open `/cesta` → submit against a mocked
  `/api/presupuesto` → confirmation shown and cart cleared.

## Success criteria

1. Adding items from product pages never sends a Telegram message by itself.
2. "Obtener presupuesto" requires province + locality, then delivers the whole cart (album of
   photos + summary) to the owner's Telegram in one go.
3. The customer sees "Te atenderemos lo antes posible" on the site.
4. The cart survives reloads within the tab (`sessionStorage`) and clears after a successful
   send.
5. On failure the plan B (clipboard + `t.me`) is offered.
6. Unit tests pass (`npm test`).

## Out of scope (YAGNI)

Persisting orders in Supabase; a conversational bot or in-Telegram catalogue; the bot replying
to the customer; prices/total on the site; online payment.
