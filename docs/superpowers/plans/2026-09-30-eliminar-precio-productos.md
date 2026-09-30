# Remove Price From All Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every trace of product price — web UI, filters, TypeScript types, queries, the `products.price` DB column, and the Telegram order message — turning the catalog into "price on request".

**Architecture:** Remove the amount in dependency order so the tree stays green after every task: (1) the order pipeline loses `price`/`total`; (2) the UI stops displaying/forwarding it; (3) the product types and queries stop selecting/typing it; (4) only then is the DB column dropped. Each task compiles and can be verified on its own.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, vitest (node env), Supabase (Postgres).

## Global Constraints

- **Repo is NOT a git repository** — there is no commit step. Every "Commit" becomes a **checkpoint**: run the stated verification and confirm green.
- Vitest: `tests/**/*.test.ts`, `environment: 'node'`. Import app code with **relative** paths (`../lib/...`).
- All user-facing copy is **Spanish** (existing UI language). Code comments and identifiers stay as they are.
- Do **not** add new runtime dependencies.
- Next.js 16 may differ from training data — if an API is unfamiliar, read `node_modules/next/dist/docs/` before coding.
- **Destructive, user-approved:** dropping `products.price` deletes 312 non-zero prices (799 products, values 0–27) irreversibly.
- Out of scope: archived snapshots under `.superpowers/sdd/**` (never edit). `components/__lint_probe.tsx` no longer exists.

---

### Task 1: Order pipeline loses price and total

**Files:**
- Modify: `lib/pedido.ts`
- Test: `tests/pedido.test.ts`

**Interfaces:**
- Produces (unchanged signatures, narrower payload):
  - `type PedidoPayload = { title: string; productUrl: string; imageUrl?: string; talla?: string; color?: string; personalizacion?: string; parches?: string[]; hp?: string; elapsedMs?: number }`
  - `function validarPedido(raw: unknown): { ok: true; pedido: PedidoPayload } | { ok: false; error: string }`
  - `function construirMensaje(p: PedidoPayload): { text: string; imageUrl?: string }`
- Consumes: nothing from other tasks. UI callers may still send `price`/`total` in the JSON body; `validarPedido` now ignores unknown fields, so no client change is required for this task to be green.

- [ ] **Step 1: Rewrite the test to expect no monetary amount**

