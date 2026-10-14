# Sección de invierno — KOVA ZONE

Branch: `feat/seccion-invierno` (stacked after `feat/portada-que-vende` — both edit `app/page.tsx`)
Delivery: `ask-on-risk` · Runner: `npm test` (vitest, node env)

## Specs

- **S1** — A special winter-clothing section must be added to the store.
  Source (L1, owner, verbatim): "Haz una sección especial de ropa de inviero" (sic — read as
  "invierno"; the typo is quoted as typed, not corrected).
- **S2** — **RESOLVED (L4).** Eligibility is a dedicated boolean column `products.is_temporada_invierno`,
  mirroring the `is_retro` precedent (`supabase/2026-10-01-retro-is-retro.sql`). Products keep their
  `category_id`: winter is a *season*, which cuts across every category, not a garment type (L4 evidence).
  The column is created and populated once by a SQL migration; the owner curates afterwards by flipping
  the flag, with no code change.
- **S3** — The section reuses `ProductGrid` / `ProductCard`. No new card component is invented.
- **S4** — Placement: a standalone route `/temporada-de-invierno` that lists the whole set, plus a tile
  first in the home Categorías grid. The route mirrors `app/equipaciones/retro/page.tsx` (the `is_retro` shape).
  **Amended (L8):** the home section was removed at the owner's request — the tile is the only home entry
  point. Superseded clause, kept for history: "plus a home section (following the Novedades precedent)".
- **S5** — The migration replicates the measured rule of `lib/invierno.ts` exactly (18 coat words, minus
  `short sleeve` / `half sleeve`). The translation is verified word-by-word, not eyeballed (T2 check).
- **S6** — No product changes category. Streetwear stays at 324 rows; `/streetwear` and its brand pages
  are untouched. This is the whole point of choosing the boolean over a real category.

## Tasks

| ID | S# | Change | Route | Status |
|----|----|--------|-------|--------|
| T1 | S2 | Decide the eligibility/curation model | — | **done** — owner chose the boolean (L4) |
| T2 | S2,S5 | `supabase/2026-10-14-temporada-invierno.sql` + rollback, mirroring the rule | inline | **done** — verified SQL↔rule (L6) |
| T3 | S2,S6 | `ProductFilters.isTemporadaInvierno`; drop the 324-row rule query | inline | **done** (L6) |
| T4 | S3,S4 | Route `/temporada-de-invierno` + tile in the Categorías grid (home section removed — L8) | inline | **done** (L6; amended L8, re-verified L9) |
| T5 | S1-S6 | Verify: column reachable, counts, no regression on `/streetwear` and friends | inline | **done** (L9 — SQL applied by the owner) |
| T6 | S3,S6 | Regression of every shared `getProducts` consumer after the edits | inline | **done** — DOM vs live DB (L7) |

### Test approach

Same constraint as `odd/tasks/portada-que-vende.md`: `vitest` runs `environment: 'node'` with no jsdom
and no component harness, so markup and Supabase query builders have no runnable RED. Proportionate
substitute is a Playwright DOM assertion against the dev server.

Applied as decided in L4: the rule of `lib/invierno.ts` stayed a pure, test-first function (it is what the
migration replicates), and the one new piece of logic — the hand-built category tile — was also extracted
pure (`tileDeInvierno`) so its `href` and count have real coverage. The migration's UPDATE is the one thing
no test can reach: it needs a write credential the project does not have, so it is verified statically
against the rule (T2) and then observed live (T5).

## Log

- **L1** (owner, original request, verbatim): "Haz una sección especial de ropa de inviero"
- **L2** (evidence — scoping pass, live Supabase, before any code): three findings, each killing a
  tempting design.
  (a) **No winter data exists.** The 14 categories are Equipaciones, Sneakers, Chanclas, Streetwear,
  Bolsos, Relojes, Accesorios, Perfumes, Auriculares, Altavoces, Cuidado personal, Mandos, Packs,
  Móviles. None is seasonal.
  (b) **`season` cannot be reused.** It is football-kit data: `"2026-27"` on 753 rows, `"1994"`,
  `"1998-99"`, … and **1894 null**. Two pages already branch on it
  (`app/producto/[slug]/page.tsx` via `TEMPORADA_ACTUAL`; `app/equipaciones/[pais]/[liga]/[equipo]/page.tsx`).
  Overloading it with "invierno" would corrupt kit detection.
  (c) **Title matching is booby-trapped.** 99 keyword hits, of which the 9 in `Equipaciones` are false
  positives: "Football hoodie Real Madrid French football jersey", "High version club/national team
  football trench coat" and "Messi commemorative edition jersey" are **football shirts**, matching on
  `jersey` and `coat`. In football English "jersey" means camiseta, not a knit. The genuine material is
  **~90 rows in `Streetwear`**: `Chaqueta 01`–`09`, `Canada Goose Cotton Coat`, `Moncler Fashion Hooded
  Coat`, `Essentials FW20 Puffer Jacket`, `The North Face` (7), `Carhartt` (5), `Stone Island`,
  `Patagonia`, `Ralph Lauren`.
  Also re-read while scoping: `products.is_featured` **exists** and carries 36 rows marked `true`,
  unread by any code. Recorded as a correction in `odd/tasks/portada-que-vende.md` L17, where I had
  wrongly written that no such flag exists.
