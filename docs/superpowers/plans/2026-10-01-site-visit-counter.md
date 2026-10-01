# Site Visit Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a public total of catalog page views on the home page, backed by an atomic counter in Postgres that bots cannot inflate.

**Architecture:** Four independent pieces. A singleton `site_visits` row plus a `security definer` Postgres function own the number. A pure decision function in `lib/visitas.ts` decides whether a request is a real human page view (bot filter, then rate limit). A UI-less client component mounted in the root layout reports one visit per mount via `sendBeacon`. A server component on the home page reads the total and renders the trust row.

**Tech Stack:** Next.js 16.3.6 (App Router), React 19.2.8, `@supabase/supabase-js` 2.117.2 (anon key only), Tailwind CSS 4, vitest 4.1.11, Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-10-01-site-visit-counter-design.md`

## Global Constraints

- These constraints apply to every task. Do not deviate without changing this plan.
- **Spec is authoritative.** `docs/superpowers/specs/2026-10-01-site-visit-counter-design.md` was reviewed and approved. Any task that contradicts it is wrong.
- **Repo language convention:** file names, function names, identifiers and code comments in Spanish. This plan and all code written in it are in English.
- **Code style:** 2-space indent, single quotes, semicolons, no trailing commas at call sites (match the existing files).
- **No new dependencies.** Everything here uses packages already in `package.json`.
- **No service-role key.** The app only ever has `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The anon key can increment the counter *only* through the RPC, never by writing the table.
- **Tests:** vitest, files in `tests/**/*.test.ts`, `environment: 'node'`, imports use relative paths (`'../lib/visitas'`), never `@/lib/...`. No test-alias config exists and this plan does not add one.
- **Verification commands:** `npm test` (all tests), `npx tsc --noEmit` (typecheck), `npm run lint` (ESLint). Run at minimum the ones named in each task.
- **Never stage `components/ProductCard.tsx`.** The owner has uncommitted changes in it that predate this work. Every commit in this plan lists its exact paths; do not use `git add .` or `git commit -a`.
- **Never stage untracked captures:** `.prod-desktop.png`, `.prod-mobile.png`, `scripts/_captura-prod.mjs`.

---

### Task 1: Bot and preview-crawler filter

**Files:**
- Create: `lib/bots.ts`
- Test: `tests/bots.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `esBot(userAgent: string): boolean` from `lib/bots.ts`. Consumed by Task 2.

- [ ] **Step 1: Write the failing test**

Create `tests/bots.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { esBot } from '../lib/bots';

const NAVEGADORES = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
];

const AUTOMATIZADOS = [
  'TelegramBot (like TwitterBot)',
  'WhatsApp/2.23.20.0',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36',
  'curl/8.4.0',
  'python-requests/2.32.3',
];

