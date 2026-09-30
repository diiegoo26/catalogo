# Design: real 2026-27 club kit photos for the equipaciones catalog

**Date:** 2026-09-29
**Status:** implemented (2026-09-29) — 190 products, 117 clubs, 3230 photos on the detail galleries;
the catalog card shows one variant with a Local/Visitante/Tercera selector.
**Scope:** `public.products.images` data + `next.config.ts` image host + a generated SQL migration

## 1. Goal

Every product in the `equipaciones` catalog that belongs to a club should show the club's
**real 2026-27 kit photography** instead of its current single store photo (which today is a
Wix original file, already de-blurred but unrelated to the season's official imagery).

Decisions confirmed with the user:

| Question | Decision |
|---|---|
| Image source | **FootyLogos first** (already used for crests and flags) |
| Images per product | **All available photos of every kit variant** (home, away, third, plus fourth/anniversary when they exist) |
| Clubs without a 2026-27 gallery | **Keep the current photo** — never leave a product without an image |
| Hosting | **Hotlink FootyLogos assets** (no download, no Storage bucket) |
| Ordering | Home first, then away, then third; inside each variant the `cover` photo first, then numbered photos |

## 2. Source conventions (verified, not assumed)

- Club kit gallery page: `https://www.footylogos.com/kits/<club-slug>-2026-27`
  (Brazilian clubs use the `-2026` suffix).
- The **authoritative list of clubs** is the set of links on `https://www.footylogos.com/football-kits`
  (275 club pages). The site's `sitemap.xml` is **incomplete** (only 313 kit pages) and must not be
  used as the universe.
- The photos live on a **different host**: `https://assets.footylogos.com/kits/2026-27/<league>/batch-NN/`
  with filenames shaped `<cover|NN>-<club-name>-<2026-27|2026>-<variant>-kit-footylogos.<jpg|webp>`
  where `<variant>` is `home`, `away`, `third` (rarely `fourth` / `anniversary`).
- The filename uses the club's **full name** (`brentford-fc`, `ca-osasuna`, `deportivo-de-a-coruna`),
  which often differs from the page slug. Matching must be token-based, not string-equal.
- Kit pages embed **other clubs' photos** in sidebars. Photos must be attributed to a club only when
  the page-slug tokens and the filename club tokens overlap on at least 60% of the smaller token set.
- **FootyLogos does not label goalkeeper kits.** "All variants" therefore means all variants that
  exist; no `gk` folder is expected or fabricated.

Known slug collisions that must stay excluded (they resolve to the wrong club):
`america-de-cali` → `club-america` (Mexican club) and `rangers-fc` → `queens-park-rangers`.

## 3. Coverage (measured)

| Metric | Value |
|---|---|
| Products in the catalog | 286 |
| Products linked to a team | 260 |
| **Products that get real 2026-27 photos** | **178** (110 clubs) |
| Products that keep their current photo | 82 |
| Photo URLs verified during design | **2271 / 2271 → HTTP 200** |
| Photo dimensions | median 1200×1600, min 540×720 (4 photos under 600 px), 2189 JPEG + 82 WebP |
| Photos per club | min 2, median 20, max 41 |

Clubs with **no** FootyLogos gallery (keep current photo): Spanish Segunda (Almería, Albacete,
Burgos, Cádiz, Córdoba, Cultural Leonesa, Granada, Las Palmas, Leganés, Sporting Gijón, Valladolid,
Zaragoza), the whole J-League, Argentina, Chile, Colombia, Uruguay, Paraguay, Scotland, Norway,
Greece, Serbia, Braga, Palermo, Saint-Étienne, Núremberg, Hannover 96, Fortuna Düsseldorf,
Leicester City, Bradford City, Doncaster Rovers, Racing Santander and ~40 more (the complete list is
the set of club slugs absent from the generated `supabase/equipaciones-2026-27-imagenes.sql`).

Clubs whose FootyLogos page exists but **has no photos yet** (keep current photo): Atlético de
Madrid, Getafe, Ipswich Town, Inter Miami, New York City FC, Atlético Mineiro, Remo.

## 4. Data change

`products.images` is a `jsonb` array and stays a `jsonb` array of absolute URLs. No schema change.

Generated artifact: `supabase/equipaciones-2026-27-imagenes.sql`, one idempotent block per club:

```sql
-- Arsenal · source: https://www.footylogos.com/kits/arsenal-2026-27 (home 15, away 15, third 12)
update products p
   set images = '["https://assets.footylogos.com/.../cover-arsenal-fc-2026-27-home-kit-footylogos.jpg", ...]'::jsonb
  from teams t
 where t.id = p.team_id and t.slug = 'arsenal';
```

Properties:

- **Idempotent**: re-running reproduces the same arrays; clubs without a gallery are not touched.
- **Auditable**: each block carries the FootyLogos source page and the per-variant photo count.
- **Scoped by team slug**, so every product of the club (adult shirt, kids set, player version)
  receives the same kit gallery — the designs are the same shirt.
- Clubs that keep their current photo are simply absent from the file.

Every product of a covered club gets `images.length >= 2`, and `images[0]` is the home cover
(or the first available variant's cover when a club has no home kit photo).

## 5. Code change

`next.config.ts` — add the assets host (currently only `www.footylogos.com` is allowed):

```ts
{ protocol: 'https', hostname: 'assets.footylogos.com' },
```

No component changes: `ProductCard` and `ProductGallery` already render a URL array with
`next/image` `fill` + `sizes`, and the detail gallery already supports thumbnails and switching.

## 6. Edge cases

| Case | Behaviour |
|---|---|
| Club with no FootyLogos gallery | `products.images` untouched (current high-res Wix photo) |
| FootyLogos page exists, zero photos | Same as above (detected during mapping, not at runtime) |
| Club with only away/third (no home) | Gallery starts with the first available variant |
| Products of the same club (adult / kids / player) | Identical gallery; no per-variant distinction exists in the data model |
| Products with `team_id is null` (26 rows) | Out of scope, untouched |
| Rare variants (`fourth`, `anniversary`) | Appended after third when present |
| A photo 404s later | `next/image` shows the alt/empty box for that photo only; the migration is re-runnable with an updated mapping |

## 7. Out of scope / follow-up candidates

- **26 products with `team_id is null`** (West Ham, Wolverhampton, Burnley, Mallorca, Girona, Nantes,
  París/PSG, Atlético de San Luis, León, Dresden, Hércules, Oviedo, Plymouth, Santa Cruz, Reds,
  Montevideo, Die Roten, Vitoria, plus 5 "Nueva Incorporación"). Several already exist in FootyLogos
  and could receive real photos, but they have no club page, so linking them to a team is a separate
  change (routing + breadcrumbs) and is not part of this one.
- **Goalkeeper kits**: not offered by the source; stated plainly rather than invented.
- Self-hosting the photos in Supabase Storage if FootyLogos hotlinking ever fails.

## 8. Verification

The project has no test runner (only `tsc`, `lint`, `build`). Verification is:

1. `npx tsc --noEmit` — clean.
2. `npm run lint` — clean apart from the three known pre-existing warnings.
3. `npm run build` — succeeds.
4. **Data assertions** (SQL): for every covered club, `jsonb_array_length(images) >= 2`; zero URLs
   still containing `w_147` or `blur_2`; every URL starts with `https://assets.footylogos.com/`
   for updated rows; count of updated rows equals the mapping total.
5. **Runtime sweep**: start the production server, fetch a sample of product pages plus club pages,
   extract every `/_next/image?url=…` source, and decode the returned bytes to prove the served
   images are far above 147 px and that no `w_147`/`blur_2` URL remains anywhere on the pages.
6. **Spot-check**: pick 3 clubs, open FootyLogos and the catalog side by side, and confirm the first
   three photos are the same shirts in the same order.
