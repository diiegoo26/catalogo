# Site Visit Counter — Design

**Date:** 2026-10-01
**Status:** approved
**Scope:** single feature — one migration, four new source files, one new test file, three edited files

## Goal

Show a public, trustworthy total of visits to the KOVA ZONE catalog, as social proof on the home page.

## Decisions

These were settled with the owner before writing this spec:

| Decision | Choice | Why |
| --- | --- | --- |
| What is counted | One store-wide total | The owner wants a single number, not per-product popularity |
| What is a visit | One page view | Every rendered page counts, reloads included |
| Where it shows | Trust block on the home page | Visible without scrolling; reuses the existing store-rating data |
| Which pages count | The whole catalog, bots excluded | Home, categories, brands, teams, product pages |
| Storage | Atomic Postgres counter | Zero growth, no lost updates under concurrency |

Explicitly out of scope: per-product visit counts, per-path or per-day breakdowns, an
owner-facing analytics panel, a reset button, and any third-party analytics service.

## Architecture

Four independent parts, each with one job:

1. **Counter (`lib/visitas` boundary: Postgres function)** — owns the number. A singleton
   row plus a `security definer` function that increments it inside the database.
2. **Recorder (`app/api/visita` route)** — decides whether a request is a real human page
   view, then asks the counter to increment. Owns bot filtering and rate limiting.
3. **Beacon (`components/ContadorVisitas`)** — a UI-less client component mounted once in the
   root layout. Reports one visit per mount.
4. **Display (`components/BloqueConfianza`)** — a server component on the home page that reads
   the total and renders the trust row.

The recorder never trusts the client: the beacon sends no identity, no path, and no count.
It can only ask for `+1`, and only for requests that look like a real page view.

### Data flow

```
page render (home)            any page render
  |                                |
getVisitasTienda()                ContadorVisitas mounts
  |                                |
select total                       sendBeacon POST /api/visita
  |                                |
renders trust row                  bot UA?  -> 202, no count
                                   rate?   -> 429, no count
                                   rpc('incrementar_visitas') -> { ok, total }
```

## Data model

### Migration `add_site_visit_counter`

```sql
create table public.site_visits (
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
     set total = total + 1, updated_at = now()
   where id = 1
  returning total;
$$;

revoke insert, update, delete on public.site_visits from anon, authenticated;
grant execute on function public.incrementar_visitas() to anon, authenticated;

alter table public.site_visits enable row level security;

create policy "site_visits is publicly readable"
  on public.site_visits for select
  to anon, authenticated
  using (true);
```

Why this shape:

- **One row, always.** `id smallint check (id = 1)` makes it structurally impossible to hold
  more than one counter, so the table can never grow and never needs aggregation or cleanup.
- **The increment happens in Postgres.** Two simultaneous requests each add one; neither is
  lost. A client-side read-modify-write would drop visits under concurrency.
- **Writes go through the function only.** `security definer` lets `anon` increment without
  holding any write grant on the table, and the `revoke` of `insert, update, delete` means
  nobody can set `total` to an arbitrary value. Pinning `search_path` prevents object-shadowing
  inside the function.
- **Reads stay public.** The single `select` policy is what lets the home page read the total
  with the existing anon client.

### Read query

`lib/queries.ts` gains one function alongside the existing review queries:

```ts
export async function getVisitasTienda(): Promise<number> {
  const { data } = await supabase.from('site_visits').select('total').eq('id', 1).maybeSingle();
  return (data as { total: number } | null)?.total ?? 0;
}
```

A missing or unreadable row degrades to `0` instead of breaking the home page. It is fetched
in the same `Promise.all` as the categories and store reviews, adding no extra round-trip
latency on the critical path beyond one parallel query.

## Components

### `components/ContadorVisitas.tsx` (client)

A component with no rendered output. Its only job is to report one visit when it mounts.

```tsx
'use client';
import { useEffect, useRef } from 'react';

export default function ContadorVisitas() {
  const reportado = useRef(false);
  useEffect(() => {
    if (reportado.current) return;   // StrictMode double-invoke must not count twice
    reportado.current = true;
    const url = '/api/visita';
    if (navigator.sendBeacon?.(url)) return;
    void fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
  }, []);
  return null;
}
```

Mounted in `app/layout.tsx` inside `<CestaProvider>`, alongside `Header` / `Footer`.

Counting on mount is what keeps prefetches out of the number: Next.js prefetching a `<Link>`
fetches the RSC payload but never executes the destination page's client component, so no
beacon fires until the visitor actually navigates there.

The `useRef` guard exists because React's StrictMode invokes effects twice on mount in
development, which would otherwise double every count locally.

### `app/api/visita/route.ts`

