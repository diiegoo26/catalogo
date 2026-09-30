# Design — Make catalog products browsable (equipaciones)

**Date:** 2026-09-29
**Status:** approved (verbal, via brainstorming session)
**Repo:** `C:\Users\corra\Desktop\catalogo` (Next.js 16 + Supabase, *not* a git repository — no commit step applies)

## Problem

All 286 products live in category `equipaciones`, but no route can display them:

1. `app/equipaciones/page.tsx` (static region selector) shadows `app/[categoria]/page.tsx` (the generic category listing with `ProductGrid` + `Filters`), so the listing page is unreachable for this category.
2. All 286 rows have `team_id = NULL` and `brand_id = NULL`, so `getProducts({ teamId })` / `getProducts({ brandId })` always return `[]` — the team page (país → liga → equipo) renders an empty `ProductGrid`.
3. The team page never renders `team.logo_url`, so no crest appears even though all 112 crests are now valid.

Net effect: products are reachable only through `/producto/<slug>` and the header search dropdown. `brand_id` linking is not viable (19 brands, only 2 products mention any of them).

## Decisions (user-confirmed)

| # | Decision | Choice |
|---|---|---|
| 1 | Where products live | Full product grid **below** the region selector on `/equipaciones` |
| 2 | Product ↔ team linkage | Yes — fuzzy matching + grid on team page with empty state |
| 3 | Extra scope | Fix missing team crest; lint + config cleanup |
| 4 | Listing presentation | Complete grid, no filters, no pagination |
| — | Explicitly out of scope | Homepage tiles for empty categories, populating `calzado`/`perfumes`/`bolsos`/`accesorios`, `product_variants` |

## Design

### 1. Routes and structure

No new routes, no redirects; existing public URLs stay unchanged.

**`app/equipaciones/page.tsx`** becomes two sections:

1. Region selector (unchanged): `<h1>Elige un país</h1>` + `CardGrid`.
2. New: `<h2 id="productos">Todos los productos</h2>` + `<ProductGrid>` fed by `getProducts({ categoryId })` for the `equipaciones` category. Order: `created_at` descending (already the `getProducts` default). No `Filters` sidebar.

Data access: reuse `getCategory('equipaciones')` + `getProducts({ categoryId })` from `lib/queries.ts`. No new query functions required.

**`app/equipaciones/[pais]/[liga]/[equipo]/page.tsx`** gains:

1. Team crest next to `<h1>`: `next/image` from `team.logo_url`, ~48 px, `alt={`${team.name} escudo`}`, hidden when `logo_url` is null.
2. The existing `getProducts({ teamId: team.id })` grid (already wired — it returns rows once data is linked).
3. Empty state when `products.length === 0`, rendered inline in the page: text "Este equipo aún no tiene productos propios." plus a link "Ver todos los productos" → `/equipaciones`.

`components/ProductGrid` stays untouched: its generic "No hay productos con estos filtros." message is correct for the category listing, and the team-specific empty state lives in the team page (simpler than adding props used once).

**Side effect:** `/producto/<slug>` already renders `product.team.*` in its detail payload, so linked products gain team/breadcrumb context for free.

### 2. Data migration: `link_products_to_teams`

Purpose: populate `public.products.team_id` where a single unambiguous team exists.

**Normalization** (applied to both product slugs and team slugs):

1. lowercase;
2. strip diacritics (NFD + remove combining marks);
3. product slug: drop leading kit-type prefixes `camiseta-`, `conjunto-deportivo-`, `conjunto-`, `short-`, `sudadera-`, `pantalon-`, `calcetin-`;
4. drop trailing season `-(19|20)\d{2}(-\d{2})?$`;
5. drop the trailing kit suffix `-nino` (after step 2, `niño` is already normalized to `nino`).

**Candidate matching**, in order, first rule that yields ≥1 candidate wins:

1. exact match on normalized slug;
2. explicit alias map (small, documented in the migration): e.g. `atletico-madrid → atletico-de-madrid`, `napoles → napoli`, `b-dort → borussia-dortmund`, `inter-milan → inter`;
3. match on normalized *team name* contained as a whole word in the product key (handles `sevilla-fc`, `real-betis`, `valencia-cf` slug variants).

**Uniqueness rule:** assign `team_id` only when exactly **one** team is produced. Zero candidates → leave `NULL`. Two or more candidates → leave `NULL` and record in the review report (avoids cross-league mis-assignment).

**Constraints:** idempotent (`WHERE team_id IS DISTINCT FROM` target, re-runnable), keyed by `uuid`, never modifies `teams`, `leagues`, or any slug.

**Expected coverage:** roughly 50-70% of 286. The remainder are clubs absent from the database (second divisions, other countries: Pumas, Flamengo, Inter Miami, Rangers, Benfica, …) and must stay `NULL`.

**Artifacts produced:** a migration in `supabase/migrations` (applied via MCP `supabase_apply_migration`) plus a review report listing per product: key, chosen team, match rule, or the reason it was left `NULL`.