Replace the entire contents of `tests/pedido.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { escapeHtml, validarPedido, construirMensaje } from '../lib/pedido';

const base = { title: 'Camiseta Real Madrid 2026-27', productUrl: 'https://x.test/producto/camiseta' };

describe('escapeHtml', () => {
  it('escapes & < >', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });
});

describe('validarPedido', () => {
  it('accepts a minimal payload and trims the title', () => {
    const r = validarPedido({ ...base, title: '  Kit  ' });
    expect(r).toEqual({ ok: true, pedido: { title: 'Kit', productUrl: base.productUrl } });
  });

  it('rejects a non-object', () => {
    expect(validarPedido(null)).toEqual({ ok: false, error: 'payload' });
    expect(validarPedido([1])).toEqual({ ok: false, error: 'payload' });
  });

  it('rejects a missing title or a non-http productUrl', () => {
    expect(validarPedido({ productUrl: base.productUrl })).toEqual({ ok: false, error: 'title' });
    expect(validarPedido({ title: 'x', productUrl: 'javascript:alert(1)' })).toEqual({ ok: false, error: 'productUrl' });
  });

  it('rejects an over-long title', () => {
    expect(validarPedido({ ...base, title: 'x'.repeat(201) })).toEqual({ ok: false, error: 'title' });
  });

  it('rejects a filled honeypot and an impossibly fast submit', () => {
    expect(validarPedido({ ...base, hp: 'bot' })).toEqual({ ok: false, error: 'spam' });
    expect(validarPedido({ ...base, elapsedMs: 10 })).toEqual({ ok: false, error: 'spam' });
  });

  it('rejects a bad parches entry and ignores price/total', () => {
    expect(validarPedido({ ...base, parches: ['ok', 5] })).toEqual({ ok: false, error: 'parches' });
    expect(validarPedido({ ...base, price: 85, total: 92 })).toEqual({ ok: true, pedido: { title: base.title, productUrl: base.productUrl } });
  });

  it('keeps every remaining optional field', () => {
    const r = validarPedido({ ...base, talla: 'M', color: 'Blanco', personalizacion: 'GARCÍA 10', parches: ['LaLiga'] });
    expect(r).toEqual({ ok: true, pedido: { title: base.title, productUrl: base.productUrl, talla: 'M', color: 'Blanco', personalizacion: 'GARCÍA 10', parches: ['LaLiga'] } });
  });
});

describe('construirMensaje', () => {
  it('builds the minimum message with just a product link', () => {
    const { text, imageUrl } = construirMensaje({ ...base });
    expect(text).toContain('🛒 <b>Nuevo pedido</b>');
    expect(text).toContain(`📦 <b>${base.title}</b>`);
    expect(text).toContain(`<a href="${base.productUrl}">Ver producto</a>`);
    expect(imageUrl).toBeUndefined();
  });

  it('combines talla and color on one line and escapes the title', () => {
    const { text } = construirMensaje({ title: 'A & B', productUrl: base.productUrl, talla: 'M', color: 'Negro' });
    expect(text).toContain('📦 <b>A &amp; B</b>');
    expect(text).toContain('Talla: M · Color: Negro');
  });

  it('never shows any monetary amount and passes the photo through', () => {
    const { text, imageUrl } = construirMensaje({ ...base, imageUrl: 'https://x.test/a.jpg' });
    expect(text).not.toContain('💰');
    expect(text).not.toContain('€');
    expect(imageUrl).toBe('https://x.test/a.jpg');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/pedido.test.ts`
Expected: FAIL — the "ignores price/total" case still returns `price`/`total` in `pedido`, and the "never shows any monetary amount" case still contains `💰`.

- [ ] **Step 3: Implement the minimal change in `lib/pedido.ts`**

Delete the `format` import (line 1) so the file starts with the type:

```ts
export type PedidoPayload = {
```

Remove `price?: number;` and `total?: number;` from `PedidoPayload` (leave the other fields).

Delete the now-unused `numero` helper:

```ts
function numero(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000 ? v : null;
}
```

Delete both `price` and `total` validation blocks in `validarPedido`:

```ts
  if (o.price !== undefined) {
    const price = numero(o.price);
    if (price === null) return { ok: false, error: 'price' };
    pedido.price = price;
  }
  if (o.total !== undefined) {
    const total = numero(o.total);
    if (total === null) return { ok: false, error: 'total' };
    pedido.total = total;
  }
```

Delete the whole amount block in `construirMensaje` (between the `parches` line and the product link):

```ts
  if (p.total !== undefined) {
    const extras = p.price !== undefined ? Math.round((p.total - p.price) * 100) / 100 : 0;
    lineas.push(
      extras > 0
        ? `💰 Total: ${eur(p.total)} (${eur(p.price as number)} base + ${eur(extras)} extras)`
        : `💰 Total: ${eur(p.total)}`,
    );
  } else if (p.price !== undefined) {
    lineas.push(`💰 Precio: ${eur(p.price)}`);
  }
```

The message now goes straight from the patches line to `lineas.push(\`🔗 <a href="${escapeHtml(p.productUrl)}">Ver producto</a>\`);`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/pedido.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Checkpoint**

Run: `npm test`
Expected: all test files green (`pedido`, `brand-counts`, `telegram`, `rate-limit`, `brand-view`).

---

### Task 2: UI stops displaying and forwarding price

