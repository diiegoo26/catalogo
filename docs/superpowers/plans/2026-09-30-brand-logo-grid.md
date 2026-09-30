# Brand-With-Logo Grid Across All Categories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every non-equipaciones category browses as `categoría → marcas con logo → modelos`, and every product carries a correct `brand_id` plus a real brand logo.

**Architecture:** Collapse the hardcoded `/calzado` brand drill-down into the generic `app/[categoria]/` and a new `app/[categoria]/[marca]/`, driven by a pure three-case rule over the category's brands. All decision logic (view mode, product counts, OCR text matching, pngwing candidate filtering) is extracted into dependency-free modules in `lib/` so it is unit-testable without Next.js or Supabase. Logos are downloaded to `public/brands/` (no runtime third-party dependency). Brand assignment for the 10 brand-less categories comes from ocr.space OCR of product photos, matched only against the known brand list.

**Tech Stack:** Next.js 16.3.6 (App Router, async `params`/`searchParams`), React 19.2.8, TypeScript 5, Tailwind CSS 4, `@supabase/supabase-js` 2.117, Node 20+ (native `fetch`/`FormData`), vitest (new devDependency).

## Global Constraints

- **Repo is not a git repository.** `git rev-parse` returns `fatal: not a git repository`. No commit steps exist in this plan. Do not attempt `git init` — that is a user decision.
- **No database credentials in this plan.** All SQL is written to files under `supabase/` and applied by the user. Never hardcode a Supabase URL or key.
- **Tech artifacts are English.** Spanish only for user-facing UI copy and comments already in Spanish in the codebase.
- **PostgREST limit:** `!inner` + `count` fails with `42803`. `products(count)` without `!inner` works and is aliased as `total:products(count)`.
- **Brand URLs are per-category.** `nike` exists in both `calzado` and `chandal`, so `/calzado/nike` and `/chandal/nike` must be distinct pages.
- **Pure logic lives in `lib/*.ts` with no `import { supabase }`.** Anything a vitest test imports must stay free of Next.js and Supabase imports.
- **Existing UI copy is Spanish and must not be translated.** `<h1>Elige una marca</h1>` etc.
- **Verification commands, all run from the repo root:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `node scripts/check-routes.mjs 3000`.
- **OCR requires a real free ocr.space key.** Register at `https://ocr.space/ocrapi` and pass it as `OCR_API_KEY`. The shared `helloworld` key is throttled with HTTP 503 `E551`. Phase 2 (Tasks 8–9) is blocked until this key exists.

---

## File Structure

**Pure logic — new, unit-tested, zero dependencies:**

| File | Responsibility |
|---|---|
| `lib/brand-view.ts` | `brandViewMode(count) → 'grid' \| 'single' \| 'none'`. The three-case rule. |
| `lib/brand-counts.ts` | `RawBrandRow` type + `withCounts(rows)` mapping PostgREST aggregates to `BrandWithCount`. |
| `lib/brand-match.ts` | `normaliseText(s)` + `matchBrand(text, known)` for OCR→brand matching. Longest-name-first. |
| `lib/logo-candidates.ts` | `isLikelyLogo(url)` + `pickCandidates(candidates, slug)` to filter pngwing noise. |

**I/O and rendering:**

| File | Responsibility |
|---|---|
| `lib/queries.ts` (modify) | `getBrandsByCategory` → count-based; add `getBrandInCategory`. |
| `lib/types.ts` (modify) | Add `BrandWithCount = Brand & { product_count: number }`. |
| `components/BrandHeader.tsx` (new) | Server component: brand logo + name + product count. |
| `components/Filters.tsx` (modify) | Drop the brand `<select>` and the `brands` prop. |
| `app/[categoria]/page.tsx` (modify) | Apply the three-case rule. |
| `app/[categoria]/[marca]/page.tsx` (new) | Generic brand page. |
| `app/calzado/page.tsx` (delete) | Shadowed the generic route. |
| `app/calzado/[marca]/page.tsx` (delete) | Hardcoded to `calzado`. |
| `app/producto/[slug]/page.tsx` (modify) | Drop the `=== 'calzado'` breadcrumb condition. |

**Scripts:**

| File | Responsibility |
|---|---|
| `scripts/fetch-brand-logos.mjs` | Search pngwing, emit `brands-logos.json` candidates. |
| `scripts/download-brand-logos.mjs` | Download chosen candidates to `public/brands/<slug>.png`. |
| `scripts/detect-brands-ocr.ts` | OCR the 231 brand-less products, emit `brands-detected.json`. |

**Data:**

| File | Responsibility |
|---|---|
| `supabase/2026-09-30-brands-logo-url.sql` | Set `brands.logo_url` to local paths. |
| `supabase/2026-09-30-brands-backfill.sql` | Backfill `products.brand_id` from the reviewed mapping. |

**Deleted:** `catalogo/` — stale duplicate tree (no `package.json`, no `node_modules`). `tsconfig.json` has `include: ["**/*.ts","**/*.tsx"]` with `exclude: ["node_modules"]` only, so `tsc` and `eslint` both walk it.

---

## Task 1: Test harness + the three-case rule

**Files:**
- Create: `package.json` (modify), `vitest.config.ts`, `tests/brand-view.test.ts`, `lib/brand-view.ts`
- Delete: `catalogo/` (entire directory)

