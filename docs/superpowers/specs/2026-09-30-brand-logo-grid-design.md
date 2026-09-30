# Design — Brand-with-logo grid across all categories

**Date:** 2026-09-30
**Status:** approved (via brainstorming session)
**Repo:** `C:\Users\corra\Desktop\catalogo` (Next.js 16 + Supabase, *not* a git repository — no commit step applies)

## Problem

The user wants every category browsable the same way `equipaciones` is: an entity grid with images (logos), and pressing one opens its models. Today only `calzado` does this, and only nominally.

### Current state

| Fact | Evidence |
|---|---|
| The brand→models drill-down lives in `app/calzado/page.tsx`, **not** `app/equipaciones/page.tsx` | Equipaciones uses `CardGrid` for *regions* (flags) → leagues → teams. Calzado uses `CardGrid` for *brands* (`logo_url`) → `/calzado/[slug]` → `ProductGrid` |
| `app/calzado/[marca]/page.tsx` hardcodes `getCategory('calzado')` | The precedent is not reusable by any other category |
| **`brands.logo_url` is `NULL` for all 39 brands (0% fill)** | Verified 3 ways: `is not null → 0`, `<> '' → 0`, per-row parse → all NULL |
| Therefore `/calzado` renders 15 first-letter tiles, not logos | `CardGrid` falls back to `{i.name[0]}` when `image` is falsy |
| **517 of 775 products have `brand_id IS NULL`** | Only `calzado` (127), `accesorios` (87) and `chandal` (44) have brand-linked products |
| The other 10 generic categories have **zero** brand-linked products | `conjuntos` 43, `packs` 56, `gorras` 29, `relojes` 31, `camisetas` 16, `bolsos` 16, `pantalones` 14, `chanclas` 12, `chaquetas` 9, `selecciones` 2 — all NULL |

The UI plumbing for brand logos already exists and is correct. Only the data is missing, and only one category uses it.

### Root cause of the 517 NULL brands

`supabase/seed-tienda-tu-tienda99.sql:512` linked products with an INNER join on misspelled slugs:

```sql
join brands b on b.slug = d.brand_slug
```

The seed inserted brands as `air-forze`, `nyke`, `dyor`, `jordam`, `new-balancio`, `vantor`, `nordik`, `playa`… The live `brands` table has since been corrected to real names (`nike`, `dior`, `jordan`, `new-balance`, …) and never contained `vantor`/`nordik`/`playa`/`marvella`. Every unmatched `brand_slug` silently produced `brand_id = NULL`.

**The original brand is recoverable from `products.slug`** — `split_part(slug, '-', 1)`:

| slug | → brand slug |
|---|---|
| `marvella-01` | `marvella` |
| `vantor-01` | `vantor` |
| `playa-01` | `playa` |

### The 12 obfuscated brands are synthetic, not real

The user's Google Drive listing proves there is no real brand behind them. Only three category folders have brand subfolders:

| Drive folder | Brand subfolders | DB category |
|---|---:|---|
| `Zapatillas` | 16 (`Nike DN` + `Nike react` → `nike`; `Luis vitoun` → `louis-vuitton`) | `calzado` |
| `Accesorios` | 5 (`Cartier`, `Hublot`, `Richard miller`, `Rolex`, `muchila`, `No hay`) | `accesorios` |
| `Chandal invierno` | 5 (`EA7 armani`, `Lacoste`, `Nike`, `Under armour`, `Yamaha`) | `chandal` |

The other ten have **no brand subfolder at all**:

```
Bolsos y riñoneras 16   Camiseta 16          chanclas 12       Chaquetas 9
Conjunto verano 43      España 2             Gorras 29          Pack ofertas 56
Pantalones largos/c. 14 Relojes Alta gama 31
```

Corroborating evidence: `Accesorios/No hay` (2 products) and `Accesorios/muchila` (1) exactly match the 3 NULL-brand accessories products.

These names were invented by `~/Desktop/ofuscar_catalogo.py` — one synthetic name per category — purely to make each row's name unique. There is no obfuscated→real mapping to recover.