**Files:**
- Modify: `components/ProductCard.tsx`
- Modify: `components/SearchBar.tsx`
- Modify: `components/Filters.tsx`
- Modify: `app/[categoria]/page.tsx`
- Modify: `components/KitCustomizer.tsx`
- Modify: `components/ProductPurchase.tsx`
- Modify: `app/producto/[slug]/page.tsx`
- Rename + rewrite: `lib/precios.ts` → `lib/personalizacion.ts`
- Delete: `lib/format.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `lib/personalizacion.ts` exports `LIMITE_NOMBRE: number` (was `lib/precios`).
  - `KitCustomizer` props no longer include `basePrice`.
  - `ProductPurchase` props no longer include `price`.
- Note: `price` is still present on the `ProductCardData`/`ProductDetail` types and in `lib/queries.ts` selects after this task — that is fine and is removed in Task 3. Do not touch `lib/types.ts` or `lib/queries.ts` here.

- [ ] **Step 1: Change the product-card image de-duplication to keep the first entry**

In `components/ProductCard.tsx`:

Remove the import on line 3:

```ts
import { eur } from '@/lib/format';
```

In `expandByVariant`, replace the `if / else if` block:

```ts
      if (at === undefined) {
        indexByImage.set(key, entries.length);
        entries.push({ product, variant });
      } else if (product.price < entries[at].product.price) {
        entries[at] = { product, variant };
      }
```

with:

```ts
      if (at === undefined) {
        indexByImage.set(key, entries.length);
        entries.push({ product, variant });
      }
```

Also update the explanatory comment above the function — replace:

```ts
// Kit photos are unique per team+kit, but the same photo appears in several
// products of one team ("Camiseta …", "Player Versión …", "Conjunto … Niño").
// We show each kit photo only ONCE per page, keeping the cheapest product (the
// normal jersey), so a team lists just Local/Visitante/Tercera instead of the
// duplicate Player Versión / Niño products.
```

with:

```ts
// Kit photos are unique per team+kit, but the same photo appears in several
// products of one team ("Camiseta …", "Player Versión …", "Conjunto … Niño").
// We show each kit photo only ONCE per page, keeping the first product seen
// (now that price no longer decides the winner), so a team lists just
// Local/Visitante/Tercera instead of the duplicate Player Versión / Niño products.
```

Remove the price line (line 84):

```tsx
        {p.price > 0 && <p className="mt-0.5 text-sm font-semibold">{eur(p.price)}</p>}
```

- [ ] **Step 2: Remove price from the search dropdown**

In `components/SearchBar.tsx`:

Remove the import on line 5:

```ts
import { eur } from '@/lib/format';
```

Change the `Result` type on line 7:

```ts
type Result = { title: string; slug: string; images: string[] };
```

Remove the price line (line 63):

```tsx
                <p className="text-xs text-neutral-500">{eur(r.price)}</p>
```

- [ ] **Step 3: Remove the price inputs from the catalog filter**

In `components/Filters.tsx`:

Change the doc comment on line 4:

```ts
/** Filtros por URL (?gender=) — compartibles y compatibles con SSR. */
```

Remove the two number inputs (lines 29-32):

```tsx
      <input type="number" min={0} placeholder="Precio mín." className={field}
        defaultValue={sp.get('min') ?? ''} onBlur={(e) => set('min', e.target.value)} />
      <input type="number" min={0} placeholder="Precio máx." className={field}
        defaultValue={sp.get('max') ?? ''} onBlur={(e) => set('max', e.target.value)} />
```

The `gender` `<select>` remains the only field inside the `<aside>`.

- [ ] **Step 4: Stop reading min/max on the category page**

In `app/[categoria]/page.tsx`:

Change line 10:

```ts
type SP = { gender?: string };
```

Remove the `min` and `max` entries from the `getProducts` call (lines 31-32):

```ts
          gender: sp.gender || undefined,