- **L3** (question to the owner, asked, awaiting answer): which curation model. Options offered, with
  the tradeoffs as measured: (1) **rule-based** — Streetwear plus garment keywords, ~90 items today,
  zero DB writes, keeps itself current, but it is a heuristic the owner does not control and it does
  not learn; (2) **`is_featured`** — the flag already exists so no schema change, the owner marks what
  enters, but today's 36 rows are a different assortment (AirPods, iPhone, Dyson, chargers) and the
  "invierno" label would not match what is flagged; (3) **real category** — the most store-like and
  permanent, but it writes to the production database and moves ~90 rows out of `Streetwear`, changing
  that category's page count from 324 to roughly 234.
  Recommendation recorded for the owner: start with (1) to see the section on screen and validate the
  concept, then move to (2) once the concept holds, because (2) is the design that lets the owner curate
  without touching code and needs no schema change.
  Blocking: options (2) and (3) write to the live database, so neither can be started without explicit
  consent.
- **L4** (owner, requirement change, verbatim): "Quiero una nueva categoría que sea 'Temporada de Invierno'".
  Scoping the request turned up four findings, all measured, which changed the shape of the answer:
  (a) **`category_id` is a single FK, and the season is an orthogonal axis.** The 2026-09 reclassification
  already spent that axis on *garment type*: `next.config.ts` carries seven permanent 301s merging the old
  types into the new lines (`chaquetas → streetwear`, `pantalones → streetwear`, `camisetas → streetwear`,
  `gorras → streetwear`, …) and `lib/sudu/names.ts` maps `coats` and `hoodies sweater jacket` to
  `streetwear` on import. A coat is Streetwear *and* winter, so a real category would have to **move 89 of
  Streetwear's 324 rows out** (−27%), removing them from `/streetwear` and `/streetwear/<marca>`.
  (b) **The repo already solved this exact problem**: `is_retro` — a retro kit is orthogonal too (both
  Equipaciones and retro) and was resolved with a boolean plus a dedicated route
  (`app/equipaciones/retro/page.tsx`, and `app/equipaciones/page.tsx` excludes retro via `isRetro: false`).
  (c) **Is_retro's stated reason does not transfer.** Its comment justifies keeping `category_id` by the
  Fans/Jugador price hanging off the category; verified, that does not apply here — `lib/precios.ts` only
  has a per-category rule for `sneakers`, and `tallasParaCategoria` falls through to `TALLAS_ROPA`. So
  moving would have been *technically* safe; the objection is modelling, not breakage. (Correction to my
  own alarm during scoping: I first reported that a new category would leave products without sizes. Wrong
  — the default is clothing sizes.)
  (d) **The delivery path is proven.** There is no write credential (`NEXT_PUBLIC_SUPABASE_ANON_KEY` only),
  but probing the live database returned `is_retro` present, so the `supabase/*.sql` files do reach
  production. `temporada-de-invierno` does not exist yet. Also noted: no `app/sitemap.ts`, and
  `getCategoriesWithCounts` is called *only* by the home page, so the grid tile is the only place that
  enumerates categories — which is why the boolean is paired with a hand-built tile.
  Owner's decision (verbatim choice): **"Booleano, sin mover"** — add `is_temporada_invierno`, keep every
  product in Streetwear, curate by hand.
- **L5** (implementation, evidence): what changed.
  - `supabase/2026-10-14-temporada-invierno.sql` — adds `is_temporada_invierno boolean not null
    default false`, its partial index, and one idempotent UPDATE marking the garment titles inside
    Streetwear. The index is `(created_at desc) where is_temporada_invierno`, deliberately *not* the
    `(category_id)` of `products_retro_idx` — see L7. `supabase/rollback-temporada-invierno.sql` drops
    both; nothing to restore, because no product changed category. It warns to revert the code first if
    the column is already deployed.
  - **The SQL↔rule translation was verified mechanically, not eyeballed.** A script parses the `ilike`
    patterns out of the SQL's two groups (`not (...)` versus the inclusion block) and compares them as
    sets against `PALABRAS_DE_ABRIGO` and `SENALES_DE_MANGA_CORTA`: 18 and 2 on both sides, nothing
    missing, nothing extra → **FAITHFUL**. The same run measured the live database: Streetwear 324, rule
    matches 89.
  - `lib/queries.ts` — `ProductFilters` gained `isTemporadaInvierno`, mirroring `isRetro`, and
    `getRopaDeInvierno` was deleted. Winter now reads through `getProducts({ isTemporadaInvierno: true })`,
    one path for the home and the route: 89 rows / 19 KB instead of 324 rows / 64 KB.
  - `app/temporada-de-invierno/page.tsx` — standalone listing, moulded on `app/equipaciones/retro`.
  - `app/page.tsx` — the section reads the column and links to the new route; the Categorías grid gets
    `tileDeInvierno(total)` first. The tile is hand-built because it is not a category, and it is omitted
    at count zero, matching the existing "never link an empty category" rule.
  - `lib/invierno.ts` — the rule stays: it is the SQL's specification and the re-tagging tool after an
    import. It gained `tileDeInvierno`, written RED first (`TypeError: tileDeInvierno is not a function`,
    3 failures) then GREEN 13/13.