describe('esBot', () => {
  it('no marca los navegadores reales', () => {
    for (const ua of NAVEGADORES) expect(esBot(ua), ua).toBe(false);
  });

  it('no marca un user-agent mínimo de navegador', () => {
    expect(esBot('Mozilla/5.0')).toBe(false);
  });

  it('marca crawlers, previews y clientes automatizados', () => {
    for (const ua of AUTOMATIZADOS) expect(esBot(ua), ua).toBe(true);
  });

  it('trata la ausencia de user-agent como no humano', () => {
    // Ningún navegador omite el suyo, así que un UA vacío nunca es una visita real.
    expect(esBot('')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/bots.test.ts`

Expected: FAIL with `Failed to resolve import "../lib/bots"` / `Cannot find module '../lib/bots'`.

- [ ] **Step 3: Write the implementation**

Create `lib/bots.ts`:

```ts
/**
 * User agents que no son una visita real. Los previews de Telegram, WhatsApp y
 * Slack piden la URL compartida sin que nadie llegue a ver la página, así que
 * son los que más distorsionan el contador.
 */
const NO_HUMANO =
  /bot|crawl|spider|slurp|facebookexternalhit|telegram|whatsapp|preview|curl|wget|python-requests|headless|phantomjs|pingdom|gtmetrix|lighthouse|ahrefs|semrush/i;

/**
 * ¿La petición viene de un bot o de un previsualizador? Entonces no cuenta.
 * Un user-agent vacío también cuenta como no humano: ningún navegador omite el suyo.
 */
export function esBot(userAgent: string): boolean {
  if (!userAgent.trim()) return true;
  return NO_HUMANO.test(userAgent);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/bots.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Run the whole suite to confirm nothing broke**

Run: `npm test`

Expected: PASS, all existing tests plus the 3 new ones.

- [ ] **Step 6: Commit**

```bash
git add lib/bots.ts tests/bots.test.ts
git commit -m "feat: filter bot and preview user agents"
```

---

### Task 2: Visit-acceptance decision, as pure logic

**Files:**
- Create: `lib/visitas.ts`
- Test: `tests/visitas.test.ts`

**Interfaces:**
- Consumes: `esBot(userAgent: string): boolean` from `lib/bots.ts` (Task 1).
- Produces, from `lib/visitas.ts`:
  - `LIMITE_VISITAS_HORA: number` (120)
  - `VENTANA_VISITAS_MS: number` (3_600_000)
  - `DecisionVisita = { cuenta: true } | { cuenta: false; motivo: 'bot' | 'rate_limited' }`
  - `decisionVisita(userAgent: string, consumirCupo: () => boolean): DecisionVisita`

  Consumed by Task 4 (`app/api/visita/route.ts`).

**Why the quota is a callback:** a bot must not consume the visitor's rate-limit budget. Passing `consumirCupo` lazily makes that ordering explicit and testable instead of leaving it to whichever branch the route happens to check first.

- [ ] **Step 1: Write the failing test**

Create `tests/visitas.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { decisionVisita, LIMITE_VISITAS_HORA, VENTANA_VISITAS_MS } from '../lib/visitas';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

describe('decisionVisita', () => {
  it('cuenta una visita de navegador dentro del límite', () => {
    const consumirCupo = vi.fn(() => true);
    expect(decisionVisita(CHROME, consumirCupo)).toEqual({ cuenta: true });
    expect(consumirCupo).toHaveBeenCalledTimes(1);
  });

  it('rechaza por cuota agotada sin distinguish el motivo del anterior', () => {
    expect(decisionVisita(CHROME, () => false)).toEqual({
      cuenta: false,
      motivo: 'rate_limited',
    });
  });

  it('descarta bots antes de tocar la cuota', () => {
    const consumirCupo = vi.fn(() => true);
    expect(decisionVisita('TelegramBot (like TwitterBot)', consumirCupo)).toEqual({
      cuenta: false,
      motivo: 'bot',
    });
    expect(consumirCupo).not.toHaveBeenCalled();
  });

  it('un bot ni siquiera llega a la cuota aunque ya esté agotada', () => {
    const consumirCupo = vi.fn(() => false);
    expect(decisionVisita('Googlebot/2.1', consumirCupo).motivo).toBe('bot');
    expect(consumirCupo).not.toHaveBeenCalled();
  });
});

describe('cupo por defecto', () => {
  it('permite 120 visitas por hora y una ventana de una hora', () => {
    expect(LIMITE_VISITAS_HORA).toBe(120);
    expect(VENTANA_VISITAS_MS).toBe(3_600_000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/visitas.test.ts`

Expected: FAIL with `Failed to resolve import "../lib/visitas"`.

- [ ] **Step 3: Write the implementation**

Create `lib/visitas.ts`:

```ts
import { esBot } from './bots';

/** Holgado para un visitante que recorre veinte fichas; corto contra el inflado trivial. */
export const LIMITE_VISITAS_HORA = 120;
export const VENTANA_VISITAS_MS = 3_600_000;

export type MotivoSinVisita = 'bot' | 'rate_limited';
export type DecisionVisita = { cuenta: true } | { cuenta: false; motivo: MotivoSinVisita };

/**
 * ¿Esta petición cuenta como visita? El filtro de bots va primero y la cuota se
 * consume solo si la petición es de una persona: un crawler no puede agotarle el
 * cupo a un visitante real.
 */
export function decisionVisita(userAgent: string, consumirCupo: () => boolean): DecisionVisita {
  if (esBot(userAgent)) return { cuenta: false, motivo: 'bot' };
  if (!consumirCupo()) return { cuenta: false, motivo: 'rate_limited' };
  return { cuenta: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/visitas.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/visitas.ts tests/visitas.test.ts
git commit -m "feat: decide whether a request counts as a visit"
```

---

### Task 3: The counter itself, in the database

**Files:**
- Create: `supabase/2026-10-01-contador-visitas.sql`
- Modify: `lib/queries.ts` — add `getVisitasTienda()` after `getNotaTienda()`, next to the other review queries.

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces:
  - Postgres: table `public.site_visits(id smallint, total bigint, updated_at timestamptz)`, function `public.incrementar_visitas() returns bigint`.
  - `getVisitasTienda(): Promise<number>` from `lib/queries.ts`. Consumed by Task 6 (`app/page.tsx`).

**This is live-database DDL on the production project.** Apply it once, verify it, and do not re-apply. `supabase/schema.sql` is not updated: it is already stale (it has no `reviews` table), and the repo's convention is one dated file per migration under `supabase/`.

- [ ] **Step 1: Record the migration in the repo**

Create `supabase/2026-10-01-contador-visitas.sql`:

```sql
-- Contador público de visitas de la tienda.
-- Una única fila que nunca crece: el total se incrementa dentro de Postgres,
-- así dos peticiones simultáneas no se pisan entre sí.

create table if not exists public.site_visits (
  id smallint primary key default 1 check (id = 1),
  total bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.site_visits (id, total) values (1, 0) on conflict (id) do nothing;

create or replace function public.incrementar_visitas()
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.site_visits
     set total = total + 1,
         updated_at = now()
   where id = 1
  returning total;
$$;

-- La anon solo lee; el incremento ocurre dentro de la función.
revoke insert, update, delete on public.site_visits from anon, authenticated;
grant select on public.site_visits to anon, authenticated;
grant execute on function public.incrementar_visitas() to anon, authenticated;

alter table public.site_visits enable row level security;

create policy "site_visits se lee publicamente"
  on public.site_visits for select
  to anon, authenticated
  using (true);
```

- [ ] **Step 2: Apply it to the database**

Use the `supabase_apply_migration` tool with name `add_site_visit_counter` and the exact SQL from Step 1. Re-running it is safe (`if not exists`, `on conflict do nothing`, `create or replace`, and `create policy` is not `if not exists` — if the policy already exists the tool will report an error, which means the migration already ran: go to Step 3 and confirm the state).

- [ ] **Step 3: Verify the counter increments atomically**

Use `supabase_execute_sql` with:

```sql
select public.incrementar_visitas() as primera,
       public.incrementar_visitas() as segunda,
       (select total from public.site_visits) as total;
```

Expected: `primera = 1`, `segunda = 2`, `total = 2`.

- [ ] **Step 4: Verify the anon role cannot write the counter**

Use `supabase_execute_sql` with:

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'site_visits'
order by grantee, privilege_type;
```

Expected: rows only for `anon` and `authenticated` with `privilege_type = 'SELECT'`. Any `INSERT`, `UPDATE` or `DELETE` grant means the `revoke` did not take effect — fix the grants before continuing.

- [ ] **Step 5: Reset the counter so the store starts at zero**

Use `supabase_execute_sql` with:

```sql
update public.site_visits set total = 0, updated_at = now() where id = 1 returning total;
```

Expected: `total = 0`. These two verification increments were never real traffic.

- [ ] **Step 6: Add the read query**

In `lib/queries.ts`, immediately after the `getNotaTienda` function (the last function in the "Reseñas" section), add:

```ts
// ----- Visitas -----
/** Total de visitas de la tienda. Si la fila no existe o no se puede leer, 0. */
export async function getVisitasTienda(): Promise<number> {
  const { data } = await supabase.from('site_visits').select('total').eq('id', 1).maybeSingle();
  return (data as { total: number } | null)?.total ?? 0;
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors. `supabase` is an untyped client here, so the cast on `data` is required.

- [ ] **Step 8: Commit**

```bash
git add supabase/2026-10-01-contador-visitas.sql lib/queries.ts
git commit -m "feat: site visit counter table and read query"
```

---

### Task 4: The recorder route

**Files:**
- Create: `app/api/visita/route.ts`

**Interfaces:**
- Consumes: `decisionVisita`, `LIMITE_VISITAS_HORA`, `VENTANA_VISITAS_MS` from `lib/visitas.ts` (Task 2); `permitir` from `lib/rate-limit.ts` (existing); `supabase` from `lib/supabase.ts` (existing).
- Produces: `POST /api/visita` → `200 { ok: true, total: number }` | `202 { ok: false, skipped: 'bot' }` | `429 { ok: false, error: 'rate_limited' }` | `502 { ok: false, error: 'db' }`. Consumed by Task 5's beacon.

- [ ] **Step 1: Write the route**

Create `app/api/visita/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { permitir } from '@/lib/rate-limit';
import { supabase } from '@/lib/supabase';
import { LIMITE_VISITAS_HORA, VENTANA_VISITAS_MS, decisionVisita } from '@/lib/visitas';

// Una visita = una página cargada. El beacon no manda nada: solo pide un +1.
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocido';

  const decision = decisionVisita(req.headers.get('user-agent') ?? '', () =>
    permitir(`visita:${ip}`, Date.now(), LIMITE_VISITAS_HORA, VENTANA_VISITAS_MS),
  );

  if (!decision.cuenta) {
    return decision.motivo === 'bot'
      ? NextResponse.json({ ok: false, skipped: 'bot' }, { status: 202 })
      : NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const { data, error } = await supabase.rpc('incrementar_visitas');
  if (error) return NextResponse.json({ ok: false, error: 'db' }, { status: 502 });

  return NextResponse.json({ ok: true, total: data as number });
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

Expected: no type errors, no ESLint errors.

- [ ] **Step 3: Confirm the route does not break the existing API**

Run: `npm test`

Expected: PASS. No existing test touches app routes, so this is a guard against accidental import breakage.

- [ ] **Step 4: Commit**

```bash
git add app/api/visita/route.ts
git commit -m "feat: record a visit through POST /api/visita"
```

---

### Task 5: The beacon

**Files:**
- Create: `components/ContadorVisitas.tsx`
- Modify: `app/layout.tsx` — import and render it inside `<CestaProvider>`.

**Interfaces:**
- Consumes: nothing from other tasks; `POST /api/visita` from Task 4 at runtime.
- Produces: `export default function ContadorVisitas(): null`.

**Why mount-time and not render-time:** Next.js prefetching a `<Link>` fetches the RSC payload but never runs the destination page's client component, so no beacon fires until the visitor actually navigates there. That is what keeps prefetches out of the number.

- [ ] **Step 1: Write the beacon component**

Create `components/ContadorVisitas.tsx`:

```tsx
'use client';
import { useEffect, useRef } from 'react';

/** Avisa de una visita al montar. No pinta nada: solo dispara el registro. */
export default function ContadorVisitas() {
  const reportado = useRef(false);

  useEffect(() => {
    // El doble montaje de StrictMode en desarrollo contaría dos veces la misma visita.
    if (reportado.current) return;
    reportado.current = true;

    const url = '/api/visita';
    if (navigator.sendBeacon?.(url)) return;
    void fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
  }, []);

  return null;
}
```

- [ ] **Step 2: Mount it in the root layout**

In `app/layout.tsx`, add the import in alphabetical order among the component imports — after `CestaProvider` and before `Footer`:

```tsx
import ContadorVisitas from '@/components/ContadorVisitas';
```

Then render it as the first child inside `<CestaProvider>`, before `<Header />`:

```tsx
<CestaProvider>
  <ContadorVisitas />
  <Header />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

Expected: no type errors, no ESLint errors.

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: build succeeds. This is the gate that the client component compiles in a Server Component tree.

- [ ] **Step 5: Commit**

```bash
git add components/ContadorVisitas.tsx app/layout.tsx
git commit -m "feat: report a visit from the root layout"
```

---

### Task 6: The trust block on the home page

**Files:**
- Create: `components/BloqueConfianza.tsx`
- Modify: `app/page.tsx` — fetch the two extra numbers and render the block between the hero banner and "Categorías".

**Interfaces:**
- Consumes: `getVisitasTienda(): Promise<number>` from `lib/queries.ts` (Task 3); `getNotaTienda(): Promise<{ media: number; total: number }>` and `getResenasTienda` (existing); `Estrellas` from `components/Estrellas.tsx` (existing).
- Produces: `export default function BloqueConfianza({ media, opiniones, visitas }: { media: number; opiniones: number; visitas: number }): JSX.Element | null`.

- [ ] **Step 1: Write the trust block**

Create `components/BloqueConfianza.tsx`:

```tsx
import Estrellas from './Estrellas';

const NUMERO = new Intl.NumberFormat('es-ES');

/**
 * Fila de confianza de la portada: nota media, número de opiniones y visitas.
 * Cada dato se pinta solo si tiene valor; sin ninguno, no se pinta nada.
 */
export default function BloqueConfianza({
  media,
  opiniones,
  visitas,
}: {
  media: number;
  opiniones: number;
  visitas: number;
}) {
  const hayOpinion = opiniones > 0 && media > 0;
  const hayVisitas = visitas > 0;
  if (!hayOpinion && !hayVisitas) return null;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted">
      {hayOpinion && (
        <span className="inline-flex items-center gap-1.5">
          <Estrellas valor={media} className="h-3 w-3" />
          <span className="font-semibold text-ink">{media.toFixed(1).replace('.', ',')}</span>
          <span>{opiniones === 1 ? 'opinión' : 'opiniones'}</span>
        </span>
      )}

      {hayOpinion && hayVisitas && (
        <span aria-hidden className="select-none">
          ·
        </span>
      )}

      {hayVisitas && (
        <span className="inline-flex items-center gap-1.5">
          <Ojo className="h-3.5 w-3.5" />
          <span className="font-semibold text-ink">{NUMERO.format(visitas)}</span>
          <span>{visitas === 1 ? 'visita' : 'visitas'}</span>
        </span>
      )}
    </div>
  );
}

/** Mismo lenguaje visual que las estrellas de Estrellas: icono SVG, no emoji. */
function Ojo({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
      className={className}
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
```

`media.toFixed(1).replace('.', ',')` is the exact expression already used by `components/Resenas.tsx` for the average, so the two pages cannot disagree on how a rating reads.

- [ ] **Step 2: Wire it into the home page**

This is an additive edit: two imports, one data line, one JSX element. Do not rename or restructure anything that already exists in `app/page.tsx`.

Extend the existing import from `@/lib/queries` (currently `getCategoriesWithCounts, getResenasTienda`) to:

```tsx
import { getCategoriesWithCounts, getNotaTienda, getResenasTienda, getVisitasTienda } from '@/lib/queries';
```

Add the component import above the existing `CategoryGrid` import, since `BloqueConfianza` sorts first:

```tsx
import BloqueConfianza from '@/components/BloqueConfianza';
```

Add one line directly after the existing `const resenas = await getResenasTienda(3);`, leaving the two lines above it untouched:

```tsx
  const [nota, visitas] = await Promise.all([getNotaTienda(), getVisitasTienda()]);
```

Insert the trust block between the hero banner's closing `</section>` and the `{/* Categorías — única navegación de la portada */}` comment:

```tsx
      <BloqueConfianza media={nota.media} opiniones={nota.total} visitas={visitas} />
```

That is the whole change to this file: two import lines, one data line, one JSX element. Everything else — the `categories` filter, the "Opiniones" guard, `ResenasDestacadas` — stays exactly as it is.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

Expected: no type errors, no ESLint errors.

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/BloqueConfianza.tsx app/page.tsx
git commit -m "feat: show visit counter in the home trust block"
```

---

### Task 7: Verify the whole thing against a running app

**Files:** none. This task changes no code unless it finds a bug, in which case fix it, re-run the gate for the owning task, and commit that fix on its own.

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: nothing. This is the acceptance gate.

- [ ] **Step 1: Run the automated gates**

Run: `npm test`

Expected: PASS — every pre-existing test plus the 9 new ones (4 in `tests/bots.test.ts`, 5 in `tests/visitas.test.ts`).

- [ ] **Step 2: Confirm the counter is at zero to start from**

Use `supabase_execute_sql` with `select total from public.site_visits;`

Expected: `total = 0`.

- [ ] **Step 3: Start the dev server**

Run, in the repo root: `npm run dev`

Wait until it reports the local URL (default `http://localhost:3000`). Leave it running for the next steps.

- [ ] **Step 4: Two real page views count**

Run, in a second shell:

```powershell
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
1..2 | ForEach-Object { (Invoke-WebRequest -Uri http://localhost:3000/api/visita -Method POST -Headers @{ 'User-Agent' = $ua; 'x-forwarded-for' = '203.0.113.9' }).Content }
```

Expected: two JSON bodies, each `"ok":true`, with `"total":1` then `"total":2`.

- [ ] **Step 5: A Telegram preview does not count**

```powershell
$r = Invoke-WebRequest -Uri http://localhost:3000/api/visita -Method POST -Headers @{ 'User-Agent' = 'TelegramBot (like TwitterBot)'; 'x-forwarded-for' = '203.0.113.10' }
$r.StatusCode; $r.Content
```

Expected: status `202` and `"skipped":"bot"`. Confirm the total is still 2 with `select total from public.site_visits;`.

- [ ] **Step 6: The number is visible on the home page**

Open `http://localhost:3000/` in a browser and confirm the trust row appears between the hero banner and "Categorías", reading the rating (if store reviews exist) and the visit count.

Reload the page once and confirm the number goes up by **exactly one**, not two. A reload is a page view, so it must count; and `reactStrictMode` is on by default in Next.js, so this step is also the check that the `useRef` guard in `ContadorVisitas` is doing its job. If it goes up by two, the guard is broken — fix Task 5 before continuing.

- [ ] **Step 7: Check a product page and a category page also count**

Open one product page (`/producto/<slug>`) and one category page. Confirm the total increases once per navigation.

- [ ] **Step 8: Reset the counter so the store starts clean**

Use `supabase_execute_sql` with `update public.site_visits set total = 0, updated_at = now() where id = 1 returning total;`

Expected: `total = 0`. Steps 4–7 were verification traffic, not customers.

- [ ] **Step 9: Stop the dev server and confirm the tree is clean**

Stop the dev server, then run: `git status --short`

Expected: only the owner's pre-existing entries — ` M components/ProductCard.tsx`, `?? .prod-desktop.png`, `?? .prod-mobile.png`, `?? scripts/_captura-prod.mjs`. Nothing from this plan left uncommitted.

---

## Deploying after the plan is done

Not part of the tasks above, because pushing to `main` triggers the Vercel auto-deploy and should be the owner's explicit call:

1. `git push origin main`
2. On `https://kova-zone.vercel.app`, load the home page and confirm the trust block renders and the count moves on reload.
