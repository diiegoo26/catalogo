# Portada que vende — KOVA ZONE home

Branch: `feat/portada-que-vende` (from `main`) · Delivery: `ask-on-risk` · Runner: `npm test` (vitest, node env)

Measured baseline (Playwright DOM audit, desktop 1280 / mobile 390):

| Block | Desktop | Mobile |
|---|---|---|
| Hero banner | 249px | 486px of 844px viewport = **58%** |
| Trust line | 20px | 20px |
| Categories grid | 911px (**48%** of page) | 1040px |
| Opinions | 220px | 534px |
| **Products shown** | **0** | **0** |

## Specs

- **S1** — The home page must show real products. Today it shows none: it is a navigation
  directory (banner + trust line + category tiles + 3 reviews).
  Source (L1, verbatim): "Puedes mejorar el aspecto visual y la organización de la pagina"
  Owner decision (L2, verbatim): "Las dos, en ese orden" — structural first, then visual polish.
- **S2** — The "Novedades" strip selects **the newest product of each category, then spreads them
  so no single category dominates**. Recency still decides *who represents* each category, but it no
  longer decides *which categories appear*.
  Owner decisions: L3 (verbatim) "Novedades (Recomendado)" — the ordering is by recency, not by a
  curated flag; and L4 (verbatim) "Diversificar por categoría (Recomendado)" — take one or two per
  category so the home shows sneakers, streetwear, watches and perfume instead of eight shirts.
  **Corrected by L17**: the earlier claim that no `featured` flag exists was wrong. `products.is_featured`
  exists and 36 rows are marked true — nothing in the app reads it. It was still not used for this
  section, and neither was `season` (that is football-kit data: 753 rows `2026-27`, 1894 null).
  No migrations were made.
  Superseded the original S2 (pure recency over a single pool) after L10 proved that pool could not
  diversify.
- **S3** — The section reuses `ProductGrid` / `ProductCard`. No new card component is invented.
- **S4** — The categories grid stays as it is: it is navigation, not filler. Both a ceiling with a
  "Ver todas" link and compact tiles were offered and rejected.
  Owner decision L14 (verbatim): "3" — option 3 as offered: "Dejarla como está — si la pensás como
  navegación y no como relleno, no es ruido."
  Baseline retained: ~14 categories → 4 rows → 911px desktop / 1040px mobile, 48% of the home page.
  It still grows with every new category; that growth is now accepted, not mitigated.
- **S5** — The hero must not consume the mobile viewport. Baseline 486px of 844px (58%).
  Target: at or below roughly 35%. **Not reached.** The content-preserving pass lands at 368px (44%);
  the remaining ~70px requires a design decision that is the owner's to make (L15). The 35% figure was
  my own estimate at audit time, not an owner requirement — it is left standing as an unmet target
  rather than quietly relaxed.
  Hard constraint: desktop must not regress (baseline 249px of 900px).
- **S6** — Icon language must be consistent. `components/BloqueConfianza.tsx` documents the rule
  "Mismo lenguaje visual que las estrellas de Estrellas: icono SVG, no emoji", but the hero uses
  emoji: 🚀 (eyebrow), 🏁 (h1), 👟👕👜⌚💎 (line pills), 🚀📦 (shipping strip).
  Downgraded to an owner taste call — see L8.
- **S7** — The trust line (average rating, review count, visit counter) must read as a real
  element, not as a stray 20px text line wedged between a 249px block and a 911px block.

## Tasks

| ID | S# | Change | Route | Status |
|----|----|--------|-------|--------|
| T1 | S2 | `getProducts` gains an additive `limit?` filter | inline | **reverted** — see L13: no caller, dead code |
| T2 | S3 | `ProductGrid` gains an additive `max?` prop (cap after kit expansion) | inline | **done** — 8 cards rendered |
| T3 | S1,S2,S3 | Home renders a "Novedades" section | inline | **done** — 2nd h2, 8 cards |
| T8 | S2 | `getNovedadesPorCategoria` (one short query per category) + `diversificarPorCategoria` (pure round-robin) | inline | **done** — 8 cards / 8 distinct categories |
| T4 | S4 | Ceiling on the categories grid | inline | **cancelled** — owner chose L14 option 3 (leave as is) |
| T5 | S5 | Compact mobile hero | inline | **done (partial)** — 486 → 368px mobile (58% → 44%); desktop 249px unchanged |
| T6 | S6 | Emoji → SVG in the hero | inline | pending — downgraded to owner taste call (L8) |
| T7 | S7 | Give the trust line real presence | inline | pending |

