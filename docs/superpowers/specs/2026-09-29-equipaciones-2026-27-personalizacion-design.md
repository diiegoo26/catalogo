# Design: Club kits 2026-27 with name/number and competition patches

**Date:** 2026-09-29
**Status:** approved (user validated each section)
**Scope:** KOVA catalog — club pages, product detail page, Supabase schema + seed data

## 1. Goal

Inside each club's page, show its kits for the **2026-2027 season**. On the product
detail page of such a kit, the buyer can:

- add a **player name and number** (picked from the club squad, or fully custom),
- see the **competition patches** the club plays in, automatically,
- see a **live total including surcharges**, which travels in the Telegram order message.

Decisions confirmed with the user:

| Question | Decision |
|---|---|
| Experience shape | Option selector, **no visual preview** on the shirt image |
| Kit source | Existing `products`, **enriched** with kit data (not a new entity) |
| Player list origin | New **`players` table in Supabase** |
| Squad data authenticity | **Authentic squads only** — real 2026-27 names and numbers per club, researched from live sources (user correction) |
| Patches | **Automatic** per club; buyer does not choose |
| Selector location | **Product detail page**, only for 2026-27 kits of a club |
| Data scope | **Top 5 leagues only** (Premier, LaLiga, Serie A, Bundesliga, Ligue 1) |
| Pricing | **Visible surcharges with recalculated total** |
| Patch charge rule | Option 1: patches **always** included on any 2026-27 kit that has patches |

## 2. Data model

```sql
-- Season on products (club-page filter)
alter table products add column season text;   -- '2026-27' | '2025-26' | null

-- Squads (only top leagues are seeded)
create table players (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references teams(id) on delete cascade,
  name      text not null,
  number    int  not null check (number between 1 and 99),
  unique (team_id, number)
);

-- Competitions that grant a patch (cups + continental only)
create table competitions (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      text not null unique,
  logo_url  text,
  kind      text not null check (kind in ('copa', 'continental'))
);

-- Which club plays which competition
create table team_competitions (
  team_id        uuid not null references teams(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  primary key (team_id, competition_id)
);

create index on players (team_id);
create index on team_competitions (competition_id);
```

Modeling rules:

- **The club's own league is NOT duplicated** in `competitions`. Its patch derives from
  `teams.league_id -> leagues.logo_url`, which already exists (25 of 26 leagues have a logo).
- `competitions.kind` is restricted to `copa` / `continental` because leagues live in `leagues`.
- **Surcharges live in `lib/precios.ts` as constants** — no price table; they do not vary per product.
- **No `kit_type` column** (YAGNI): clubs average ~1.5 products and titles already distinguish them.
  Add later if Local/Away/GK grouping is ever wanted.
- **RLS**: public read policy on the three new tables, matching existing tables.
- **Migration is idempotent** (`on conflict do nothing`), stored in `supabase/`, following the
  pattern of previous migrations.

### Season backfill

- Products whose title contains `2026` → `season = '2026-27'`.
- Products whose title contains `2025` (e.g. "Camiseta Santa Cruz 2025") → `season = '2025-26'`,
  therefore **they do not appear** on club pages.

## 3. Screens and flow

### 3.1 Club page — `app/equipaciones/[pais]/[liga]/[equipo]/page.tsx`

```
[crest] Club Name
[league badge] [continental badges] [cup badges]     <- informational row

Grid of kits filtered by season = '2026-27'
```

- New header block: crest (`teams.logo_url`) + club name + patch badge row.
- Patch row = league badge (from `leagues.logo_url`, when non-null) + badges from
  `team_competitions` (name + `logo_url`).
- `getProducts` gains a `season` filter; the grid passes `'2026-27'`.
- Empty state when the club has no 2026-27 kits:
  "Próximamente tendremos sus equipaciones".

### 3.2 Product detail — `app/producto/[slug]/page.tsx`

The customizer renders **only if** `product.team` is non-null **and**
`product.season === '2026-27'`. Otherwise `ProductPurchase` behaves exactly as today.

```
Size chips (existing)        Color chips (existing)

── Personaliza tu equipación ──
Nombre: [________]   Número: [__]
Squad:  [Personalized ▾]        <- only when the club has players;
                                   selecting a player fills both fields

Included patches: [LaLiga] [Champions] [Cup]        <- automatic, read-only

Base 18.00 €  +  printing 3.00 €  +  patches 2.00 €  =  23.00 €

[ Order via Telegram ]
```

