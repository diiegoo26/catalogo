# Club Kits 2026-27 + Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every club page show its 2026-27 kits with automatic competition patches, and let buyers add an authentic player name/number or a custom one with visible surcharges that travel in the Telegram order.

**Architecture:** Existing `products` gain a `season` column (kits stay products). Three new Supabase tables (`players`, `competitions`, `team_competitions`) feed a new client component `KitCustomizer` on the product detail page and a patch header on the club page. Squad and competition data are seeded from researched, authentic sources only.

**Tech Stack:** Next.js 16 (App Router, server components), React 19, Tailwind 4, Supabase (`@supabase/supabase-js`), TypeScript 5.

## Global Constraints

- **Verification is the test cycle**: this project has NO test runner. Every task's "test" steps are `npx tsc --noEmit`, `npm run lint`, and (where stated) `npm run build`. Never claim green without running them.
- **No git**: the working directory is NOT a git repository. Do NOT run `git init`, `git add`, or `git commit`.
- **Language**: code, comments, SQL, and file contents in English. All UI copy (page text, buttons, messages) in Spanish, matching the existing UI.
- **Surcharges (verbatim from spec)**: `PRECIO_IMPRESION = 3` €, `PRECIO_PARCHE = 2` €, `LIMITE_NOMBRE = 12`. Patch surcharge applies to **every** 2026-27 kit of a club that has ≥1 patch (spec option 1). Printing surcharge applies only when name or number is filled.
- **Season**: current season constant is `'2026-27'`.
- **Authenticity rule**: player names/numbers and European qualifiers MUST be researched from live sources (football-data skill first, web search fallback). A club whose data cannot be verified is treated as "no squad" / "no extra patch" — never invent rows.
- **Database**: Supabase project KOVA via MCP tools (`apply_migration`, `execute_sql`, `query_logs` are available; use `execute_sql` for verification reads).
- **Image hosts**: `next/image` only allows configured `remotePatterns`. Competition/squad badges must use the SAME host as existing `leagues.logo_url` values (footylogos). Verify every new image URL returns HTTP 200 before inserting.
- **Next.js 16**: this is not the Next.js you know — check `node_modules/next/dist/docs/` before writing unfamiliar Next code (e.g. async `params` is already the convention here).

## File Structure

| File | Responsibility |
|---|---|
| Create: `supabase/migracion-kits-2026-27.sql` | DDL for 3 new tables + `products.season` + RLS + season backfill |
| Modify: `supabase/schema.sql` | Append the same tables so fresh installs match the live DB |
| Create: `supabase/seed-competiciones-2026-27.sql` | `competitions` + `team_competitions` data (researched) |
| Create: `supabase/seed-plantillas-2026-27.sql` | `players` data, one block per league (researched) |
| Create: `lib/precios.ts` | Surcharge constants + total calculator |
| Create: `lib/temporada.ts` | `TEMPORADA_ACTUAL` constant (used by club page + product page) |
| Modify: `lib/types.ts` | `Player`, `PatchBadge`, `season` on `ProductDetail`, `id` on team |
| Modify: `lib/queries.ts` | season filter, `getPlayers`, `getTeamPatches`, extended product select |
| Create: `components/KitCustomizer.tsx` | Full purchase UI for 2026-27 kits (name/number/patches/total) |
| Modify: `app/equipaciones/[pais]/[liga]/[equipo]/page.tsx` | Header with crest + patch row, season filter, empty state |
| Modify: `app/producto/[slug]/page.tsx` | Conditionally render `KitCustomizer` instead of `ProductPurchase` |

---

### Task 1: Schema migration (season column + 3 new tables)

**Files:**
- Create: `supabase/migracion-kits-2026-27.sql`
- Modify: `supabase/schema.sql` (append same table definitions)

**Interfaces:**
- Produces (tables other tasks read/write):
  - `products.season text` (nullable)
  - `players(id uuid, team_id uuid → teams, name text, number int 1..99, unique(team_id, number))`
  - `competitions(id uuid, name text, slug text unique, logo_url text, kind text in ('copa','continental'))`
  - `team_competitions(team_id uuid → teams, competition_id uuid → competitions, PK(team_id, competition_id))`

- [ ] **Step 1: Write the migration file**

Create `supabase/migracion-kits-2026-27.sql`:

```sql
-- Migration: kits 2026-27 (season + squads + competition patches)
-- Idempotent: safe to run more than once.

-- 1) season on products
alter table products add column if not exists season text;

-- 2) squads
create table if not exists players (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references teams(id) on delete cascade,
  name      text not null,
  number    int  not null check (number between 1 and 99),
  unique (team_id, number)
);

-- 3) competitions that grant a patch (leagues are NOT here: they come from leagues.logo_url)
create table if not exists competitions (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      text not null unique,
  logo_url  text,
  kind      text not null check (kind in ('copa','continental'))
);

-- 4) club <-> competition
create table if not exists team_competitions (
  team_id        uuid not null references teams(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  primary key (team_id, competition_id)
);

create index if not exists players_team_id_idx          on players (team_id);
create index if not exists team_competitions_comp_idx   on team_competitions (competition_id);

-- 5) RLS: public read, same as every other table
do $$
declare t text;
begin
  foreach t in array array['players','competitions','team_competitions']
  loop
    execute format('alter table %I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'public read'
    ) then
      execute format('create policy "public read" on %I for select using (true)', t);
    end if;
  end loop;
end $$;

-- 6) season backfill (only rows never classified)
update products set season = '2026-27' where season is null and title like '%2026%';
update products set season = '2025-26' where season is null and title like '%2025%';
```