- **L6** (checks, observed): `tsc --noEmit` clean; `vitest run` 23 files / 238 tests passing (was 235);
  `npm run lint` 0 errors, the same 5 pre-existing warnings in `scripts/`. Rendered against the dev server
  *before* the migration: `/` 200 at 2664px, sections Novedades → Categorías → Opiniones, no console
  errors, no crash; `/temporada-de-invierno` 200 and empty rather than 404; `/streetwear` 200 and
  untouched. A missing column degrades to a silently absent section instead of an error — which is why
  T5 needs the owner to run the SQL before it can pass.
- **L8** (owner, requirement change, verbatim): "Elimina la seccion de 'Temporada de Invierno' de la
  homepage". Read as scoped to the home *section* only: the section and the Categorías tile advertised the
  same 89 products, so the home was paying for two entry points to one assortment. Removed from
  `app/page.tsx`: the whole `<section>` block and the now-unused `INVIERNO = 8` constant (an unused const
  would have failed lint). Kept deliberately, because the request named the homepage section and nothing
  else: the Categorías tile (`tileDeInvierno`), the route `/temporada-de-invierno`, `lib/invierno.ts`, the
  migration and its column. The `getProducts({ isTemporadaInvierno: true })` call also stays — the tile
  needs the total to render its count, so the query is now the *only* reason the home reads winter.
  S4 amended; T4 re-verified.
- **L10** (ajuste visual solicitado, verbatim): "Agrega una imagen para la nueva categoria y la de mobiles".
  - **Invierno (tile de la home)**: añadida una imagen real de la propia vitrina (`Chaqueta 01`, 1200x1600,
    servida desde `lh3.googleusercontent.com` —host permitido en `next.config.ts`— a través de `tileDeInvierno`.
    Se añadió el test `tileDeInvierno > carries a photo…` y se hizo RED→GREEN. El tile renderiza con foto
    (`next/image`, natural 270x360) y deja de mostrar la inicial "T". Verificado con Playwright sin errores.
  - **Móviles (categoría)**: la única de las 14 categorías sin `image_url`. Las fotos de sus 8 productos son
    miniaturas locales de 256x256 (todas iguales o más pequeñas); no hay candidata remota usable. Se preparó
    `supabase/2026-10-14-imagen-moviles.sql` para setear `image_url` a `/productos/sudu/samsung-s26-ultar-1.webp`.
    Al ser local con prefijo `/productos/`, `isLocalCatalogImage` devuelve true y el tile la muestra contenida
    sobre panel claro (no a full-bleed), con texto en tinta. Es un compromiso funcional: no pixelada, pero con
    look distinto al resto; se deja comentado cómo revertirlo y cómo usar una URL externa si el dueño aporta
    una foto. `tsc --noEmit` OK, `vitest run` 23 archivos / 239 tests OK, lint 0 errores (5 warnings preexistentes).
- **L9** (checks after L8, observed): ... `vitest run` green, `npm run lint` 0 errors. (ampliado en L10)
  every route that calls `getProducts` was re-measured **against the live database** rather than against a
  previous screenshot: DOM-versus-DB is an absolute property, a baseline is not.
  - `/equipaciones` → 777 rendered, DB 777. `/equipaciones/retro` → 534 rendered, DB 534. That retro route
    runs `q.eq('is_retro', true)`, the same shape as the new winter line, so the boolean-column plumbing is
    now **proven live against production before the winter column even exists**.
  - The 13 category routes each render their correct mode (`grid` → brand cards and zero products; `none`
    → products), and the home keeps its four sections. No regressions.
  - **Correction to the migration.** The partial index had been written as `(category_id) where
    is_temporada_invierno`, copied from `products_retro_idx`. But that index exists because the retro
    listing filters by *category + flag* (its own comment says so), while the winter query filters by the
    flag alone and always orders by `created_at desc`. It is now `(created_at desc) where
    is_temporada_invierno`, serving filter and order together. Caught before the owner ran it.
  - **Measurement gotcha, repeated.** `waitUntil: 'networkidle'` reported `/equipaciones` as 0 products.
    The page is 3.39 MB and the RSC keeps streaming over the same connection, so the network looks idle
    while the HTML is still arriving and the shell reads as empty. A plain HTTP fetch showed the truth
    (200, correct h1, 777 products). Only content-based waits (`waitForSelector` / `waitForFunction`) are
    reliable here.
