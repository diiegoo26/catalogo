# Design — Product order via own Telegram bot

**Date:** 2026-09-30
**Status:** approved (via brainstorming session)
**Repo:** `C:\Users\corra\Desktop\catalogo` (Next.js 16 + Supabase, *not* a git repository — no commit step applies)

## Problem

The product pages already have a "Pedir por Telegram" button, but it relies on a plain
`https://t.me/<username>?text=...` deep link. Telegram only reliably prefills the message
for **bots**, not for chats with people, so customers land on an empty chat and must paste
the order manually (the current code copies it to the clipboard as a workaround). The user
wants the order to reach them **automatically**, without the customer pasting anything.

## Goal

A customer fills in the product options and presses the button; the order is delivered
instantly to the shop owner's Telegram through a **bot** the shop owns. The customer does
**not** need to open Telegram at all.

## Scope decision

**The bot only notifies the shop owner.** The customer never talks to the bot and needs no
Telegram account. This is the simplest reliable design that satisfies "automático".

Explicitly out of scope (YAGNI):

- A conversational bot / catalogue inside Telegram.
- Persisting orders in Supabase.
- Confirming the order back to the customer.

## Current state (evidence)

| Fact | Evidence |
|---|---|
| Two separate order implementations, near-duplicated | `components/ProductPurchase.tsx` (`order()`, L19-29) and `components/KitCustomizer.tsx` (`order()`, L49-69) |
| Both build a plain-text message and open `t.me/<user>?text=` | `window.open(\`https://t.me/${TELEGRAM_USER}?text=...\`, '_blank')` |
| Both copy to clipboard as a fallback | `navigator.clipboard.writeText(text)` |
| Destination is a public env var | `NEXT_PUBLIC_TELEGRAM_USERNAME` in `.env.local.example` |
| Button is disabled until size/color are chosen | `disabled={!ready}` / `disabled={!puedePedir}` |
| Only one API route exists | `app/api/search/route.ts` (7 lines, `GET`) |
| `ProductPurchase` does **not** receive the price today | `app/producto/[slug]/page.tsx` L62 passes only `title` and `variants` |
| Test runner is vitest, node env, `tests/**/*.test.ts` | `vitest.config.ts`; existing `tests/brand-*.test.ts` |

## Architecture

The browser must **never** hold the bot token. All Telegram traffic goes through a server
route:

```
[Product button]  --POST /api/pedido-->  [Next Route Handler]  -->  [Telegram Bot API]
   client state        JSON payload        validate + build           sendPhoto / sendMessage
                                          message, call API
```

- **`POST /api/pedido`** — the only new network boundary. Receives the order as JSON, validates
  it, builds the message, and calls the Telegram Bot API.
- **Server-only secrets**: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Never `NEXT_PUBLIC_`.
- The client button calls `fetch('/api/pedido')` and renders states; it never contacts Telegram.

### Why not call the Bot API straight from the browser

`https://api.telegram.org/bot<token>/sendMessage` would require shipping the bot token to the
client, where anyone could read it and send arbitrary messages as the shop's bot. Rejected.

## Files

| File | Role |
|---|---|
| `app/api/pedido/route.ts` | `POST` handler: parse, validate, delegate to the sender, map the result to a status code |
| `lib/pedido.ts` | `PedidoPayload` type, `validarPedido()` and `construirMensaje()` — pure, unit-testable, shared |
| `lib/telegram.ts` | `enviarPedido(payload)`: chooses `sendPhoto`/`sendMessage`, one retry, error mapping (server-only) |
| `components/BotonTelegram.tsx` | Reusable button with the Telegram logo and the idle/sending/sent/error states |
| `components/ProductPurchase.tsx` | Refactor to use `BotonTelegram`; always active; POSTs; gains `price` + `imageUrl` props |
| `components/KitCustomizer.tsx` | Same, and includes customization, patches and total in the payload |
| `app/producto/[slug]/page.tsx` | Pass `price` (`p.price`) and `imageUrl` (`p.images[0]`) to both components |
| `scripts/telegram-whoami.mjs` | Run once: prints the owner's `chat_id` by reading the bot's `getUpdates` |
| `.env.local.example` | Document the two new variables |
| `tests/pedido.test.ts` | Unit tests for validation + message building |
| `tests/telegram.test.ts` | Unit tests for method selection + error mapping (mocked `fetch`) |