### Decisions (user-confirmed)

| # | Decision | Choice |
|---|---|---|
| 1 | Fix the data too? | **Yes** — backfill `brand_id` so the grid is not empty |
| 2 | Brands for the 10 no-brand categories | **Assign default brands** (user opted in knowingly, after the fabrication risk was stated) |
| 3 | Logo source | **pngwing.com** (`https://www.pngwing.com/es`) |
| 4 | Logo hosting | **Download to `public/brands/*.png`** (no `next.config.ts` change, no runtime third-party dependency) |
| 5 | Overall design | **Approved as presented** |

### Environment constraints (established by test, not assumption)

| Constraint | Evidence |
|---|---|
| **No vision anywhere.** Logo QA and photo-based brand ID cannot be automated here | Both the orchestrator and the `general` sub-agent return `Cannot read image (this model does not support image input)`. `opencode.json` sets no per-agent `model`. ⇒ the user must pick logos visually |
| **OCR works and is the vision substitute.** ocr.space reads brand text off product photos | `POST https://api.ocr.space/parse/image` multipart, `apikey`, `OCREngine=2`, `scale=true`. Proven: `cronos-03.jpg` → `"YOUR ROLEX OYSTER / ROLEX / WORLD-WIDE SERVICE CENTERS"`; `cronos-01.jpg` → `"904L / ELEANO"` |
| The shared `helloworld` OCR key is hard throttled | HTTP 503 `E551: Free OCR API overloaded`. Needs a real free key from `https://ocr.space/ocrapi` plus ~15 s spacing |
| pngwing full-size URLs live on a non-obvious host | `<link itemprop="contentUrl" href="https://w7.pngwing.com/pngs/…png">` — host is **`w7.pngwing.com`**, not `www.pngwing.com` |
| pngwing search quality is poor | Searching "nike logo" returns a swoosh on a sneaker, an AI "wedding logo template", "nike sb", wallpapers. Human vetting per brand is mandatory |
| `!inner` + `count` is unsupported by PostgREST | `42803: column "products_1.category_id" must appear in the GROUP BY clause`. `products(count)` alone works, aliased as `total:products(count)` |
| Brand URLs must be per-category | `nike` is in `calzado` (9) and `chandal` (20) → `/calzado/nike` and `/chandal/nike` are different pages |
| `catalogo/` at the repo root is a stale duplicate | Only `app/ components/ lib/ supabase/`; no `package.json`, `tsconfig.json`, `node_modules` or `.env.local`. Root is live: `tsconfig.json` maps `@/* → ./*`, and `.next` build output contains no `catalogo/` routes. `eslint` and `tsc` still traverse it |
| No test framework | No jest/vitest/playwright/cypress; verification is manual via `scripts/check-routes.mjs` and `scripts/crawl-server.mjs` |

## Design

### 1. Routes — unify on the generic segments

```
app/[categoria]/page.tsx           → 13 categories (calzado included)
app/[categoria]/[marca]/page.tsx   → brand → its models
app/equipaciones/**                → unchanged (country → league → team → models)
```

**Delete** `app/calzado/page.tsx` and `app/calzado/[marca]/page.tsx`. This deletion is mandatory, not cosmetic: a static segment takes priority over a dynamic one, so while `app/calzado/` exists the generic route can never serve `/calzado`.

Existing public URLs stay valid — `/calzado/nike` keeps working, now served by the generic route with identical behaviour.

### 2. The three-case rule

Let `brands` = brands with at least one product in the category (the existing `getBrandsByCategory` inner-join semantics).

| Case | Rendering |
|---|---|
| **≥ 2 brands** | `<h1>Elige una marca</h1>` + `CardGrid` of brand logos → click → `/[categoria]/[marca]` |
| **exactly 1 brand** | `BrandHeader` (logo + name + product count) directly above `ProductGrid`. No intermediate click — a one-tile grid is a pointless extra step |
| **0 brands** | Unchanged: `Filters` sidebar + flat `ProductGrid` |