### 3. Cleanup (approved scope)

1. `components/Filters.tsx:14` — `@typescript-eslint/no-unused-expressions`; same fix mirrored to the stale duplicate `catalogo/components/Filters.tsx:14` (ESLint lints both, hence doubled output).
2. `scripts/_gen.mjs:118` — remove or underscore the unused `regionsPresent`.
3. `next.config.ts` — remove `upload.wikimedia.org` from `images.remotePatterns` and drop `dangerouslyAllowSVG` + the `contentSecurityPolicy` workaround: no database image points there any more (verified: all 112 crests on footylogos, 6 flags on flagcdn, 286 photos on static.wixstatic.com) and no SVG is served.

Target state: `npm run lint` → **0 errors and 0 warnings**.

### 4. Verification

1. `npx tsc --noEmit`, `npm run lint`, `npm run build` — all pass, lint clean.
2. `npm start` on a free port; assert:
   - `/equipaciones` → 200, region cards + 286 product cards;
   - a team page that has linked products → 200, crest + product cards;
   - a team page without products → 200, crest + empty state + working link;
   - `/producto/<slug>` → 200, product image + (when linked) team context;
   - the four other category routes still behave as before.
3. Image sweep of every distinct URL found in the fetched HTML through `/_next/image` → expect all 200.
4. Grep server stdout **and** stderr for `upstream image response failed`, `Invalid src prop`, `hostname not configured`, ` 404`, ` 429`, ` 500` → expect zero (note: Next 16 logs nothing for unconfigured hosts — monitor `/_next/image` status codes too).
5. Post-migration SQL: linked count, duplicate-assignment check (one product never has two teams — trivially true), list of ambiguous/unmatched products for review.
6. Server process killed; nothing left listening.

### 5. Risks

| Risk | Mitigation |
|---|---|
| Wrong product→team link | Unique-candidate rule; alias map kept explicit and reviewable; report for manual inspection |
| `/equipaciones` page weight (286 cards) | `next/image` loads lazily; no pagination per approved scope |
| Removing wikimedia/SVG config breaks something | Verified no remaining reference; image sweep would fail immediately if so |
| Empty categories still reachable from homepage | Accepted — out of approved scope |

## Non-goals

- No new categories, no product import for `calzado`/`perfumes`/`bolsos`/`accesorios`.
- No changes to homepage tiles.
- No pagination, filters, or sorting UI on the new listing.
- No changes to league/team slugs or URLs.

---

## Scope change (user-approved during implementation)

While implementing, `supabase/relacionar-equipaciones.sql` was discovered in the repo: a prepared-but-**never-executed** script that expands the catalog structure (the database currently holds only 7 regions / 6 leagues / 112 teams, so most products' clubs simply do not exist in it). The user approved the **full structure + linkage** option. This supersedes the "match against the existing 112 teams" limitation above.

### What is added

1. **14 new regions** (Países Bajos, Brasil, México, Argentina, Uruguay, Chile, Colombia, Paraguay, Japón, Noruega, Grecia, Escocia, Serbia, Estados Unidos), each with a `flag_url` on `flagcdn.com`. Portugal already exists but has no league, so it gains one.
2. **20 new leagues** (Segunda División, Championship, 2. Bundesliga, Ligue 2, Serie B, Eredivisie, Serie A Brasil, Liga MX, Liga Profesional, three Primera División, Categoría Primera A, J1 League, Eliteserien, Super League, Scottish Premiership, SuperLiga, MLS, Liga Portugal), each with `logo_url` on footylogos.
3. **107 new teams**, each with a footylogos crest.

Canonical entity list: `kova-structures/entities.json` (outside the repo) → enriched by a research agent with verified URLs.

### Corrections applied to the legacy script

- **Removed duplicates that already exist** after the 2026-27 sync: `malaga`, `racing-santander`, `coventry-city`, `hull-city`, `ipswich-town`, `schalke-04`.
- **Removed stale targets** no longer in the database: `real-oviedo`, `rcd-mallorca`, `wolverhampton` (all deleted when moving to 2026-27), and the duplicate `birmingham` entry.
- **Dropped dead references** to `fc-porto`/`sl-benfica` without a Portugal region — replaced by an explicit **Liga Portugal** league + FC Porto, SL Benfica, Sporting CP, Sporting Braga.
- **Renamed slug-shaped names** to proper display names (`paises-bajos` → "Países Bajos"), and normalized the Scotland slug to `escocia`.
- **`olimpia`** placed in Paraguay (Olimpia Asunción), not Greece, where no such club exists.
- `newells-old-boys` slug replaces `old-boys` (alias handled in the matcher).

### Impact on the rest of the design

- New region/league/team pages are produced automatically by the existing `[pais]/[liga]/[equipo]` routes — no code changes beyond those already specified.
- The product↔team matcher now runs against ~219 teams, expected coverage ≈ 210/286.
- Verification now also covers: every new region flag, league logo, team crest (HTTP 200 + image content type), and every new region/league/team page returning 200.
