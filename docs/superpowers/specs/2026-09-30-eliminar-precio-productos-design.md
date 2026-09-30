# Design — Remove price from all products

**Date:** 2026-09-30
**Status:** approved (verbal, via brainstorming session)
**Repo:** `C:\Users\corra\Desktop\catalogo` (Next.js 16 + Supabase, *not* a git repository — no commit step applies)

## Problem

The catalog currently exposes a product `price`: it shows on product cards, the
header search dropdown, the product detail hero and the kit customizer breakdown;
it drives the min/max catalog filter; and it feeds the total in the Telegram
order message.

The store wants a **"price on request"** catalog: no monetary amount should be
visible or transmitted anywhere. This is a full removal, not a display toggle.

## Decisions (user-confirmed)

| # | Decision | Choice |
|---|---|---|
| 1 | Scope of removal | **C — total removal.** Remove price from the web UI, the DB column, types, queries, filters, and the Telegram order message. |
| 2 | Kit customizer amounts | No visible amounts at all: no per-option surcharges, no `base + extras = total` breakdown. |
| 3 | Product card dedup (internal only) | Price field disappears from the type, so the "keep the cheapest" tie-break must change to **"keep the first found"**. |
| 4 | Database | **Apply the destructive migration now** (drop `products.price`). The 312 loaded prices are lost irreversibly. |
| 5 | Order message | Telegram message carries **no price and no total** (overrides the earlier "keep the order" answer). |
| — | Explicitly out of scope | Archived snapshots under `.superpowers/sdd/**` (not compiled); `components/__lint_probe.tsx` (already deleted, no action). |

## Design

### 1. Database (Supabase)

- Apply migration `drop products.price`:
  `alter table products drop column if exists price;`
  The `products(price)` index is dropped automatically with the column.
  **Irreversible:** deletes 312 non-zero prices (799 products total, min 0, max 27).
- `supabase/schema.sql`: remove the `price numeric(10,2) not null check (price >= 0)` column line and the `create index on products (price);` line.
- `supabase/seed-tienda-tu-tienda99.sql`: remove `price` from the `insert into products (...)` column list and its value, and drop `price = excluded.price,` from the upsert.

### 2. Data layer (types & queries)

- `lib/types.ts`: remove `price: number;` from `ProductCardData` (inherited by `ProductDetail`).
- `lib/queries.ts`:
  - `CARD` select constant: drop `price`.
  - `ProductFilters`: remove `min?` and `max?`.
  - `getProducts`: remove the `gte('price', …)` / `lte('price', …)` branches.
  - `getCatalogProducts`: drop `price` from the select.
  - `searchProducts`: drop `price` from the select.

### 3. Presentation

- `components/ProductCard.tsx`: remove the price `<p>` and the `eur` import. Replace the price-based tie-break in `expandByVariant` (line 34) with **keep the first entry found** for a repeated kit image.
- `components/SearchBar.tsx`: remove `price` from the local `Result` type, the price render, and the `eur` import.
- `components/Filters.tsx`: remove the two "Precio mín." / "Precio máx." number inputs.
- `app/[categoria]/page.tsx`: stop reading and forwarding `min` / `max`.

### 4. Customizer and order

- `components/KitCustomizer.tsx`: remove the `basePrice` prop, the `calcularTotal` call, the visible surcharges (`+3 €` print / `+2 €` patches) and the breakdown; drop `price`/`total` from the Telegram payload.
- `components/ProductPurchase.tsx`: remove the `price` prop and drop it from the payload.
- `app/producto/[slug]/page.tsx`: remove the hero price and the `basePrice` / `price` props.
- `lib/pedido.ts`: remove `price` and `total` from `PedidoPayload`, their validation blocks, and the whole amount block in `construirMensaje`. The message keeps: product title, size/colour, personalization, patches, and the product link.
- `lib/precios.ts`: no monetary content remains — rename to `lib/personalizacion.ts` keeping only `LIMITE_NOMBRE`.
- `lib/format.ts`: `eur()` becomes unused — delete the file.

### 5. Tests

- `tests/pedido.test.ts`: remove the `price` / `total` cases and update the expected message (no amount line).

## Consequences

- The catalog becomes "price on request"; a buyer must ask via Telegram.
- Cards no longer de-duplicate repeated kit photos by cheapest price; the first
  product encountered for a shared photo wins, which may change which product a
  card links to in a few teams.
- The Telegram order message no longer states any amount, so the shop must quote
  the price in conversation.

## Verification

- `npm run test` (updated `pedido.test.ts` passes).
- `npm run lint`.
- `npm run build` (typecheck catches any leftover `price` reference).
- Manual: run `next dev` and confirm no price in cards, search dropdown, product
  hero, kit customizer, and no price inputs in the catalog filter; place a test
  order and confirm the Telegram message has no amount.
- DB: confirm `products` no longer has a `price` column.