### Test approach

`vitest` runs `environment: 'node'` over `tests/**/*.test.ts`. There is **no jsdom and no
component-testing harness**, and `lib/supabase.ts` builds its client at import time from env vars,
so no runnable deterministic RED exists for a React component or for a Supabase query-builder chain.

Documented exception to the test-first policy for T2/T3 (markup and query-builder only).
Proportionate substitute: Playwright DOM assertions against the running dev server, plus a
regression check that `/[categoria]` still renders its product grid (T1 touched shared code that
page consumes).

T8 **does** have a runnable RED: `diversificarPorCategoria` is a pure function, so it is covered by
real test-first work in `tests/novedades.test.ts` — RED observed first (`Cannot find module
'../lib/novedades'`), then GREEN.

## Log

- **L1** (owner, original request, verbatim): "Puedes mejorar el aspecto visual y la organización de la pagina"
- **L2** (owner, verbatim): "Las dos, en ese orden"
- **L3** (owner, verbatim): "Novedades (Recomendado)"
- **L4** (owner, verbatim): "Diversificar por categoría (Recomendado)"
- **L5** (evidence): structural audit captured. This model cannot read images, and subagent
  delegation fails in this session ("OpenCode's free tier can only be used from within OpenCode"),
  so visual judgement is deferred to the owner; all findings above are measured, not estimated.
- **L6** (constraint): `getProducts` has no `.limit()` and returns the whole catalogue. It must not
  be called from the home page as-is.
- **L7** (evidence, T2-T3 done): `tsc --noEmit` clean. Home h2 order became
  `Novedades, Categorías, Opiniones`. Novedades rendered 8 cards / 16 anchors (2 per card: image
  link + title link) / 8 unique hrefs. No console errors, no horizontal overflow on either viewport.
  Regression on real `getProducts` consumers: `/chanclas` 12 products, `/bolsos` 20 — unaffected.
  Page height grew as expected: desktop 1885 → 2668px, mobile 2653 → 3739px.
- **L8** (correction to my own S6): the emoji finding is downgraded from defect to taste call. The rule
  quoted from `BloqueConfianza.tsx` governs that component's icon language; the hero is a promotional
  banner where emoji are legible, colourful and consistent within themselves. Swapping 7 emoji for
  7 hand-drawn SVGs on a page the author cannot see is not a defensible unilateral change.
- **L9** (finding from L7, raised to the owner): the recency rule produced 8 of 8 retro football
  kits — zero sneakers, streetwear, bags, watches, perfume or electronics; three Real Madrid; two
  literal duplicate titles. Owner answered with L4 (diversify), which is what T8 implements.
- **L10** (evidence, measurement — kills the obvious design): the catalogue holds **3087 products**,
  and the **500 most recent are all `Equipaciones`**. The newest 12 are all `Equipaciones`. So
  "fetch a recent pool and group it in JS" cannot diversify — it would need to walk ~2800 rows to
  reach a second category. Verified with `node --env-file=.env.local` against live Supabase.
- **L11** (decision, from L10): diversify **at the query level**. One short query per category
  (`.eq('category_id', id).order('created_at', desc).limit(2)`), in `Promise.all`, then a pure
  round-robin spread. Cost is O(categories), and categories are bounded (14 with products today).
- **L12** (evidence, T8 done): RED observed (`Cannot find module '../lib/novedades'`), then GREEN
  6/6 on `tests/novedades.test.ts`. Full suite **22 files / 225 tests pass**; `tsc --noEmit` clean.
  Live home now renders 8 cards from **8 distinct categories**: Equipaciones, Sneakers, Streetwear,
  Bolsos, Relojes, Accesorios, Perfumes, Auriculares. No console errors, no overflow.
  **Server render 94-112ms** over 3 samples on a warm dev server. **Corrected by L16**: that sample
  was a warm-server best case. Measured directly against Supabase, the 14 parallel queries cost
  **247ms** (28 rows — exactly 2 per category, so the fan-out is correct). Dev-mode end-to-end render
  therefore varies between roughly 400ms and 2.3s with dev-server state, and the framework itself is
  not the cost — the server log shows `application-code` dominating (`GET /packs 200 in 3.1s
  (next.js: 29ms, application-code: 3.1s)`). The added fan-out is one parallel round trip, not
  fourteen sequential ones. Novedades measures 731px desktop / 1034px mobile.
  Regression re-confirmed: `/chanclas` 12 products, `/bolsos` 20 products.