- New client component `KitCustomizer` **replaces** `ProductPurchase` when it applies;
  it reuses the existing chip style and Telegram flow.
- Name: uppercase, max 12 chars, letters/spaces/accents/`-`/`'` only.
- Number: integer 1–99.
- Squad dropdown appears only when `players` exist for the team; choosing a player
  fills name and number. Free text remains possible at all times.
- Patches are shown automatically and cannot be toggled.

### 3.3 Queries

- `getPlayers(teamId)` — squad ordered by number.
- `getTeamPatches(teamId)` — league badge + `team_competitions` badges in one call.
- `getProductBySlug` extends its `select` to include the team with its league.
- `getProducts` accepts `season?: string`.

## 4. Pricing and order message

`lib/precios.ts`:

```ts
export const PRECIO_IMPRESION = 3;   // € name and/or number
export const PRECIO_PARCHE    = 2;   // € per kit that has patches
export const LIMITE_NOMBRE    = 12;  // characters
```

Rules:

- **Printing (3 €)** applies only when the buyer fills name or number (either one).
- **Patches (2 €)** apply to **every** 2026-27 kit of a club that has at least one patch
  (user's confirmed option 1). A kit with an empty patch list charges nothing for patches.
- **Total** = `price + printing + patches`, always shown with 2 decimals on the page
  and in the message.

Telegram message:

```
Hola, quiero pedir: Camiseta Mallorca 2026
Talla: M
Color: Blanco
Personalización: MBAPPÉ 10 (plantilla)   <- or: Nombre: JUAN CARLOS / Número: 7
Parches: LaLiga EA Sports, UEFA Champions League, Copa del Rey
Total: 23,00 € (18,00 € base + 3,00 € impresión + 2,00 € parches)
https://.../producto/camiseta-mallorca-2026
```

## 5. Seed data

Scope: **top 5 leagues** (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, ~96 clubs).

| Table | Volume |
|---|---|
| `players` | ~96 squads × 20–25 players ≈ **2,000+ rows** (real 2026-27 names + numbers) |
| `competitions` | ~**8 rows**: UEFA Champions League, UEFA Europa League, UEFA Conference League, Copa del Rey, FA Cup, Coppa Italia, DFB-Pokal, Coupe de France |
| `team_competitions` | ~**250 rows**: each top club with its continental competition(s) per 2025-26 results + its national cup |
| `products.season` | ~280 products with "2026" in title → `'2026-27'`; "2025" titles → `'2025-26'` |

**Authenticity requirement (user correction):** squad names **and numbers must be the authentic
ones for each club's 2026-27 squad** — no guessing, no placeholders, no model-memory estimates.
Sourcing rule:

1. Research each club's current squad (name + number) from live sources — the `football-data`
   skill's player/squad data first, web search as fallback — because knowledge cutoff predates
   the 2026-27 transfer window.
2. A squad is loaded **only when its data is verified**; clubs whose squad cannot be verified
   are treated as "no squad" (free-text only) rather than shipping invented numbers.
3. The seed SQL ships in `supabase/` with a `source` comment per club block so every row is
   auditable and correctable later with a small `update`.

European qualifiers (`team_competitions`) follow the same rule: researched, not remembered.

Clubs **outside** the top 5 keep working: their kits and league patch render, but no squad
dropdown appears.

## 6. Edge cases

| Case | Behaviour |
|---|---|
| Club without squad | No dropdown; free-text fields only |
| League without logo | No league badge; hide the whole patch row if no badges remain |
| No patches at all | Patch row hidden, no 2 € surcharge |
| Product without team or without season | Current flow untouched (`ProductPurchase`) |
| "Nueva Incorporación" products (no club) | Current flow untouched |
| Name only / number only | Allowed; printing surcharge still applies |
| Season `2025-26` products | Never shown on club pages, never customised |

## 7. Verification

The project has **no test runner** (only `build`, `lint`). Verification is:

1. `npx tsc --noEmit` — clean
2. `npm run lint` — clean (watch for the pre-existing `SearchBar` hook warning)
3. `npm run build` — succeeds
4. Manual route checks:
   - top-league club page: crest, patches, kits 2026-27
   - small-club page: kits + league patch, no squad dropdown
   - customisable product page: surcharges and total
   - plain product page: unchanged flow
5. **Squad data spot-check**: pick 3 seeded clubs, compare 5 name/number pairs each against
   the live source used during research — zero mismatches.