- [ ] **Step 2: Apply the migration to the live database**

Run (Supabase MCP): `apply_migration` with `name: "kits_2026_27_schema"` and the file content as `query`.
Fallback if that tool is unavailable: `execute_sql` with the same content.

- [ ] **Step 3: Verify schema and backfill**

Run (Supabase MCP) `execute_sql`:

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='products' and column_name='season';

select 'season 2026-27' as label, count(*)::text as n from products where season='2026-27'
union all select 'season 2025-26', count(*)::text from products where season='2025-26'
union all select 'season null',    count(*)::text from products where season is null
union all select 'linked w/o season', count(*)::text from products where team_id is not null and season is null
union all select 'players', (select count(*)::text from players)
union all select 'competitions', (select count(*)::text from competitions);
```

**Expected**: `season` column exists; 2026-27 count > 0; `linked w/o season` = 0 (if > 0, list those titles and decide — a linked product must have a season, otherwise it silently disappears from its club page); `players`/`competitions` = 0 for now.

- [ ] **Step 4: Append the same tables to `supabase/schema.sql`**

Add the three `create table` blocks from Step 1 (sections 2–4 plus the two indexes and the RLS `do` block, with the loop array set to `array['players','competitions','team_competitions']`) after the existing `product_variants` block, so a fresh install matches production. Do not touch the existing `do $$` loop that covers the original tables.

- [ ] **Step 5: Verify TypeScript and lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: both exit 0 (SQL-only change; if lint reports the known pre-existing `SearchBar.tsx` warning, that is not from this task).

---

### Task 2: Business config, types and queries

**Files:**
- Create: `lib/precios.ts`
- Create: `lib/temporada.ts`
- Modify: `lib/types.ts`
- Modify: `lib/queries.ts`

**Interfaces:**
- Consumes: tables from Task 1.
- Produces (used by Tasks 3 and 4):
  - `lib/precios.ts`: `PRECIO_IMPRESION: number`, `PRECIO_PARCHE: number`, `LIMITE_NOMBRE: number`, `calcularTotal(base: number, extras: { impresion: boolean; parches: boolean }): { extra: number; total: number }`
  - `lib/temporada.ts`: `TEMPORADA_ACTUAL: string` (`'2026-27'`)
  - `lib/types.ts`: `Player = { id: string; team_id: string; name: string; number: number }`, `PatchBadge = { name: string; logo_url: string | null }`, `ProductDetail.season: string | null`, `ProductDetail.team.id: string`
  - `lib/queries.ts`: `getProducts({ ..., season?: string })`, `getPlayers(teamId: string): Promise<Player[]>`, `getTeamPatches(teamId: string): Promise<PatchBadge[]>`

- [ ] **Step 1: Create `lib/precios.ts`**

```ts
export const PRECIO_IMPRESION = 3;   // € — name and/or number printed
export const PRECIO_PARCHE = 2;      // € — kit ordered with competition patches
export const LIMITE_NOMBRE = 12;     // characters

export type Extras = { impresion: boolean; parches: boolean };

/** Base price + surcharges, rounded to 2 decimals (cents-safe). */
export function calcularTotal(base: number, { impresion, parches }: Extras) {
  const extra = (impresion ? PRECIO_IMPRESION : 0) + (parches ? PRECIO_PARCHE : 0);
  return { extra, total: Math.round((base + extra) * 100) / 100 };
}
```

- [ ] **Step 2: Create `lib/temporada.ts`**

```ts
/** Season the catalog is currently showing on club pages. */
export const TEMPORADA_ACTUAL = '2026-27';
```

- [ ] **Step 3: Extend `lib/types.ts`**

Add below the existing `Variant` type:

```ts
export type Player    = { id: string; team_id: string; name: string; number: number };
export type PatchBadge = { name: string; logo_url: string | null };
```

In `ProductDetail`, change the `team` member to include `id` and add `season`:

```ts
export type ProductDetail = ProductCardData & {
  description: string | null;
  season: string | null;
  category: { name: string; slug: string };
  brand: { name: string; slug: string } | null;
  team: { id: string; name: string; slug: string;
          league: { name: string; slug: string; region: { name: string; slug: string } } } | null;
  variants: Variant[];
};
```

- [ ] **Step 4: Extend `lib/queries.ts`**

Import the new types on line 2: add `PatchBadge`, `Player` to the `import type` list.

In `ProductFilters` add `season?: string;` and inside `getProducts` after the `teamId` line add:

```ts
  if (f.season)   q = q.eq('season', f.season);
```

Change `CARD` (line 4) only if needed — **do not** add `season` to `CARD`.

Extend `getProductBySlug`'s select so the team carries its `id` (needed by Task 4):

```ts
    .select(`*, category:categories(name,slug), brand:brands(name,slug),
             team:teams(id,name,slug, league:leagues(name,slug, region:regions(name,slug))),
             variants:product_variants(*)`)