- **L13** (cleanup, reverts T1): after T8, nothing calls `getProducts({ limit })`. The `limit?` field
  was added in T1 for the single-pool recency design that L10 invalidated, it had no caller and no
  test, so it was removed rather than left as dead API surface. `ProductGrid`'s `max?` stays — the
  home still uses it.
- **L14** (owner, verbatim): "3" — answering the S4 question. The categories grid stays as it is;
  the owner reads it as navigation rather than filler, so neither a ceiling nor compact tiles.
  T4 cancelled, S4 rewritten. Note the option text was offered by me, so only the choice is the
  owner's, not the framing.
- **L15** (evidence + judgement, T5 done in part): measured the mobile hero piece by piece at 390x844
  before touching it. 486px decomposed as: 72px vertical padding, 96px logo + 24px gap, 55px
  eyebrow/h1, **118px for the five line pills wrapping to three rows**, 105px shipping strip.
  Content-preserving pass (tighter padding and gap, logo 96 → 80px, pills to `text-xs` so they fit two
  rows, tighter strip padding) gives **368px = 44%**, with **desktop unchanged at 249px** because every
  changed value is overridden at `sm:`. `tsc` clean, 225 tests pass, page height 3735 → 3605px.
  Judgement recorded against the metric: I first took the shipping strip to 12px and **reverted it** —
  "envíos peninsulares" and "10 a 15 días" are purchase-deciding information, and shrinking them to win
  12px contradicts the same reasoning as S7. The honest number is therefore 44%, not 42%.
  **Remaining ~70px to reach 35% is a design decision, not a technical one**: either hide the logo on
  mobile (96px, but it is branding and partly duplicates the "KOVA.ZONE" eyebrow) or take the pills to a
  single horizontally scrolling row (34px, at the cost of hiding options behind a scroll). Both change
  what the visitor sees, and this model cannot see the result, so both are left to the owner.
- **L16** (correction to my own evidence, and to L12): my category-regression probe was
  `waitUntil: 'load'` followed by a fixed 400ms wait. That is a race: these pages stream, and under a
  slow dev server the probe counted the grid before it existed. It reported `/packs` as 0 product links
  in one run and 112 in another, and it silently changed which slug it asserted against between runs
  because it picks the first slug that answered in time. Rewritten to `waitUntil: 'networkidle'` plus
  `waitForSelector('main ul > li')`. Corrected results: `/chanclas` 12 products, `/bolsos` 20,
  `/packs` 56, `/equipaciones` **777** (it is its own country/collection chooser page) — **no regression**.
  Lesson: a fixed timeout is not a wait; wait for the content. The same doubt applied to my headline
  render number, which L12 now records as corrected rather than left flattering.
  Also observed while investigating — pre-existing, out of scope, not touched: every request is
  uncached (`lib/supabase.ts` uses `cache: 'no-store'`, `app/layout.tsx` is `force-dynamic`), so each
  page view pays fresh DB round trips, and `/equipaciones` renders 777 product cards on one page.
- **L17** (correction to my own spec, plus evidence for the new request): while scoping the new
  "sección especial de ropa de invierno" I re-read the live schema and **my S2 claim was wrong —
  `products.is_featured` exists**. It carries 36 rows marked `true` and **nothing in the app reads it**
  (grep for `is_featured`/`isFeatured` across the repo: zero matches). So the flag is dormant curation,
  not a missing feature. It was not used for Novedades either; that decision (L3, recency) stands, and
  the "zero migrations" claim stands — no migration was ever made. S2 corrected above.
  Other findings from the same pass, recorded here because they kill two tempting designs:
  **`season` is not reusable** — it is football-kit data (`"2026-27"` on 753 rows, `"1994"`, `"1998-99"`,
  … , **1894 null**), and `app/producto/[slug]/page.tsx` and
  `app/equipaciones/[pais]/[liga]/[equipo]/page.tsx` already branch on it via `TEMPORADA_ACTUAL`.
  **There is no winter category** — the 14 existing ones are unchanged. And title matching is booby-trapped:
  of 99 keyword hits, the 9 in `Equipaciones` are false positives — "Football hoodie Real Madrid French
  football jersey", "High version club/national team football trench coat", "Messi commemorative edition
  jersey" are **football shirts**, matching on `jersey` and `coat`; in football English "jersey" means
  camiseta. The genuine material is ~90 rows in `Streetwear` (Chaquetas 01-09, Canada Goose, Moncler,
  The North Face, Carhartt, Patagonia, Essentials puffer). New feature tracked separately in
  `odd/tasks/seccion-invierno.md`.