```ts
export async function POST(req: Request) {
  if (esBot(req.headers.get('user-agent') ?? '')) {
    return NextResponse.json({ ok: false, skipped: 'bot' }, { status: 202 });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocido';
  if (!permitir(`visita:${ip}`, Date.now(), 120, 3_600_000)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  const { data, error } = await supabase.rpc('incrementar_visitas');
  if (error) return NextResponse.json({ ok: false, error: 'db' }, { status: 502 });
  return NextResponse.json({ ok: true, total: data });
}
```

- **202, not 200, for bots.** A crawler gets a valid response and the beacon disappears; the
  status makes "deliberately not counted" visible in logs instead of looking like a success.
- **120/hour per IP.** Loose enough that a real visitor browsing twenty product pages never
  trips it, tight enough to stop trivial inflation.
- **No body, no method but POST.** `sendBeacon` posts with an empty body, so there is nothing
  to parse, validate, or size-limit — no `content-length` guard is needed here.

### `lib/bots.ts`

```ts
const NO_HUMANO =
  /bot|crawl|spider|slurp|facebookexternalhit|telegram|whatsapp|preview|curl|wget|python-requests|headless|phantomjs|pingdom|gtmetrix|lighthouse|ahrefs|semrush/i;

export function esBot(userAgent: string): boolean {
  if (!userAgent.trim()) return true;
  return NO_HUMANO.test(userAgent);
}
```

Preview crawlers matter most here: Telegram, WhatsApp and Slack fetch shared links and would
otherwise inflate the total with traffic nobody ever saw.

## User interface

`components/BloqueConfianza` is a server component rendered on the home page between the hero
banner and the "Categorías" heading:

```
★ 4.8 · 36 opiniones · 👁 12.345 visitas
```

- Separated by `·`, centred, in the existing muted style so it reads as a quiet fact rather
  than a marketing block.
- The rating and review count come from the existing `getNotaTienda()`; the visit total comes
  from `getVisitasTienda()`. All three are fetched in one `Promise.all`.
- Numbers format with `Intl.NumberFormat('es-ES')` so thousands read as `12.345`.
- **Each item renders only when it has a value.** With the current data (no store reviews, no
  visits yet) the block renders nothing at all and the home page is byte-identical to today.
  This matches how the "Opiniones" section already hides itself when empty.
- If all three items are absent, the block returns `null` — no empty container, no separator.

## Error handling

| Situation | Behaviour |
| --- | --- |
| Bot or preview crawler | 202, no increment |
| Rate limit exceeded | 429, no increment |
| Supabase RPC fails | 502 to the beacon, which is fire-and-forget; the visitor sees nothing |
| `site_visits` row missing or unreadable | `getVisitasTienda()` returns `0`; the home page renders without the visits item |
| Beacon blocked by an extension | The visit is not recorded; the visible total stays lower than reality |

The last row is accepted, not worked around. A server-rendered increment would survive
ad-blockers but would count link-preview crawlers, prefetches and every bot that never runs
JavaScript — trading an accurate number for a larger one is the wrong direction.

## Edge cases

- **Reload counts again.** That is what "page view" means here, per the decision above.
- **Back/forward navigation served from the router cache may not remount**, so it does not
  count. Consistent with page-view semantics.
- **One visitor, many pages.** Each page mount counts; the 120/hour limit is per IP, so a
  visitor behind a shared NAT (office, school, mobile carrier) has headroom.
- **Vercel serverless concurrency.** The increment is atomic in Postgres, so parallel function
  invocations cannot lose a visit.

## Testing

The repo uses vitest. The only unit-testable new logic is the bot matcher.

`tests/bots.test.ts`:

- Returns `false` for current Chrome, Safari, Firefox, Edge and iOS Safari user agents.
- Returns `true` for `TelegramBot`, `WhatsApp`, `Googlebot`, `bingpreview`, `Slackbot`,
  `HeadlessChrome`, `curl/8.4.0` and `python-requests`.
- Returns `false` for a bare `Mozilla/5.0`.
- Returns `true` for an empty string: no browser omits its user agent, so an absent one is
  never a real page view. Rejecting it costs no genuine visit and closes a free inflation hole.

The RPC cannot be unit tested without network access; it is verified directly against Supabase
after the migration by calling the route twice and observing `total` grow by exactly two.

## Deployment

1. Apply migration `add_site_visit_counter` via `supabase_apply_migration`.
2. Commit to `main`: the migration, the four new source files (`lib/bots.ts`,
   `app/api/visita/route.ts`, `components/ContadorVisitas.tsx`,
   `components/BloqueConfianza.tsx`), the new test, and the three edited files
   (`lib/queries.ts`, `app/layout.tsx`, `app/page.tsx`).
3. The existing GitHub → Vercel auto-deploy publishes it. Verify on `kova-zone.vercel.app`
   that the trust row appears and that two reloads move the number by two.