```

Append the two new functions at the end of the file:

```ts
// ----- Equipaciones 2026-27 -----
export async function getPlayers(teamId: string) {
  const { data } = await supabase.from('players').select('*')
    .eq('team_id', teamId).order('number', { ascending: true });
  return (data ?? []) as Player[];
}

/** League badge first, then cups/continental badges. Entries without logo_url are dropped. */
export async function getTeamPatches(teamId: string): Promise<PatchBadge[]> {
  const [teamRes, compRes] = await Promise.all([
    supabase.from('teams').select('league:leagues(name,logo_url)').eq('id', teamId).maybeSingle(),
    supabase.from('team_competitions')
      .select('competition:competitions(name,logo_url)').eq('team_id', teamId),
  ]);
  const league = (teamRes.data as { league: { name: string; logo_url: string | null } | null } | null)?.league;
  const out: PatchBadge[] = [];
  if (league?.logo_url) out.push({ name: league.name, logo_url: league.logo_url });
  for (const row of compRes.data ?? []) {
    const c = (row as { competition: { name: string; logo_url: string | null } | null }).competition;
    if (c) out.push({ name: c.name, logo_url: c.logo_url });
  }
  return out;
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0. Then `npm run lint` → exit 0 (pre-existing SearchBar warning excluded).

---

### Task 3: Club page — crest, patch row, season filter, empty state

**Files:**
- Modify: `app/equipaciones/[pais]/[liga]/[equipo]/page.tsx`

**Interfaces:**
- Consumes: `getProducts({ teamId, season })` and `getTeamPatches(teamId)` from Task 2, `TEMPORADA_ACTUAL` from `lib/temporada.ts`.
- Produces: unchanged route `/equipaciones/[pais]/[liga]/[equipo]` with a header component inline.

- [ ] **Step 1: Rewrite the club page**

Replace the whole file with:

```tsx
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import { ProductGrid } from '@/components/ProductCard';
import { getLeague, getProducts, getRegion, getTeam, getTeamPatches } from '@/lib/queries';
import { TEMPORADA_ACTUAL } from '@/lib/temporada';

export default async function EquipoPage({ params }: { params: Promise<{ pais: string; liga: string; equipo: string }> }) {
  const { pais, liga, equipo } = await params;
  const region = await getRegion(pais);
  if (!region) notFound();
  const league = await getLeague(region.id, liga);
  if (!league) notFound();
  const team = await getTeam(league.id, equipo);
  if (!team) notFound();

  const [products, patches] = await Promise.all([
    getProducts({ teamId: team.id, season: TEMPORADA_ACTUAL }),
    getTeamPatches(team.id),
  ]);

  return (
    <>
      <Breadcrumbs items={[
        { label: 'Equipaciones', href: '/equipaciones' },
        { label: region.name, href: `/equipaciones/${region.slug}` },
        { label: league.name, href: `/equipaciones/${region.slug}/${league.slug}` },
        { label: team.name },
      ]} />

      <div className="mb-6 flex items-center gap-4">
        {team.logo_url && (
          <Image src={team.logo_url} alt="" width={64} height={64}
            className="h-16 w-16 shrink-0 object-contain" />
        )}
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          <p className="text-sm text-neutral-500">Equipaciones temporada {TEMPORADA_ACTUAL}</p>
          {patches.length > 0 && (
            <ul className="mt-2 flex flex-wrap items-center gap-2">
              {patches.map((p) => (
                <li key={p.name}
                  className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700">
                  {p.logo_url && (
                    <Image src={p.logo_url} alt="" width={16} height={16}
                      className="h-4 w-4 object-contain" />
                  )}
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <p className="py-16 text-center text-neutral-500">
          Próximamente tendremos sus equipaciones.
        </p>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: exit 0 for both (pre-existing SearchBar warning excluded).

- [ ] **Step 3: Smoke-check rendering**

Run: `npm run build`
Expected: build succeeds; the route compiles without `next/image` hostname errors.

---

### Task 4: KitCustomizer component + product page wiring

**Files:**
- Create: `components/KitCustomizer.tsx`
- Modify: `app/producto/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getPlayers`, `getTeamPatches` (Task 2), `calcularTotal`/`PRECIO_*`/`LIMITE_NOMBRE` (Task 2), `TEMPORADA_ACTUAL` (Task 2), types `Player`/`PatchBadge`/`Variant`.
- Produces: default export `KitCustomizer({ title, variants, basePrice, players, patches })` — props are consumed only by `app/producto/[slug]/page.tsx`.

- [ ] **Step 1: Create `components/KitCustomizer.tsx`**

```tsx
'use client';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { eur } from '@/lib/format';
import { LIMITE_NOMBRE, PRECIO_IMPRESION, PRECIO_PARCHE, calcularTotal } from '@/lib/precios';
import type { PatchBadge, Player, Variant } from '@/lib/types';

const TELEGRAM_USER = process.env.NEXT_PUBLIC_TELEGRAM_USERNAME; // sin @

const limpiarNombre = (v: string) =>
  v.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ\s'’-]/g, '').slice(0, LIMITE_NOMBRE);
const limpiarNumero = (v: string) => v.replace(/\D/g, '').slice(0, 2);

type Props = {
  title: string;
  variants: Variant[];
  basePrice: number;
  players: Player[];       // vacío = club sin plantilla cargada
  patches: PatchBadge[];   // vacío = sin parches (sin suplemento)
};

export default function KitCustomizer({ title, variants, basePrice, players, patches }: Props) {
  const sizes  = useMemo(() => [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[], [variants]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [jugadorId, setJugadorId] = useState('');
  const [copied, setCopied] = useState(false);

  const inStock = (s?: string | null, c?: string | null) =>
    variants.some((v) => (!s || v.size === s) && (!c || v.color === c) && v.stock > 0);

  const ready = (!sizes.length || size) && (!colors.length || color);
  const numeroValido = numero === '' || (Number(numero) >= 1 && Number(numero) <= 99);
  const conImpresion = nombre.trim() !== '' || numero !== '';
  const conParches = patches.length > 0;
  const { total } = calcularTotal(basePrice, { impresion: conImpresion, parches: conParches });
  const puedePedir = Boolean(ready) && numeroValido;

  const elegirJugador = (id: string) => {
    setJugadorId(id);
    if (!id) return;
    const p = players.find((x) => x.id === id);
    if (p) { setNombre(limpiarNombre(p.name)); setNumero(String(p.number)); }
  };

  const order = async () => {
    const parts = [`Hola, quiero pedir: ${title}`];
    if (size) parts.push(`Talla: ${size}`);
    if (color) parts.push(`Color: ${color}`);
    if (conImpresion) {
      const sufijo = jugadorId ? ' (plantilla)' : '';
      if (nombre && numero) parts.push(`Personalización: ${nombre} ${numero}${sufijo}`);
      else if (nombre) parts.push(`Personalización: Nombre ${nombre}${sufijo}`);
      else parts.push(`Personalización: Número ${numero}`);
    }
    if (conParches) parts.push(`Parches: ${patches.map((p) => p.name).join(', ')}`);
    const desglose = [`${eur(basePrice)} base`];
    if (conImpresion) desglose.push(`${eur(PRECIO_IMPRESION)} impresión`);
    if (conParches) desglose.push(`${eur(PRECIO_PARCHE)} parches`);
    parts.push(`Total: ${eur(total)} (${desglose.join(' + ')})`);
    parts.push(window.location.href);
    const text = parts.join('\n');

    try { await navigator.clipboard.writeText(text); setCopied(true); } catch {}
    window.open(`https://t.me/${TELEGRAM_USER}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const chip = (active: boolean, disabled: boolean) =>
    `min-w-12 rounded-lg border px-3 py-2 text-sm transition ${
      disabled ? 'cursor-not-allowed border-neutral-200 text-neutral-300 line-through'
      : active ? 'border-neutral-900 bg-neutral-900 text-white'
      : 'border-neutral-300 hover:border-neutral-900'}`;

  const inputCls =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';

  return (
    <div className="space-y-5">
      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Talla</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const disabled = !inStock(s, color);
              return <button key={s} disabled={disabled} onClick={() => setSize(s)} className={chip(size === s, disabled)}>{s}</button>;
            })}
          </div>
        </div>
      )}
      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const disabled = !inStock(size, c);
              return <button key={c} disabled={disabled} onClick={() => setColor(c)} className={chip(color === c, disabled)}>{c}</button>;
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 p-4">
        <p className="mb-3 text-sm font-semibold">Personaliza tu equipación</p>

        {players.length > 0 && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-neutral-500">Plantilla</span>
            <select value={jugadorId} onChange={(e) => elegirJugador(e.target.value)} className={inputCls}>
              <option value="">Personalizado (yo escribo el nombre)</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.number} · {p.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2">
            <span className="mb-1 block text-xs text-neutral-500">Nombre (máx. {LIMITE_NOMBRE})</span>
            <input value={nombre} onChange={(e) => setNombre(limpiarNombre(e.target.value))}
              placeholder="TU NOMBRE" className={inputCls} />
          </label>
          <label>
            <span className="mb-1 block text-xs text-neutral-500">Número</span>
            <input value={numero} inputMode="numeric"
              onChange={(e) => setNumero(limpiarNumero(e.target.value))}
              placeholder="10" className={`${inputCls} ${numeroValido ? '' : 'border-red-400'}`} />
          </label>
        </div>
        {!numeroValido && <p className="mt-1 text-xs text-red-500">El número debe estar entre 1 y 99.</p>}

        {conImpresion && (
          <p className="mt-2 text-xs text-neutral-500">Impresión de nombre/número: +{eur(PRECIO_IMPRESION)}</p>
        )}

        {patches.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-neutral-500">Parches de competiciones incluidos (+{eur(PRECIO_PARCHE)})</p>
            <ul className="flex flex-wrap gap-2">
              {patches.map((p) => (
                <li key={p.name}
                  className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700">
                  {p.logo_url && (
                    <Image src={p.logo_url} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
                  )}
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-sm text-neutral-600">
        {eur(basePrice)}
        {conImpresion && <> + {eur(PRECIO_IMPRESION)} impresión</>}
        {conParches && <> + {eur(PRECIO_PARCHE)} parches</>}
        <span className="ml-2 font-semibold text-neutral-900">= {eur(total)}</span>
      </p>

      <button onClick={order} disabled={!puedePedir}
        className="w-full rounded-full bg-sky-500 py-3.5 font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-neutral-300">
        {puedePedir ? 'Pedir por Telegram' : 'Selecciona talla / color'}
      </button>
      {copied && (
        <p className="text-center text-xs text-neutral-500">
          Mensaje copiado. Si el chat se abre vacío, pégalo en él.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the product page**

In `app/producto/[slug]/page.tsx`:

1. Add imports:

```tsx
import KitCustomizer from '@/components/KitCustomizer';
import { getProductBySlug, getPlayers, getTeamPatches } from '@/lib/queries';
import { TEMPORADA_ACTUAL } from '@/lib/temporada';
```

(the existing `getProductBySlug` import is replaced by the combined one above).

2. After `if (!p) notFound();` insert:

```tsx
  const esKitTemporada = Boolean(p.team && p.season === TEMPORADA_ACTUAL);
  const [players, patches]: [Player[], PatchBadge[]] = esKitTemporada
    ? await Promise.all([getPlayers(p.team!.id), getTeamPatches(p.team!.id)])
    : [[], []];
```

Add `PatchBadge` and `Player` to the file's type imports:

```tsx
import type { PatchBadge, Player } from '@/lib/types';
```

3. Replace the purchase block (line 49) with:

```tsx
          <div className="mt-6">
            {esKitTemporada ? (
              <KitCustomizer title={p.title} variants={p.variants}
                basePrice={p.price} players={players} patches={patches} />
            ) : (
              <ProductPurchase title={p.title} variants={p.variants} />
            )}
          </div>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: exit 0 for both (pre-existing SearchBar warning excluded).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds, no `next/image` hostname errors for patch badges.

---

### Task 5: Seed competition patches (cups + European qualifiers)

**Files:**
- Create: `supabase/seed-competiciones-2026-27.sql`

**Interfaces:**
- Consumes: `teams`, `leagues`, `regions`, `products.season` (Task 1).
- Produces: rows in `competitions` and `team_competitions` read by `getTeamPatches`.

**Authenticity**: domestic cups are deterministic (every top-flight club enters its national cup), but **European qualifiers come from the completed 2025-26 season — research them, do not guess.**

- [ ] **Step 1: Build the worklist of clubs that need patches**

Run (Supabase MCP `execute_sql`):

```sql
select t.id, t.name, r.name as region, l.name as league
  from teams t
  join leagues l on l.id = t.league_id
  join regions r on r.id = l.region_id
 where l.slug in ('premier-league','laliga','serie-a','bundesliga','ligue-1')
   and r.name in ('Inglaterra','España','Italia','Alemania','Francia')
   and exists (select 1 from products p where p.team_id = t.id and p.season = '2026-27')
 order by l.slug, t.name;
```

Save the result — every club in it gets (a) its national cup and (b) researched European qualifiers.

- [ ] **Step 2: Research European qualifiers**

For the 2025-26 final standings of Premier League, LaLiga, Serie A, Bundesliga and Ligue 1, determine which of the worklist clubs qualified for **UEFA Champions League, UEFA Europa League, UEFA Conference League** in 2026-27.

Method: `football-data` skill first (load the skill and use its league/standings data), web search as fallback. Record the source URL used. A club you cannot place in a competition gets **no row** for it (never invent).

- [ ] **Step 3: Verify patch badge image URLs**

Existing `leagues.logo_url` values use `https://www.footylogos.com/...`. Build each competition's `logo_url` in the same host/style (look at existing league rows for the exact pattern), then probe each URL (webfetch or `Invoke-WebRequest`) — **only HTTP 200 URLs may be inserted**; dead ones are left `null` (badge still renders as text).

- [ ] **Step 4: Write `supabase/seed-competiciones-2026-27.sql`**

```sql
-- Seed: competition patches 2026-27
-- Sources: <paste the source URLs used in Step 2>
-- Idempotent.

insert into competitions (name, slug, logo_url, kind) values
  ('UEFA Champions League', 'champions-league', '<verified-url>', 'continental'),
  ('UEFA Europa League',    'europa-league',    '<verified-url>', 'continental'),
  ('UEFA Conference League','conference-league', '<verified-url>', 'continental'),
  ('Copa del Rey',          'copa-del-rey',     '<verified-url>', 'copa'),
  ('FA Cup',                'fa-cup',           '<verified-url>', 'copa'),
  ('Coppa Italia',          'coppa-italia',     '<verified-url>', 'copa'),
  ('DFB-Pokal',             'dfb-pokal',        '<verified-url>', 'copa'),
  ('Coupe de France',       'coupe-de-france',  '<verified-url>', 'copa')
on conflict (slug) do nothing;

-- National cups: every top-flight club with a 2026-27 kit plays its cup
insert into team_competitions (team_id, competition_id)
select t.id, c.id
  from teams t
  join leagues l on l.id = t.league_id
  join regions r on r.id = l.region_id
  join competitions c on c.slug = case r.name
        when 'Inglaterra' then 'fa-cup'
        when 'España'     then 'copa-del-rey'
        when 'Italia'     then 'coppa-italia'
        when 'Alemania'   then 'dfb-pokal'
        when 'Francia'    then 'coupe-de-france'
      end
 where l.slug in ('premier-league','laliga','serie-a','bundesliga','ligue-1')
   and exists (select 1 from products p where p.team_id = t.id and p.season = '2026-27')
on conflict do nothing;

-- European qualifiers researched in Step 2 (explicit, one line per club)
insert into team_competitions (team_id, competition_id)
select t.id, c.id from teams t, competitions c
 where (t.name, c.slug) in (
   ('<club name>', 'champions-league'),
   ('<club name>', 'europa-league'),
   ('<club name>', 'conference-league')
   -- ...one tuple per researched club/competition pair
   )
   and c.kind = 'continental'
on conflict do nothing;
```

Replace every `<...>` with researched/verified values before running. If `(t.name, c.slug)` is ambiguous (duplicate club names), switch that block to explicit `t.id` UUIDs from Step 1.

- [ ] **Step 5: Execute and verify**

Apply via `execute_sql` (or `apply_migration` with `name: "seed_competiciones_2026_27"`), then run:

```sql
select c.kind, count(*) as pairs
  from team_competitions tc join competitions c on c.id = tc.competition_id
 group by c.kind;

-- clubs with a 2026-27 kit that have NO patch at all (league badge excluded) — expect only
-- clubs whose league lacks a logo (Paraguay is not in scope, so expect 0 rows)
select t.name from teams t
 where exists (select 1 from products p where p.team_id = t.id and p.season='2026-27')
   and not exists (select 1 from team_competitions tc where tc.team_id = t.id)
   and t.league_id in (select id from leagues where slug in
        ('premier-league','laliga','serie-a','bundesliga','ligue-1'));
```

**Expected**: `copa` pairs ≈ number of worklist clubs; `continental` pairs > 0 and matches your research notes; second query returns 0 rows.

---

### Tasks 6–10: Authentic squad seeds, one task per league

Each league task is structurally identical; run them in this order: **Task 6 Premier League, Task 7 LaLiga, Task 8 Serie A, Task 9 Bundesliga, Task 10 Ligue 1**. They all write into the SAME file `supabase/seed-plantillas-2026-27.sql`, each appending its own `-- ===== <LEAGUE> =====` block.

**Files:**
- Create/Modify: `supabase/seed-plantillas-2026-27.sql`

**Interfaces:**
- Consumes: `players`, `teams`, `products.season` (Task 1).
- Produces: `players` rows read by `getPlayers`.

**Shared authenticity rules (apply to every league task):**
- Squad must be the club's **actual 2026-27 first-team squad with real shirt numbers**.
- Sources in order: `football-data` skill → web search (`"<club> 2026-27 squad numbers"`).
- **A club is skipped entirely if any number cannot be verified** — write `-- SKIPPED <club>: <reason>` as a comment instead of rows.
- Every block carries a `-- Source: <url>` comment.
- Validate: names uppercased only inside the app (store them naturally cased), numbers 1–99, unique per club.

---

### Task 6: Premier League squads

- [ ] **Step 1: Worklist**

```sql
select t.id, t.name,
       (select count(*) from products p where p.team_id = t.id and p.season='2026-27') as kits
  from teams t join leagues l on l.id=t.league_id join regions r on r.id=l.region_id
 where l.slug='premier-league' and r.name='Inglaterra'
 order by kits desc, t.name;
```

Only clubs with `kits > 0` need squads. Save the list with team UUIDs.

- [ ] **Step 2: Research each club**

For every club in the list, fetch its 2026-27 first-team squad with shirt numbers (football-data skill, then web search). Note the source URL per club. Mark unverifiable clubs `-- SKIPPED`.

- [ ] **Step 3: Append the SQL block**

```sql
-- ===== PREMIER LEAGUE =====
-- Source: <urls>
insert into players (team_id, name, number) values
  ('<team-uuid>', 'Player Name', 1),
  ('<team-uuid>', 'Player Name', 2)
  -- ... all verified clubs
on conflict (team_id, number) do nothing;
-- SKIPPED <club>: <reason>
```

- [ ] **Step 4: Execute**

Run the file via `execute_sql` (whole file is idempotent, so re-running earlier blocks is safe).

- [ ] **Step 5: Verify**

```sql
select t.name,
       (select count(*) from players p where p.team_id=t.id) as players,
       (select count(distinct p.number) from players p where p.team_id=t.id) as distinct_numbers,
       (select count(*) from players p where p.team_id=t.id and (p.number<1 or p.number>99)) as bad_numbers
  from teams t join leagues l on l.id=t.league_id join regions r on r.id=l.region_id
 where l.slug='premier-league' and r.name='Inglaterra'
   and exists (select 1 from products p where p.team_id=t.id and p.season='2026-27')
 order by players desc;
```

**Expected**: `players = distinct_numbers` for every seeded club (0 rows with mismatch), `bad_numbers = 0`, every non-skipped club has 15+ players.

- [ ] **Step 6: Authenticity spot-check**

Pick 3 seeded clubs; re-fetch their squad from the source and compare **5 name/number pairs each** against the DB. Zero mismatches required — fix any discrepancy in the SQL and re-run Step 4.

---

### Task 7: LaLiga squads

**Files:** Modify `supabase/seed-plantillas-2026-27.sql` (append one block)

**Interfaces:** Consumes `players`, `teams`, `products.season` (Task 1). Produces `players` rows read by `getPlayers`. Authenticity rules are the block at the top of Tasks 6–10 and apply verbatim.

- [ ] **Step 1: Worklist**

```sql
select t.id, t.name,
       (select count(*) from products p where p.team_id = t.id and p.season='2026-27') as kits
  from teams t join leagues l on l.id=t.league_id join regions r on r.id=l.region_id
 where l.slug='laliga' and r.name='España'
 order by kits desc, t.name;
```

Only clubs with `kits > 0` need squads. Save the list with team UUIDs.

- [ ] **Step 2: Research each club**

Fetch each listed club's actual 2026-27 first-team squad with shirt numbers (football-data skill first, web search `"<club> 2026-27 squad numbers"` fallback). Record the source URL per club. If any number cannot be verified, mark the club `-- SKIPPED <club>: <reason>` and insert no rows for it.

- [ ] **Step 3: Append the SQL block**

```sql
-- ===== LALIGA =====
-- Source: <urls from Step 2>
insert into players (team_id, name, number) values
  ('<team-uuid>', 'Player Name', 1),
  ('<team-uuid>', 'Player Name', 2)
  -- ... every verified club; numbers 1-99 and unique per club
on conflict (team_id, number) do nothing;
-- SKIPPED <club>: <reason>
```

- [ ] **Step 4: Execute**

Run the whole file via Supabase `execute_sql` — it is idempotent, so re-running earlier blocks is safe.

- [ ] **Step 5: Verify**

```sql
select t.name,
       (select count(*) from players p where p.team_id=t.id) as players,
       (select count(distinct p.number) from players p where p.team_id=t.id) as distinct_numbers,
       (select count(*) from players p where p.team_id=t.id and (p.number<1 or p.number>99)) as bad_numbers
  from teams t join leagues l on l.id=t.league_id join regions r on r.id=l.region_id
 where l.slug='laliga' and r.name='España'
   and exists (select 1 from products p where p.team_id=t.id and p.season='2026-27')
 order by players desc;
```

**Expected**: `players = distinct_numbers` for every seeded club, `bad_numbers = 0`, every non-skipped club has 15+ players.

- [ ] **Step 6: Authenticity spot-check**

Pick 3 seeded clubs; re-fetch their squads from the source and compare **5 name/number pairs each** against the DB. Zero mismatches — fix any discrepancy in the SQL and re-run Step 4.

---

### Task 8: Serie A squads

**Files:** Modify `supabase/seed-plantillas-2026-27.sql` (append one block)

**Interfaces:** Consumes `players`, `teams`, `products.season` (Task 1). Produces `players` rows read by `getPlayers`. Authenticity rules at the top of Tasks 6–10 apply verbatim.

- [ ] **Step 1: Worklist**

```sql
select t.id, t.name,
       (select count(*) from products p where p.team_id = t.id and p.season='2026-27') as kits
  from teams t join leagues l on l.id=t.league_id join regions r on r.id=l.region_id
 where l.slug='serie-a' and r.name='Italia'
 order by kits desc, t.name;
```

Only clubs with `kits > 0` need squads. Save the list with team UUIDs.

- [ ] **Step 2: Research each club**

Fetch each listed club's actual 2026-27 first-team squad with shirt numbers (football-data skill first, web search fallback). Record the source URL per club. Unverifiable club → `-- SKIPPED <club>: <reason>`, no rows.

- [ ] **Step 3: Append the SQL block**

```sql
-- ===== SERIE A =====
-- Source: <urls from Step 2>
insert into players (team_id, name, number) values
  ('<team-uuid>', 'Player Name', 1),
  ('<team-uuid>', 'Player Name', 2)
  -- ... every verified club; numbers 1-99 and unique per club
on conflict (team_id, number) do nothing;
-- SKIPPED <club>: <reason>
```

- [ ] **Step 4: Execute**

Run the whole file via `execute_sql` (idempotent).

- [ ] **Step 5: Verify**

Same query as Task 7 Step 5 with `where l.slug='serie-a' and r.name='Italia'`.
**Expected**: `players = distinct_numbers`, `bad_numbers = 0`, non-skipped clubs ≥ 15 players.

- [ ] **Step 6: Authenticity spot-check**

3 seeded clubs × 5 name/number pairs vs source; zero mismatches or fix + re-run Step 4.

---

### Task 9: Bundesliga squads

**Files:** Modify `supabase/seed-plantillas-2026-27.sql` (append one block)

**Interfaces:** Consumes `players`, `teams`, `products.season` (Task 1). Produces `players` rows read by `getPlayers`. Authenticity rules at the top of Tasks 6–10 apply verbatim.

- [ ] **Step 1: Worklist**

```sql
select t.id, t.name,
       (select count(*) from products p where p.team_id = t.id and p.season='2026-27') as kits
  from teams t join leagues l on l.id=t.league_id join regions r on r.id=l.region_id
 where l.slug='bundesliga' and r.name='Alemania'
 order by kits desc, t.name;
```

Only clubs with `kits > 0` need squads. Save the list with team UUIDs.

- [ ] **Step 2: Research each club**

Fetch each listed club's actual 2026-27 first-team squad with shirt numbers (football-data skill first, web search fallback). Record the source URL per club. Unverifiable club → `-- SKIPPED <club>: <reason>`, no rows.

- [ ] **Step 3: Append the SQL block**

```sql
-- ===== BUNDESLIGA =====
-- Source: <urls from Step 2>
insert into players (team_id, name, number) values
  ('<team-uuid>', 'Player Name', 1),
  ('<team-uuid>', 'Player Name', 2)
  -- ... every verified club; numbers 1-99 and unique per club
on conflict (team_id, number) do nothing;
-- SKIPPED <club>: <reason>
```

- [ ] **Step 4: Execute**

Run the whole file via `execute_sql` (idempotent).

- [ ] **Step 5: Verify**

Same query as Task 7 Step 5 with `where l.slug='bundesliga' and r.name='Alemania'`.
**Expected**: `players = distinct_numbers`, `bad_numbers = 0`, non-skipped clubs ≥ 15 players.

- [ ] **Step 6: Authenticity spot-check**

3 seeded clubs × 5 name/number pairs vs source; zero mismatches or fix + re-run Step 4.

---

### Task 10: Ligue 1 squads

**Files:** Modify `supabase/seed-plantillas-2026-27.sql` (append one block)

**Interfaces:** Consumes `players`, `teams`, `products.season` (Task 1). Produces `players` rows read by `getPlayers`. Authenticity rules at the top of Tasks 6–10 apply verbatim.

- [ ] **Step 1: Worklist**

```sql
select t.id, t.name,
       (select count(*) from products p where p.team_id = t.id and p.season='2026-27') as kits
  from teams t join leagues l on l.id=t.league_id join regions r on r.id=l.region_id
 where l.slug='ligue-1' and r.name='Francia'
 order by kits desc, t.name;
```

Only clubs with `kits > 0` need squads. Save the list with team UUIDs.

- [ ] **Step 2: Research each club**

Fetch each listed club's actual 2026-27 first-team squad with shirt numbers (football-data skill first, web search fallback). Record the source URL per club. Unverifiable club → `-- SKIPPED <club>: <reason>`, no rows.

- [ ] **Step 3: Append the SQL block**

```sql
-- ===== LIGUE 1 =====
-- Source: <urls from Step 2>
insert into players (team_id, name, number) values
  ('<team-uuid>', 'Player Name', 1),
  ('<team-uuid>', 'Player Name', 2)
  -- ... every verified club; numbers 1-99 and unique per club
on conflict (team_id, number) do nothing;
-- SKIPPED <club>: <reason>
```

- [ ] **Step 4: Execute**

Run the whole file via `execute_sql` (idempotent).

- [ ] **Step 5: Verify**

Same query as Task 7 Step 5 with `where l.slug='ligue-1' and r.name='Francia'`.
**Expected**: `players = distinct_numbers`, `bad_numbers = 0`, non-skipped clubs ≥ 15 players.

- [ ] **Step 6: Authenticity spot-check**

3 seeded clubs × 5 name/number pairs vs source; zero mismatches or fix + re-run Step 4.

---

### Task 11: Final verification

**Files:** none created (read-only checks + fixes only if a check fails).

- [ ] **Step 1: Static checks**

Run: `npx tsc --noEmit` && `npm run lint` && `npm run build`
Expected: all exit 0 (the pre-existing `SearchBar.tsx` react-hooks warning is known and not a failure).

- [ ] **Step 2: Pick real slugs for the four route checks**

```sql
-- club from a top league with squad + patches (expect: crest, patch row, kit grid)
select r.slug, l.slug, t.slug from teams t
  join leagues l on l.id=t.league_id join regions r on r.id=l.region_id
 where exists (select 1 from players p where p.team_id=t.id)
   and exists (select 1 from products p where p.team_id=t.id and p.season='2026-27')
 limit 1;
-- small club outside top-5 (expect: crest + league badge, NO squad dropdown)
select r.slug, l.slug, t.slug from teams t
  join leagues l on l.id=t.league_id join regions r on r.id=l.region_id
 where l.slug not in ('premier-league','laliga','serie-a','bundesliga','ligue-1')
   and exists (select 1 from products p where p.team_id=t.id and p.season='2026-27')
 limit 1;
-- customisable product + plain product slugs
select slug from products where team_id is not null and season='2026-27' limit 1;
select slug from products where team_id is null limit 1;
```

- [ ] **Step 3: Probe the routes**

Start the production server (`npm run build && npm start` in background), then request each URL:

1. `/equipaciones/<region>/<liga>/<equipo>` (top club) → 200, contains club name and ≥2 patch badges
2. `/equipaciones/<region>/<liga>/<equipo>` (small club) → 200
3. `/producto/<customisable-slug>` → 200, HTML contains `Personaliza tu equipación`
4. `/producto/<plain-slug>` → 200, HTML does NOT contain `Personaliza tu equipación`

Expected: all 200, content assertions hold. Stop the server afterwards.

- [ ] **Step 4: Authenticity spot-check (global)**

Re-run the Task 6 Step 6 spot-check across **any 3 clubs from different leagues** (5 name/number pairs each, vs their source). Zero mismatches.

- [ ] **Step 5: Report**

Summarize: static checks green, four routes passing, squads seeded (per league counts + skipped clubs with reasons), competitions seeded (counts), and any product found in Step 1 with `linked w/o season = 0`.