The rule degrades gracefully: categories whose brands cannot be determined fall through to today's behaviour with no special-casing.

### 3. Components

**`components/CardGrid.tsx` — unchanged.** It already renders the logo with `object-contain p-6`, the first-letter fallback, and the hover treatment. Reusing it is the whole point: `equipaciones` and `calzado` already share it.

**`components/BrandHeader.tsx` — new, server component, ~20 lines.** Logo (via `logo_url`, letter fallback when null) + brand name + product count. Used by the one-brand case and as the heading of the brand page. Mirrors the existing team-crumb block in `app/equipaciones/[pais]/[liga]/[equipo]/page.tsx`, which uses the same `relative` box + `object-contain` + 64 px pattern.

**`components/Filters.tsx` — drop the brand `<select>`.** When the grid is present it is redundant with the same data; leaving it invites the user to filter by brand on a page that is already inside one brand. `género` and `min`/`max` stay. `Props.brands` disappears, along with the `logo_url`-dropping type that motivated widening it.

### 4. Queries — `lib/queries.ts`

**`getBrandsByCategory(categoryId)` — revised.** Today it hydrates a `products` array of `{category_id}` that nothing ever reads — wasted payload (127 rows on `/calzado`). Replace with a count:

```ts
select = 'id,name,slug,logo_url,total:products(count)'   // no !inner
// filter total > 0 in JS — !inner + count is a PostgREST 42803 error
```

Index `products(category_id, brand_id)` already covers this. Returns the existing `Brand[]` shape plus an optional `product_count`, so `CardGrid` needs no change to stay compatible.

**`getBrandInCategory(brandSlug, categoryId)` — new.** Resolves the brand *only if it has at least one product in that category*, otherwise `null` → `notFound()`. This is what guarantees a brand breadcrumb never leads to a 404.

**`getProducts({ categoryId, brandId })` — unchanged.** Already indexed by `products(category_id, brand_id)`.

**`getProductBySlug` — unchanged.** Already selects `brand:brands(name,slug)`.

### 5. Product-detail breadcrumb

`app/producto/[slug]/page.tsx:37` builds the brand crumb only when `p.category.slug === 'calzado'`:

```ts
} else if (p.brand && p.category.slug === 'calzado') {
```

Remove the category condition, so any product with a brand yields `Categoría / Marca`. Safe by construction: if a product has a brand, that brand is in its category's grid, so the target route exists.

### 6. Data migrations

Three idempotent SQL files under `supabase/`, following the naming of the existing ones.

**a. Create brands that do not exist yet.** `on conflict (slug) do nothing`. Only rows the user has approved (see §8) — typically none, because OCR matches against the existing brand list first. Never renames or deletes an existing brand row.

**b. Backfill `products.brand_id`.** Driven by the reviewed `brands-detected.json` from §8, **not** by the slug prefix.

> **Why not the slug prefix.** `split_part(slug,'-',1)` was the obvious recovery key and it was verified to recover the *obfuscated* name. But every one of the 12 prefixes is synthetic and matches no existing brand row — a prefix-based `update … from brands` would match **zero rows** and silently accomplish nothing. The obfuscated prefix is a record of the artifact, not of the product. The real evidence is the product photo.

```sql
-- from an explicit mapping table, not from string parsing
update products p
set brand_id = b.id
from detection d
join brands b on b.slug = d.brand_slug
where p.slug = d.product_slug
  and p.brand_id is null;
```

In a transaction, with a `where brand_id is null` guard and a row-count report per category. The guard makes re-runs no-ops. Products absent from the mapping are left `NULL` on purpose — they land in the 0-brands case.

**c. Fill `brands.logo_url`** with the local path `/brands/<slug>.png` for each downloaded file. The column is `text`, so local paths and remote URLs are interchangeable and this step is reversible.

### 7. Logo pipeline