## Data flow

1. Customer presses "Pedir por Telegram".
2. Button enters `sending` (spinner, disabled).
3. `POST /api/pedido` with:

   ```json
   {
     "title": "Camiseta Real Madrid 2026-27",
     "productUrl": "https://.../producto/...",
     "imageUrl": "https://.../cover.jpg",
     "price": 85,
     "talla": "M",
     "color": "Blanco",
     "personalizacion": "GARCÍA 10 (plantilla)",
     "parches": ["LaLiga", "Champions"],
     "total": 92,
     "hp": ""
   }
   ```

   Every field except `title`/`productUrl` is optional. `hp` is the honeypot (must be empty).
4. Route validates, builds the HTML message, calls the Bot API.
5. Success → `200 { ok: true }` → button shows "Pedido enviado ✓" (resets when the selection changes).
6. Failure → `502 { ok: false, error }` → button shows an error and offers **plan B**.

## Message format

`parse_mode: HTML`. Photo of the product as the message image when `imageUrl` is present:

```
🛒 Nuevo pedido
📦 Camiseta Real Madrid 2026-27
Talla: M · Color: Blanco
Personalización: GARCÍA 10 (plantilla)
Parches: LaLiga, Champions
💰 Total: 92,00 € (85,00 € base + 5,00 € extras)
🔗 Ver producto
```

- `construirMensaje()` returns `{ text, imageUrl? }`.
- Escaping: HTML-escape every dynamic value (`& < >`) before interpolation.
- Price lines are only included when the value is present (`eur()` from `lib/format.ts`).
- The product link is rendered as `<a href="productUrl">Ver producto</a>`.

## Reliability

- If `imageUrl` is missing, or Telegram rejects the photo, fall back to `sendMessage` (text only).
- One retry on transient network error (e.g. 5xx from Telegram) before failing.
- The client `fetch` has a timeout so the button never hangs forever.
- The **plan B** path stays available: on error, copy the order text to the clipboard and open
  `t.me/<username>` when `NEXT_PUBLIC_TELEGRAM_USERNAME` is still configured. (The variable is
  kept, not removed, precisely to power this fallback.)

## Security / abuse

- Public endpoint: validate field types and lengths, reject oversized bodies (`Content-Length`
  guard + JSON parse failure handling), never echo raw Telegram errors.
- Honeypot field `hp` (must be empty) plus a minimum time-on-form check: the button stamps
  `performance.now()` on mount and the request is rejected if less than ~1.5 s elapsed.
- Best-effort per-IP rate limit in memory. **Known limitation:** in-memory state is unreliable
  on serverless (multiple instances) — recorded as a follow-up, not a blocker.
- The token is read only server-side and never logged.

## Configuration

1. Create the bot with **@BotFather** → `TELEGRAM_BOT_TOKEN`.
2. Send the bot any message → `npm run telegram:whoami` → `TELEGRAM_CHAT_ID`.
3. Add both to `.env.local` (and to Vercel in production).

`.env.local.example` becomes:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
NEXT_PUBLIC_TELEGRAM_USERNAME=tu_usuario_telegram   # optional: plan-B fallback
```

## Testing

- **vitest** (already configured, `tests/**/*.test.ts`, node env):
  - `construirMensaje`: HTML escaping, optional-field handling, photo vs text.
  - `validarPedido`: rejects bad/missing/oversized fields, rejects a filled honeypot.
  - `enviarPedido`: picks `sendPhoto` when `imageUrl` is set, `sendMessage` otherwise; maps
    Telegram errors to domain errors; retries once (mocked `fetch`).
- **Optional E2E (Playwright, already installed):** button → mocked `/api/pedido` → "enviado"
  state. Only if the flow is hard to cover with unit tests.

## Success criteria

1. Pressing the button on any product page delivers the order to the owner's Telegram within a
   couple of seconds, with no action required from the customer.
2. The order message contains the product, chosen options and total, plus the product photo.
3. All four improved aspects are visible: Telegram branding, reliable delivery, richer message,
   always-active button.
4. Unit tests pass (`npm test`).