```

so the call ends after `gender`.

- [ ] **Step 5: Remove all amounts from the kit customizer**

In `components/KitCustomizer.tsx`:

Remove the import on line 5:

```ts
import { eur } from '@/lib/format';
```

Change the import on line 6 (file renamed in Step 8):

```ts
import { LIMITE_NOMBRE } from '@/lib/personalizacion';
```

Remove `basePrice: number;` from `Props` (line 18) and from the destructured parameters (line 24), so the signature becomes:

```ts
export default function KitCustomizer({ title, variants, players, patches, imageUrl }: Props) {
```

Remove the total computation (lines 42-45):

```ts
  const { total } = useMemo(
    () => calcularTotal(basePrice, { impresion: conImpresion, parches: conParches }),
    [basePrice, conImpresion, conParches],
  );
```

In the `pedir` payload (line 66), remove `price: basePrice, total,` so the body is:

```ts
        body: JSON.stringify({
          title, productUrl, imageUrl,
          talla: size ?? undefined, color: color ?? undefined,
          personalizacion,
          parches: conParches ? patches.map((p) => p.name) : undefined,
          elapsedMs: Date.now() - montadoEn.current, hp: '',
        }),
```

Remove the print surcharge line (lines 148-150):

```tsx
        {conImpresion && (
          <p className="mt-2 text-xs text-neutral-500">Impresión de nombre/número: +{eur(PRECIO_IMPRESION)}</p>
        )}
```

Change the patches line (line 154) to drop the amount:

```tsx
            <p className="mb-2 text-xs text-neutral-500">Parches de competiciones incluidos</p>
```

Remove the whole price breakdown paragraph (lines 170-175):

```tsx
      <p className="text-sm text-neutral-600">
        {eur(basePrice)}
        {conImpresion && <> + {eur(PRECIO_IMPRESION)} impresión</>}
        {conParches && <> + {eur(PRECIO_PARCHE)} parches</>}
        <span className="ml-2 font-semibold text-neutral-900">= {eur(total)}</span>
      </p>
```

(`useMemo` stays — it is still used by `sizes` and `colors`.)

- [ ] **Step 6: Remove price from the plain purchase component**

In `components/ProductPurchase.tsx`:

Change the props (lines 9-11):

```tsx
export default function ProductPurchase({ title, variants, imageUrl }: {
  title: string; variants: Variant[]; imageUrl?: string;
}) {
```

Remove `price,` from the payload (line 31), so the body is:

```ts
        body: JSON.stringify({
          title, productUrl, imageUrl,
          talla: size ?? undefined, color: color ?? undefined,
          elapsedMs: Date.now() - montadoEn.current, hp: '',
        }),
```

- [ ] **Step 7: Remove the hero price and the price props on the product page**

In `app/producto/[slug]/page.tsx`:

Remove the import on line 7:

```ts
import { eur } from '@/lib/format';
```

Remove the hero price (line 55):

```tsx
          {p.price > 0 && <p className="mt-2 text-2xl font-semibold">{eur(p.price)}</p>}
```

Remove `basePrice={p.price} ` from `KitCustomizer` (line 60):

```tsx
              <KitCustomizer title={p.title} variants={p.variants}
                players={players} patches={patches} imageUrl={p.images[0]} />
```

Remove `price={p.price} ` from `ProductPurchase` (line 62):

```tsx
              <ProductPurchase title={p.title} variants={p.variants} imageUrl={p.images[0]} />
```

- [ ] **Step 8: Rename `lib/precios.ts` to `lib/personalizacion.ts` and delete the `eur` formatter**

Delete `lib/precios.ts` and create `lib/personalizacion.ts` with exactly:

```ts
export const LIMITE_NOMBRE = 12;     // characters
```

Delete `lib/format.ts` entirely (its only export `eur` now has no callers).

- [ ] **Step 9: Verify**

Run: `npm run lint`
Expected: PASS, no unused-import or unused-variable errors.

Run: `npm run build`
Expected: PASS (typecheck clean). If it fails, the error names a leftover `price`/`eur` reference — fix it before proceeding.

Run: `npm test`
Expected: PASS.

- [ ] **Step 10: Checkpoint (manual smoke test)**

With `npm run dev`, open a category listing, a product detail (kit and non-kit), and the header search: no price is visible anywhere, the catalog filter shows only the gender selector, and the kit customizer shows no `+€` or breakdown. Place a test order and confirm the Telegram message contains no `💰`/amount.

---

### Task 3: Remove price from types and queries

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/queries.ts`

**Interfaces:**
- Consumes: the UI from Task 2 no longer reads `price`.
- Produces:
  - `ProductCardData = { id: string; title: string; slug: string; images: string[]; brand: { name: string } | null }`
  - `ProductFilters = { categoryId?: string; brandId?: string; teamId?: string; gender?: string; season?: string }`

- [ ] **Step 1: Drop `price` from the product card type**

In `lib/types.ts` the current block is:

```ts
export type ProductCardData = {
  id: string; title: string; slug: string; price: number;
  images: string[]; brand: { name: string } | null;
};
```

Change it to (remove only `price: number;`; `images` must appear once):

```ts
export type ProductCardData = {
  id: string; title: string; slug: string;
  images: string[]; brand: { name: string } | null;
};
```

- [ ] **Step 2: Drop `price` from every query**

In `lib/queries.ts`:

Change line 5:

```ts
const CARD = 'id,title,slug,images,brand:brands(name)';
```

Change the `ProductFilters` type (line 69) to remove `min?` and `max?`:

```ts
export type ProductFilters = {
  categoryId?: string; brandId?: string; teamId?: string;
  gender?: string; season?: string;
};
```

Remove the min/max filters in `getProducts` (lines 78-79):

```ts
  if (f.min != null) q = q.gte('price', f.min);
  if (f.max != null) q = q.lte('price', f.max);
```

Remove `price,` from `getCatalogProducts` select (line 92):

```ts
    .select('id,title,slug,images,brand:brands(name),category:categories(name,slug,sort_order)')
```

Remove `price,` from `searchProducts` select (line 110):

```ts
  const { data } = await supabase.from('products').select('title,slug,images')
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: PASS. (TypeScript will flag any remaining consumer of `price`.)

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Checkpoint**

Confirm no live source file still references the price field: search `app`, `components`, `lib` for `price` — expected: zero matches (excluding `.superpowers/**` snapshots and `node_modules`).

---

### Task 4: Drop the `price` column from the database and SQL files

**Files:**
- Apply migration on the Supabase project `lekygyoeiviygjdqmvom` (via the Supabase MCP `apply_migration` tool, or `supabase` CLI).
- Modify: `supabase/schema.sql`
- Modify: `supabase/seed-tienda-tu-tienda99.sql`

**Interfaces:**
- Consumes: Tasks 1-3 shipped, so no code selects `price` anymore.
- Produces: `products` table without a `price` column.

- [ ] **Step 1: Apply the destructive migration**

Apply a migration named `drop_products_price` with:

```sql
alter table products drop column if exists price;
```

The `products(price)` index is dropped automatically with the column.
**This permanently deletes 312 price values.**

- [ ] **Step 2: Verify the column is gone**

Run this query against the project:

```sql
select column_name
from information_schema.columns
where table_name = 'products' and column_name = 'price';
```

Expected: zero rows.

- [ ] **Step 3: Update the schema file**

In `supabase/schema.sql`, remove line 56 (the column):

```sql
  price        numeric(10,2) not null check (price >= 0),
```

and remove line 127 (the index):

```sql
create index on products (price);
```

- [ ] **Step 4: Update the seed file**

In `supabase/seed-tienda-tu-tienda99.sql`:

Change line 505:

```sql
insert into products (title, slug, category_id, brand_id, images)
```

Remove the `0,` price value on line 508, so the select becomes:

```sql
select d.title,
       trim(both '-' from regexp_replace(lower(d.title), '[^a-z0-9]+', '-', 'g')),
       c.id, b.id,
       jsonb_build_array('https://lh3.googleusercontent.com/d/' || d.img_id)
```

Change line 514 to drop the price assignment:

```sql
  title = excluded.title,
```

- [ ] **Step 5: Final verification**

Run: `npm run test`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

With `npm run dev`, confirm the catalog, search, filters, product detail and customizer show no price, and a test Telegram order carries no amount.

- [ ] **Step 6: Checkpoint**

Record: DB column gone, no live source references `price`, all three checks green.