**`scripts/fetch-brand-logos.mjs`** — for each brand: request `https://www.pngwing.com/es/search?q=<brand>+logo`, parse every `link[itemprop="contentUrl"]`, and collect the top candidates with their reported dimensions. Output: `brands-logos.json` with 2–3 candidates per brand.

**Browser gallery** — because nothing in this environment can see an image, the script does *not* pick. It renders a local gallery of every candidate grouped by brand; the user marks the good one. The picks are written back into `brands-logos.json` as `chosen`. This is the step that cannot be automated.

**`scripts/download-brand-logos.mjs`** — downloads each `chosen` URL to `public/brands/<slug>.png`. Sequential, with a `User-Agent` header and a polite delay.

`next.config.ts` needs no change: files under `public/` are served from the same origin. If hotlinking is preferred instead, the single alternative is adding `{ protocol: 'https', hostname: 'w7.pngwing.com' }` to `images.remotePatterns`.

### 8. Determining brands for the 10 no-brand categories

Requires a real free ocr.space API key (the user registers at `https://ocr.space/ocrapi`).

**`scripts/detect-brands-ocr.py`** — for each of the 231 NULL-brand products: download `images[0]`, POST to `https://api.ocr.space/parse/image` (`OCREngine=2`, `scale=true`), take the parsed text, and match it against the 39 known brand names (case-insensitive, normalised, longest-name-first so `richard-mille` wins over a bare `mille` substring). Writes `brands-detected.json` with `{product_slug, matched_brand | null, raw_text}`.

Deliberately conservative:
- Matching is against the **known** brand list only, so a normal pass can never invent a brand.
- No OCR, or OCR text matching no known brand ⇒ no assignment. The product stays `NULL` and its category falls to the 0-brands case.
- A worked example: `cronos-01.jpg` OCRs to `"904L / ELEANO"`. `ELEANO` is not in the brand list, so that product gets **no** brand. It is recorded in the report as an unmatched candidate, not silently guessed at.

**Unmatched-candidate review.** Rows whose OCR text is non-empty but matches no known brand are surfaced for the user as a short list — `slug | raw_text`. Each can be (i) mapped to an existing brand, (ii) promoted to a new brand row via migration (a), or (iii) dismissed. Only (i) and (ii) reach `brands-detected.json`; (iii) stays `NULL`. This is the second step that cannot be automated, and it is bounded — it only appears for products whose dial actually carries a readable name.

~231 images at ~15 s spacing ≈ 1 hour, well inside the 25 000 requests/month free quota. The `raw_text` field is kept so every decision is auditable.

### 9. Housekeeping

**Delete `catalogo/`** — the stale duplicate. It is unreferenced by the build, and while it exists `tsc --noEmit` and `npm run lint` report against dead files (a previous spec recorded a duplicate `Filters.tsx:14` warning caused exactly by this).

### 10. Verification

No test framework exists, so verification is explicit:

1. `npx tsc --noEmit` and `npm run lint` — both clean today; must stay clean.
2. After each migration, SQL assertions: per-category brand counts; zero `brand_id IS NULL` where a prefix matched; `logo_url` non-null for every brand with ≥ 1 product.
3. `npm run dev`, then `node scripts/check-routes.mjs 3000` and `node scripts/crawl-server.mjs 3000` — every category route returns 200; a sample of `/[categoria]/[marca]` routes returns 200 with a non-empty `ProductGrid`.
4. Manual check of the three cases: a ≥2-brand category (grid renders), the one-brand case if any arises, and a 0-brand category (falls back).

### Out of scope

- `equipaciones` — its axis is country → league → team, not brand. 286 products, `brand_id` all NULL, 15 orphaned real kit brands (adidas, puma, umbro, kappa…) suggest an intended linkage, but that is a separate change.
- `perfumes` — 0 products.
- Deleting the 15 orphan brands with 0 products.
- Prices — 489 of 775 products are `price = 0` and `ProductCard` hides the price for them.
- Gender filters — `gender` is NULL for all 489 non-kit products, so `hombre`/`mujer` currently match zero rows. The controls stay; the data gap is unrelated to this change.