**Interfaces:**
- Consumes: nothing.
- Produces: `lib/brand-view.ts` exporting `type BrandViewMode = 'grid' | 'single' | 'none'` and `brandViewMode(count: number): BrandViewMode`. Tasks 4 and 5 import both.

vitest is a new dependency. This is deliberate and bounded: the four modules in `lib/` above are the highest-risk logic in the change (a wrong view mode hides 500 products; a wrong OCR match assigns the wrong brand), and they are pure functions — the only place where a real test is cheaper than a manual check. Rendering and SQL stay verified by `tsc`/`lint`/route checks.

- [ ] **Step 1: Delete the stale `catalogo/` duplicate tree**

Run: `Remove-Item -LiteralPath "catalogo" -Recurse -Force`
Expected: directory gone. Confirm the root still has `package.json`, `tsconfig.json`, `node_modules`, `.next`.

- [ ] **Step 2: Install vitest and add the test script**

Run: `npm i -D vitest`
Then add to `package.json` scripts:
```json
"lint": "eslint",
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write the failing test `tests/brand-view.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { brandViewMode } from '../lib/brand-view';

describe('brandViewMode', () => {
  it('renders the brand grid when there are two or more brands', () => {
    expect(brandViewMode(2)).toBe('grid');
    expect(brandViewMode(15)).toBe('grid');
  });

  it('skips the grid when there is exactly one brand', () => {
    expect(brandViewMode(1)).toBe('single');
  });

  it('falls back to the flat grid when there are no brands', () => {
    expect(brandViewMode(0)).toBe('none');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../lib/brand-view"`.

- [ ] **Step 6: Write the minimal implementation `lib/brand-view.ts`**

```ts
/** Regla de los tres casos: rejilla de marcas, cabecera directa, o listado plano. */
export type BrandViewMode = 'grid' | 'single' | 'none';

export function brandViewMode(count: number): BrandViewMode {
  if (count === 0) return 'none';
  if (count === 1) return 'single';
  return 'grid';
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 3 tests.

- [ ] **Step 8: Verify the deletion did not break typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit 0. If it reports errors inside `catalogo/`, the directory was not fully deleted.

---

## Task 2: Count-based `getBrandsByCategory` + `BrandWithCount`

**Files:**
- Create: `lib/brand-counts.ts`, `tests/brand-counts.test.ts`
- Modify: `lib/types.ts`, `lib/queries.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `lib/types.ts`: `export type BrandWithCount = Brand & { product_count: number };`
  - `lib/brand-counts.ts`: `export type RawBrandRow = { id: string; name: string; slug: string; logo_url: string | null; total?: { count: number }[] | null };` and `export function withCounts(rows: RawBrandRow[]): BrandWithCount[];`
  - `lib/queries.ts`: `getBrandsByCategory(categoryId: string): Promise<BrandWithCount[]>` (return type changed) and `getBrandInCategory(brandSlug: string, categoryId: string): Promise<BrandWithCount | null>` (new).

Callers of `getBrandsByCategory`: `app/calzado/page.tsx` (deleted in Task 5) and `app/[categoria]/page.tsx`. Both are `Brand`-compatible consumers, so widening the return type does not break them.

- [ ] **Step 1: Write the failing test `tests/brand-counts.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { withCounts } from '../lib/brand-counts';

const row = (over: Partial<Parameters<typeof withCounts>[0][number]> = {}) => ({
  id: 'b1', name: 'Nike', slug: 'nike', logo_url: null, total: [{ count: 9 }], ...over,
});

describe('withCounts', () => {
  it('maps the PostgREST count aggregate onto product_count', () => {
    expect(withCounts([row()])).toEqual([
      { id: 'b1', name: 'Nike', slug: 'nike', logo_url: null, product_count: 9 },
    ]);
  });

  it('drops brands with zero products', () => {
    expect(withCounts([row({ total: [{ count: 0 }] }), row({ id: 'b2', slug: 'adidas', total: [{ count: 0 }] })])).toEqual([]);
  });

  it('treats a missing or empty aggregate as zero', () => {
    expect(withCounts([row({ total: undefined })])).toEqual([]);
    expect(withCounts([row({ total: [] })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../lib/brand-counts"`.

- [ ] **Step 3: Write the minimal implementation `lib/brand-counts.ts`**

```ts
import type { BrandWithCount } from './types';

/** Fila cruda de PostgREST: `total:products(count)` llega como array de un objeto. */
export type RawBrandRow = {
  id: string; name: string; slug: string; logo_url: string | null;
  total?: { count: number }[] | null;
};

/** Descarta las marcas sin productos y expone el total como numero plano. */
export function withCounts(rows: RawBrandRow[]): BrandWithCount[] {
  return rows
    .map((r) => ({
      id: r.id, name: r.name, slug: r.slug, logo_url: r.logo_url,
      product_count: r.total?.[0]?.count ?? 0,
    }))
    .filter((b) => b.product_count > 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 6 tests total.

- [ ] **Step 5: Add `BrandWithCount` to `lib/types.ts`**

Add directly after the existing `Brand` line:
```ts
export type BrandWithCount = Brand & { product_count: number };
```

- [ ] **Step 6: Add `inner_products` to `RawBrandRow`**

In `lib/brand-counts.ts`, extend the type so the cast in Step 7 is honest:
```ts
export type RawBrandRow = {
  id: string; name: string; slug: string; logo_url: string | null;
  total?: { count: number }[] | null;
  inner_products?: unknown[] | null;
};
```

- [ ] **Step 7: Rewrite `getBrandsByCategory` in `lib/queries.ts`**

Replace the existing function. `!inner` row filtering is kept — it is cheap and covered by `products(category_id, brand_id)` — and the count is derived from the rows PostgREST already returned. Those rows are exactly the `products(category_id)` payload the current code fetches and discards, so this adds no query cost while making the total available.

Do **not** use `total:products(count)` here: a bare `count` aggregate alongside `!inner` is rejected by PostgREST with `42803`, and dropping `!inner` would make the count span all categories instead of this one.

**The `inner_products` → `total` normalization must happen here, in the query, not as a fallback inside `withCounts`.** If `withCounts` gained a second branch reading `inner_products`, production would never execute the `total` branch that the Step 1 tests cover — the tests would be verifying a dead path and giving false confidence. Normalizing in the query keeps one input contract for `withCounts` and makes production run the exact code the tests exercise.

```ts
/** Marcas con al menos un producto en la categoria, con su total. */
export async function getBrandsByCategory(categoryId: string) {
  const { data } = await supabase
    .from('brands')
    .select('id,name,slug,logo_url,inner_products:products!inner(category_id)')
    .eq('inner_products.category_id', categoryId)
    .order('name');
  const rows = (data ?? []) as unknown as RawBrandRow[];
  return withCounts(withInnerProductTotals(rows));
}
```

`withInnerProductTotals` is a pure, separately tested function in `lib/brand-counts.ts`:
```ts
export function withInnerProductTotals(rows: RawBrandRow[]): RawBrandRow[] {
  return rows.map((r) => ({ ...r, total: [{ count: r.inner_products?.length ?? 0 }] }));
}
```

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

Run: `npm test`
Expected: PASS, 9 tests.

- [ ] **Step 8: Add `getBrandInCategory` to `lib/queries.ts`**

```ts
/** La marca solo resuelve si tiene productos en esa categoria; si no, notFound(). */
export async function getBrandInCategory(brandSlug: string, categoryId: string) {
  const all = await getBrandsByCategory(categoryId);
  return all.find((b) => b.slug === brandSlug) ?? null;
}
```

- [ ] **Step 9: Verify against the live database**

Run a one-off check in a scratch file, then delete it:
```ts
import { getBrandsByCategory, getCategories } from '@/lib/queries';
const cats = (await getCategories()).filter((c) => c.slug !== 'equipaciones');
for (const c of cats) {
  const b = await getBrandsByCategory(c.id);
  console.log(c.slug.padEnd(14), b.length, b.reduce((s, x) => s + x.product_count, 0));
}
```

Expected, measured against the live database on 2026-09-30:

| Category | Brands | Products | Note |
|---|---:|---:|---|
| `calzado` | 16 | 127 | |
| `accesorios` | 4 | 87 | 90 total; 3 products have `brand_id = null` |
| `chandal` | 5 | 44 | |
| the other 11 | 0 | 0 | no brand-linked products until Task 9's backfill |

An earlier draft of this plan claimed `calzado` was 15 brands and every other category was 0. Both were wrong and contradicted the spec, which already listed `accesorios` (87) and `chandal` (44) as having brand-linked products. Any category reporting brands it does not own means the `!inner` filter is wrong — fix before continuing.

---

## Task 3: `BrandHeader` component

**Files:**
- Create: `components/BrandHeader.tsx`

**Interfaces:**
- Consumes: `BrandWithCount` from `lib/types.ts` (Task 2).
- Produces: `export default function BrandHeader({ brand }: { brand: BrandWithCount })`. Used by Tasks 4 and 5.

No test: it is a pure presentational server component with no logic beyond a conditional. It is covered by `tsc`, `lint`, and the route checks in Tasks 4 and 6. This mirrors `CardGrid`, which is also untested in this repo.

- [ ] **Step 1: Create `components/BrandHeader.tsx`**

Mirrors the team-crumb block already in `app/equipaciones/[pais]/[liga]/[equipo]/page.tsx` (relative box + `object-contain` + 64 px), so branding looks identical across flows.
```tsx
import Image from 'next/image';
import type { BrandWithCount } from '@/lib/types';

/** Cabecera de marca: logo, nombre y numero de productos. */
export default function BrandHeader({ brand }: { brand: BrandWithCount }) {
  const n = brand.product_count;
  return (
    <div className="mb-8 flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
      <div className="relative size-16 shrink-0 rounded-xl border border-neutral-200 bg-white">
        {brand.logo_url ? (
          <Image src={brand.logo_url} alt={brand.name} fill sizes="64px" className="object-contain p-2" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-3xl font-semibold text-neutral-300">
            {brand.name[0]}
          </span>
        )}
      </div>
      <div>
        <h1 className="text-2xl font-bold">{brand.name}</h1>
        <p className="text-sm text-neutral-500">
          {n} producto{n === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

---

## Task 4: Generic brand page

**Files:**
- Create: `app/[categoria]/[marca]/page.tsx`

**Interfaces:**
- Consumes: `getCategory(slug)` and `getBrandInCategory(brandSlug, categoryId)` from `lib/queries.ts` (Task 2); `BrandHeader` (Task 3); `getProducts` (existing).
- Produces: the route `/[categoria]/[marca]` rendering 200 with a `BrandHeader` + `ProductGrid`, or 404.

- [ ] **Step 1: Create `app/[categoria]/[marca]/page.tsx`**

Next 16: `params` is a Promise.
```tsx
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import BrandHeader from '@/components/BrandHeader';
import { ProductGrid } from '@/components/ProductCard';
import { getBrandInCategory, getCategory, getProducts } from '@/lib/queries';

export async function generateMetadata({ params }: { params: Promise<{ categoria: string; marca: string }> }) {
  const { categoria, marca } = await params;
  return { title: `${marca} — ${categoria}` };
}

export default async function MarcaPage({
  params,
}: { params: Promise<{ categoria: string; marca: string }> }) {
  const { categoria, marca } = await params;
  const cat = await getCategory(categoria);
  if (!cat) notFound();

  const brand = await getBrandInCategory(marca, cat.id);
  if (!brand) notFound();

  const products = await getProducts({ categoryId: cat.id, brandId: brand.id });

  return (
    <>
      <Breadcrumbs items={[{ label: cat.name, href: `/${cat.slug}` }, { label: brand.name }]} />
      <BrandHeader brand={brand} />
      <ProductGrid products={products} />
    </>
  );
}
```

- [ ] **Step 2: Verify the route resolves in dev**

Run: `npm run dev`
Then, in a second shell: `node scripts/check-routes.mjs 3000`
Expected: `/calzado/nike` returns 200 and contains the Nike heading. `/calzado/zzzz` returns 404 — this proves `getBrandInCategory` rejects a brand that does not belong to the category.

---

## Task 5: Three-case category page + strip the brand filter

**Files:**
- Modify: `app/[categoria]/page.tsx`, `components/Filters.tsx`

**Interfaces:**
- Consumes: `brandViewMode` (Task 1), `BrandHeader` (Task 3), `getBrandsByCategory` returning `BrandWithCount[]` (Task 2).
- Produces: `/[categoria]` rendering the grid, the single-brand header, or the flat filtered grid.

- [ ] **Step 1: Rewrite `app/[categoria]/page.tsx`**

The brand `<select>` goes away because the grid supersedes it; `?gender=`, `?min=`, `?max=` survive and apply to the flat case.
```tsx
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import BrandHeader from '@/components/BrandHeader';
import CardGrid from '@/components/CardGrid';
import Filters from '@/components/Filters';
import { ProductGrid } from '@/components/ProductCard';
import { brandViewMode } from '@/lib/brand-view';
import { getBrandsByCategory, getCategory, getProducts } from '@/lib/queries';

type SP = { gender?: string; min?: string; max?: string };

export default async function CategoriaPage({
  params, searchParams,
}: { params: Promise<{ categoria: string }>; searchParams: Promise<SP> }) {
  const { categoria } = await params;
  const sp = await searchParams;

  const cat = await getCategory(categoria);
  if (!cat) notFound();

  const brands = await getBrandsByCategory(cat.id);
  const mode = brandViewMode(brands.length);

  const products =
    mode === 'grid'
      ? []
      : await getProducts({
          categoryId: cat.id,
          brandId: mode === 'single' ? brands[0].id : undefined,
          gender: sp.gender || undefined,
          min: sp.min ? Number(sp.min) : undefined,
          max: sp.max ? Number(sp.max) : undefined,
        });

  return (
    <>
      <Breadcrumbs items={[{ label: cat.name }]} />
      {mode === 'grid' && (
        <>
          <h1 className="mb-6 text-2xl font-bold">Elige una marca</h1>
          <CardGrid
            items={brands.map((b) => ({
              id: b.id, name: b.name, image: b.logo_url, href: `/${cat.slug}/${b.slug}`,
            }))}
          />
        </>
      )}
      {mode === 'single' && (
        <>
          <BrandHeader brand={brands[0]} />
          <ProductGrid products={products} />
        </>
      )}
      {mode === 'none' && (
        <>
          <h1 className="mb-6 text-2xl font-bold">{cat.name}</h1>
          <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
            <Filters />
            <ProductGrid products={products} />
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Drop the brand select from `components/Filters.tsx`**

Replace the `Props` type and delete the brand `<select>` block:
```tsx
/** Filtros por URL (?gender=&min=&max=) — compartibles y compatibles con SSR. */
export default function Filters() {
```
Delete this block:
```tsx
      <select className={field} defaultValue={sp.get('brand') ?? ''} onChange={(e) => set('brand', e.target.value)}>
        <option value="">Todas las marcas</option>
        {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
      </select>
```
Change the grid columns from four to three:
```tsx
    <aside className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-3 lg:mb-0 lg:grid-cols-1">
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no output, exit 0.

---

## Task 6: Remove the `calzado` shadow and generalize the breadcrumb

**Files:**
- Delete: `app/calzado/page.tsx`, `app/calzado/[marca]/page.tsx`
- Modify: `app/producto/[slug]/page.tsx:37-41`

**Interfaces:**
- Consumes: the generic route from Task 4.
- Produces: `/calzado` and `/calzado/[marca]` served by the dynamic route with identical URLs.

**Why the deletion is mandatory:** in the App Router a static segment wins over a dynamic one. While `app/calzado/page.tsx` exists, `app/[categoria]/page.tsx` can never serve `/calzado`, and every Task 5 change would be invisible on the most important category.

- [ ] **Step 1: Delete the two `calzado` route files**

Run: `Remove-Item -LiteralPath "app\calzado\page.tsx" -Force; Remove-Item -LiteralPath "app\calzado\[marca]" -Recurse -Force`
Expected: `app/calzado/` no longer exists.

- [ ] **Step 2: Generalize the breadcrumb in `app/producto/[slug]/page.tsx`**

Replace lines 37–41:
```tsx
  } else if (p.brand) {
    crumbs = [
      { label: p.category.name, href: `/${p.category.slug}` },
      { label: p.brand.name, href: `/${p.category.slug}/${p.brand.slug}` },
    ];
```
The `p.category.slug === 'calzado'` guard is removed. Safe by construction: if a product has a brand, that brand appears in its category's grid, so the target route exists and `getBrandInCategory` resolves it.

- [ ] **Step 3: Verify all routes**

Run: `npm run dev`, then `node scripts/check-routes.mjs 3000` and `node scripts/crawl-server.mjs 3000`
Expected: `/calzado` 200 showing "Elige una marca" with 16 tiles, now served by the dynamic `app/[categoria]/page.tsx` rather than the deleted static route; `/calzado/nike` 200 served by `app/[categoria]/[marca]/page.tsx`; `/chandal` 200; every other category 200 via the `none` case; `/producto/<a calzado slug>` 200 with a `Calzado / <Marca>` breadcrumb.

The decisive check is a **non-calzado** product: `/producto/<a chandal slug>` must render `Chándal / <Marca>` linking to `/chandal/<marca>`. That breadcrumb was impossible before this task, because `app/producto/[slug]/page.tsx` only built a brand crumb when `p.category.slug === 'calzado'`.

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no output, exit 0.

---

## Task 7: Logo pipeline

**Files:**
- Create: `lib/logo-candidates.ts`, `tests/logo-candidates.test.ts`, `scripts/fetch-brand-logos.mjs`, `scripts/download-brand-logos.mjs`, `supabase/2026-09-30-brands-logo-url.sql`

**Interfaces:**
- Consumes: `brands` rows with `slug` and `logo_url` (live DB), pngwing search pages.
- Produces: `brands-logos.json` (`{ [slug]: { candidates: string[], chosen?: string } }`), files under `public/brands/<slug>.png`, and `supabase/2026-09-30-brands-logo-url.sql`.

- [ ] **Step 1: Write the failing test `tests/logo-candidates.test.ts`**

pngwing search results are noisy — a query for "nike logo" returns a swoosh printed on a sneaker, an AI "wedding logo template", and wallpapers. This filter removes the obvious junk; the final choice is always the user's.
```ts
import { describe, it, expect } from 'vitest';
import { isLikelyLogo, pickCandidates } from '../lib/logo-candidates';

describe('isLikelyLogo', () => {
  it('accepts a plain png on the pngwing CDN', () => {
    expect(isLikelyLogo('https://w7.pngwing.com/pngs/nike-logo-png-abc.png')).toBe(true);
  });

  it('rejects non-png assets', () => {
    expect(isLikelyLogo('https://w7.pngwing.com/pngs/x.jpg')).toBe(false);
    expect(isLikelyLogo('https://example.com/logo')).toBe(false);
  });

  it('rejects templates, mockups and wallpapers', () => {
    for (const bad of ['wedding-logo-template.png', 'tshirt-mockup.png', 'hd-wallpaper.png', 'ai-logo-generated.png'])
      expect(isLikelyLogo(`https://w7.pngwing.com/pngs/${bad}`)).toBe(false);
  });
});

describe('pickCandidates', () => {
  it('keeps at most three, in source order', () => {
    const urls = [1, 2, 3, 4, 5].map((n) => `https://w7.pngwing.com/pngs/l${n}.png`);
    expect(pickCandidates(urls, 3)).toEqual(urls.slice(0, 3));
  });

  it('drops the rejected ones before slicing', () => {
    const urls = [
      'https://w7.pngwing.com/pngs/wedding-logo-template.png',
      'https://w7.pngwing.com/pngs/a.png',
      'https://w7.pngwing.com/pngs/b.png',
    ];
    expect(pickCandidates(urls, 3)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../lib/logo-candidates"`.

- [ ] **Step 3: Write the minimal implementation `lib/logo-candidates.ts`**

```ts
const REJECT = ['template', 'mockup', 'mock-up', 'wallpaper', 'ai-generated', '3d', 'wedding', 'invitation'];

export function isLikelyLogo(url: string): boolean {
  if (!url.endsWith('.png')) return false;
  if (!url.startsWith('https://w7.pngwing.com/')) return false;
  const name = url.slice(url.lastIndexOf('/') + 1).toLowerCase();
  return !REJECT.some((k) => name.includes(k));
}

export function pickCandidates(urls: string[], limit = 3): string[] {
  return urls.filter(isLikelyLogo).slice(0, limit);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 11 tests.

- [ ] **Step 5: Write `scripts/fetch-brand-logos.mjs`**

```js
#!/usr/bin/env node
// Descarga candidatos de logo desde pngwing.com. No decide: el usuario elige.
import { writeFile } from 'node:fs/promises';

const REJECT = ['template', 'mockup', 'mock-up', 'wallpaper', 'ai-generated', '3d', 'wedding', 'invitation'];
const isLikelyLogo = (u) => u.endsWith('.png') && u.startsWith('https://w7.pngwing.com/')
  && !REJECT.some((k) => u.slice(u.lastIndexOf('/') + 1).toLowerCase().includes(k));

const slugs = process.argv.slice(2);
if (!slugs.length) { console.error('uso: node scripts/fetch-brand-logos.mjs <slug> [...]'); process.exit(1); }

const out = {};
for (const slug of slugs) {
  const q = encodeURIComponent(slug.replace(/-/g, ' ') + ' logo');
  const res = await fetch(`https://www.pngwing.com/es/search?q=${q}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (catalog-logo-fetcher)' },
  });
  const html = await res.text();
  const urls = [...html.matchAll(/<link[^>]+itemprop=["']contentUrl["'][^>]+href=["']([^"']+)["']/g)]
    .map((m) => m[1].replace(/^http:/, 'https:'));
  const seen = new Set();
  const candidates = urls.filter((u) => isLikelyLogo(u) && !seen.has(u) && seen.add(u)).slice(0, 3);
  out[slug] = { candidates };
  console.log(slug.padEnd(18), candidates.length, 'candidatos');
  await new Promise((r) => setTimeout(r, 1500));
}
await writeFile('brands-logos.json', JSON.stringify(out, null, 2) + '\n');
console.log('\n-> brands-logos.json');
```

- [ ] **Step 6: Run the fetcher for the brands that have products**

Run: `node scripts/fetch-brand-logos.mjs nike adidas jordan chanel gucci cartier hublot rolex richard-mille louis-vuitton lacoste under-armour armani yohji-yamamoto versace guess diesel tommy-hilfiger michael-kors valentino`

Expected: a line per brand and `brands-logos.json` written. A brand reporting `0 candidatos` needs a different query — retry that one slug with a variant (`<brand> marca`, `<brand> logo png`) and merge by hand.

- [ ] **Step 7: Show the candidates to the user and record the picks**

Nothing in this environment can view an image — neither the orchestrator nor a subagent (`Cannot read image (this model does not support image input)`), and `opencode.json` sets no per-agent `model`. So this step is the user's. Render the candidates grouped by brand (a local HTML file, or the raw URLs) and ask which one is correct. Write the answer into `brands-logos.json` as `chosen` for each brand. Do not guess, and do not auto-pick the first result.

- [ ] **Step 8: Write `scripts/download-brand-logos.mjs`**

```js
#!/usr/bin/env node
// Descarga los candidatos elegidos a public/brands/<slug>.png
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('brands-logos.json', 'utf8'));
await mkdir('public/brands', { recursive: true });

for (const [slug, entry] of Object.entries(manifest)) {
  const url = entry.chosen ?? entry.candidates?.[0];
  if (!url) { console.log(slug.padEnd(18), 'SIN CANDIDATO — descartado'); continue; }
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (catalog-logo-fetcher)' } });
  if (!res.ok) { console.log(slug.padEnd(18), `HTTP ${res.status} — descartado`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(`public/brands/${slug}.png`, buf);
  console.log(slug.padEnd(18), `${(buf.length / 1024).toFixed(0)} KB`);
  await new Promise((r) => setTimeout(r, 800));
}
```

- [ ] **Step 9: Write `supabase/2026-09-30-brands-logo-url.sql`**

```sql
-- Rutas locales de los logos descargados. Columna text: reversible.
update brands set logo_url = '/brands/' || slug || '.png'
where logo_url is null;
```
Add one explicit `update brands set logo_url = '/brands/nike.png' where slug = 'nike';` line per brand that was actually downloaded and verified, and one `set logo_url = null` for any brand discarded in Step 8. The user applies this file.

- [ ] **Step 10: Verify**

Run: `Get-ChildItem public\brands | Measure-Object` then `npx tsc --noEmit`
Expected: one `.png` per verified brand. Then `npm run dev` and open `/calzado` — tiles show real logos instead of first letters.

---

## Task 8: OCR brand detection

**Files:**
- Create: `lib/brand-match.ts`, `tests/brand-match.test.ts`, `scripts/detect-brands-ocr.ts`

**Interfaces:**
- Consumes: `OCR_API_KEY` env var; the 231 products with `brand_id IS NULL` outside `equipaciones`; `images[0]` for each.
- Produces: `brands-detected.json` — `Array<{ product_slug: string; brand_slug: string | null; raw_text: string }>`.

**Blocked until the user supplies a real free ocr.space key** (`https://ocr.space/ocrapi`). The shared `helloworld` key returns HTTP 503 `E551: Free OCR API overloaded`.

Written in TypeScript, not Python, so the matcher is unit-testable with the same vitest runner as everything else. Node 20 native `fetch` + `FormData` + `Blob` handle the multipart upload.

- [ ] **Step 1: Write the failing test `tests/brand-match.test.ts`**

The rule that keeps this honest: only the known brand list may match. OCR of a watch dial can produce a real brand nobody has listed; that must return `null`, not a guess.
```ts
import { describe, it, expect } from 'vitest';
import { matchBrand, normaliseText } from '../lib/brand-match';

const known = [
  { slug: 'nike', name: 'Nike' },
  { slug: 'richard-mille', name: 'Richard Mille' },
  { slug: 'rolex', name: 'Rolex' },
];

describe('normaliseText', () => {
  it('lowercases and strips punctuation', () => {
    expect(normaliseText('904L / ELEANO')).toBe('904l eleano');
  });
});

describe('matchBrand', () => {
  it('matches a brand name found in the OCR text', () => {
    expect(matchBrand('YOUR ROLEX OYSTER MANUEL DE GARANTIE ROLEX', known)).toBe('rolex');
  });

  it('is case and punctuation insensitive', () => {
    expect(matchBrand('relex? no: RICHARD-MILLE', known)).toBe('richard-mille');
  });

  it('prefers the longest matching brand name', () => {
    expect(matchBrand('richard mille', known)).toBe('richard-mille');
  });

  it('returns null for a name that is not in the known list', () => {
    expect(matchBrand('904L ELEANO', known)).toBeNull();
  });

  it('returns null for empty or unreadable text', () => {
    expect(matchBrand('', known)).toBeNull();
    expect(matchBrand('   ', known)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../lib/brand-match"`.

- [ ] **Step 3: Write the minimal implementation `lib/brand-match.ts`**

```ts
export function normaliseText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Busca una marca conocida en el texto del OCR. Solo puede devolver marcas de
 * `known`: un nombre desconocido devuelve null, nunca un intento de adivinar.
 */
export function matchBrand(text: string, known: { slug: string; name: string }[]): string | null {
  const hay = ` ${normaliseText(text)} `;
  if (!hay.trim()) return null;

  const sorted = [...known].sort((a, b) => b.name.length - a.name.length);
  for (const b of sorted) {
    const needle = normaliseText(b.name);
    if (needle && hay.includes(` ${needle} `)) return b.slug;
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 16 tests.

- [ ] **Step 5: Write `scripts/detect-brands-ocr.ts`**

```ts
#!/usr/bin/env node -e
/**
 * OCR de las fotos de los productos sin marca. Solo puede asignar marcas que ya
 * existen en `brands`; lo demas queda en null y se revisa a mano.
 */
import { writeFile } from 'node:fs/promises';
import { matchBrand, normaliseText } from '../lib/brand-match';
import { supabase } from '../lib/supabase';

const API_KEY = process.env.OCR_API_KEY;
if (!API_KEY) {
  console.error('Falta OCR_API_KEY. Registrate gratis en https://ocr.space/ocrapi');
  process.exit(1);
}
const DELAY_MS = 15_000;

const { data: brands } = await supabase.from('brands').select('slug,name');
const known = brands ?? [];

const { data: products } = await supabase
  .from('products')
  .select('slug,title,images,category:categories!inner(slug)')
  .is('brand_id', null)
  .neq('category.slug', 'equipaciones');

const rows: { product_slug: string; brand_slug: string | null; raw_text: string }[] = [];

for (const [i, p] of (products ?? []).entries()) {
  const url = (p.images as string[] | null)?.[0];
  if (!url) { rows.push({ product_slug: p.slug, brand_slug: null, raw_text: '' }); continue; }

  try {
    const img = await (await fetch(url)).blob();
    const form = new FormData();
    form.append('apikey', API_KEY);
    form.append('language', 'eng');
    form.append('isOverlayRequired', 'false');
    form.append('OCREngine', '2');
    form.append('scale', 'true');
    form.append('file', img, `${p.slug}.jpg`);

    const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form });
    const json = (await res.json()) as { ParsedResults?: { ParsedText?: string }[]; ErrorMessage?: string };
    if (!res.ok) throw new Error(json.ErrorMessage ?? `HTTP ${res.status}`);

    const text = normaliseText(json.ParsedResults?.[0]?.ParsedText ?? '');
    const slug = matchBrand(text, known);
    rows.push({ product_slug: p.slug, brand_slug: slug, raw_text: text });
    console.log(`[${i + 1}/${products!.length}] ${p.slug.padEnd(22)} ${slug ?? '(sin marca)'}  ${text.slice(0, 60)}`);
  } catch (e) {
    console.log(`[${i + 1}/${products!.length}] ${p.slug.padEnd(22)} ERROR ${(e as Error).message}`);
    rows.push({ product_slug: p.slug, brand_slug: null, raw_text: '' });
  }

  await new Promise((r) => setTimeout(r, DELAY_MS));
}

await writeFile('brands-detected.json', JSON.stringify(rows, null, 2) + '\n');
const matched = rows.filter((r) => r.brand_slug).length;
console.log(`\n${matched} de ${rows.length} con marca reconocida. Revisa las candidatas sin matchear.`);
```

- [ ] **Step 6: Run it**

Run: `$env:OCR_API_KEY = "<tu key>"; node --experimental-strip-types scripts/detect-brands-ocr.ts`
Expected: one line per product, ~15 s apart, roughly one hour for 231 products, and `brands-detected.json` written. On HTTP 503 the run is throttled — wait and resume; already-processed rows are skipped on restart by filtering `brand_id IS NULL` again after each accepted row, or simply re-run and keep the newer result.

- [ ] **Step 7: Review unmatched candidates with the user**

List every row where `brand_slug` is `null` but `raw_text` is non-empty, as `slug | raw_text`. Worked example already seen: `cronos-01.jpg` → `"904l eleano"`; `ELEANO` is not in the brand list, so it gets **no** brand. For each, the user chooses: map to an existing brand, promote to a new brand row, or dismiss. Only the first two enter the mapping.

---

## Task 9: Backfill `products.brand_id`

**Files:**
- Create: `supabase/2026-09-30-brands-backfill.sql`

**Interfaces:**
- Consumes: `brands-detected.json` from Task 8, reviewed in Step 7.
- Produces: linked products, so `getBrandsByCategory` returns real grids for the 10 previously brand-less categories.

**Why not the slug prefix.** `split_part(slug, '-', 1)` recovers the *obfuscated* name (`vantor`, `nordik`, `playa`…), and all 12 prefixes are synthetic — a prefix-based `update … from brands` matches **zero rows** and reports success. The obfuscated prefix records the artifact, not the product. The photo is the only real evidence.

- [ ] **Step 1: Generate the mapping SQL from the reviewed JSON**

Create `supabase/2026-09-30-brands-backfill.sql` with this shape, one `update` per category so the report is readable:
```sql
-- Backfill de products.brand_id a partir de brands-detected.json (OCR revisado).
-- El prefijo del slug NO sirve: los 12 prefijos son nombres ofuscados sinteticos.
begin;

update products p
set brand_id = b.id
from (values
  ('<product-slug-1>', '<brand-slug>'),
  ('<product-slug-2>', '<brand-slug>')
) as d(product_slug, brand_slug)
join brands b on b.slug = d.brand_slug
where p.slug = d.product_slug
  and p.brand_id is null;

commit;
```
The `where p.brand_id is null` guard makes re-runs no-ops.

- [ ] **Step 2: Optionally create brands the user promoted**

For each candidate promoted to a new brand, add:
```sql
insert into brands (name, slug, logo_url) values ('<Nombre>', '<slug>', null)
on conflict (slug) do nothing;
```

- [ ] **Step 3: The user applies the file, then verify**

Run these assertions:
```sql
select count(*) filter (where brand_id is null) as sin_marca,
       count(*) as total
from products p
join categories c on c.id = p.category_id
where c.slug <> 'equipaciones';
```
Expected: `sin_marca` drops from 231 to only the dismissed candidates.

```sql
select c.slug, count(distinct p.brand_id) as marcas, count(p.id) as productos
from products p join categories c on c.id = p.category_id
where p.brand_id is not null and c.slug <> 'equipaciones'
group by c.slug order by c.slug;
```
Expected: every category with a non-zero product count now has ≥ 1 brand, unless all of its candidates were dismissed.

- [ ] **Step 4: Verify in the app**

Run: `npx tsc --noEmit`, `npm run lint`, `npm test`
Expected: no output for the first two; 16 passing for the third.

Run: `npm run dev`, then `node scripts/check-routes.mjs 3000`
Expected: `/relojes`, `/packs`, `/gorras`, `/camisetas`, `/bolsos`, `/pantalones`, `/chanclas`, `/chaquetas`, `/conjuntos`, `/selecciones` each return 200 — either with a brand grid (≥ 2 brands) or with products directly (1 brand) or the flat grid (0 brands). Spot-check two `/[categoria]/[marca]` URLs by hand.

---

## Self-Review

**Spec coverage.** §1 routes → Tasks 4, 6. §2 three-case rule → Task 1 + Task 5. §3 components → Task 3 (`BrandHeader`), Task 5 (`Filters`), `CardGrid` untouched as specified. §4 queries → Task 2. §5 breadcrumb → Task 6 Step 2. §6 migrations → Tasks 7 Step 9, 9. §7 logo pipeline → Task 7. §8 OCR → Task 8. §9 housekeeping (`catalogo/` deletion) → Task 1 Step 1. §10 verification → every task's final step.

**Known gap, deliberate.** The spec's §7 browser gallery is implemented in Task 7 Step 7 as "render the candidates and ask the user" rather than as a bespoke HTML gallery app. The spec's own reasoning establishes that no agent here can view images, so the gallery's only consumer is the user; the skill's stated trigger ("if the user has to see it") is satisfied by showing the candidates directly.

**Type consistency.** `BrandWithCount` (Task 2) is consumed by `BrandHeader` (Task 3), `getBrandInCategory` (Task 2), and `app/[categoria]/page.tsx` (Task 5). `brandViewMode` returns exactly `'grid' | 'single' | 'none'`, and Task 5 branches on those three literals. `matchBrand(text, known)` takes `{ slug, name }[]` and the Task 8 caller passes the `brands` select result, which has exactly those columns. `withCounts` consumes `RawBrandRow[]` and produces `BrandWithCount[]`, matching its declared return.

**Corrections made during self-review.**
- Task 2 originally wrote a plain `total:products(count)` select with a JS filter, which cannot correlate a count with a specific category — the count would be over all products for that brand. Step 7 replaces it with `!inner` on a sibling resource plus a count derived from the returned rows, which is correct and keeps using the data the old code fetched and threw away.
- Task 5 originally kept a `Filters brands={[]}` call; `Filters` no longer takes props, so it is called bare.
