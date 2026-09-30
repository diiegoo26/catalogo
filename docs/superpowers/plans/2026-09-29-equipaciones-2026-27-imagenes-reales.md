# Real 2026-27 kit photos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `public.products.images` for the 178 catalog products that belong to a club having real 2026-27 FootyLogos kit photography, with the complete set of that club's kit photos (home, away, third, …), ordered home-first.

**Architecture:** A curated club mapping (repo artifact) drives a Node generator that fetches each club's FootyLogos kit page, extracts only that club's own photos from `assets.footylogos.com`, verifies every URL over HTTP, and emits one idempotent SQL block per club. Applying that SQL updates `products.images`; `next.config.ts` learns the assets host. No React component changes.

**Tech Stack:** Next.js 16 (App Router), `next/image`, Supabase (Postgres + PostgREST + MCP), Node 20 ESM scripts, Python 3 (stdlib only) for image-header decoding during verification. Windows, PowerShell 5.1.

## Global Constraints

- **No test runner exists.** Verification means `npx tsc --noEmit`, `npm run lint`, `npm run build`, SQL assertions, and live HTTP sweeps. Do not add a test framework.
- **Not a git repository** — there are no commits. Each task ends with a checkpoint (run the verification command and record the result).
- **PowerShell 5.1 mangles inline Python** containing quotes: always write a `.py`/`.mjs` file and run it, never `python -c "..."`.
- Chain shell commands with `; if ($?) { ... }`, never `&&`.
- Supabase writes go through the MCP `execute_sql` tool. The anon key in `.env.local` is read-only: use it only for reading (`products`, `teams`) over PostgREST.
- Files must be written as UTF-8 without BOM.
- Products whose club is not in the mapping must remain **byte-identical**; never write an empty `images` array.
- Excluded slug collisions that must never be inserted: `america-de-cali` and `rangers-fc`.
- Ordering rule inside every `images` array: `home`, `away`, `third`, `fourth`, `anniversary`; inside a variant, `cover` first, then ascending numeric filename prefix.
- Photo URLs are only accepted from `https://assets.footylogos.com/` and each one must answer HTTP 200 before being written into SQL.

---

### Task 1: Allow the FootyLogos assets host in `next/image`

**Files:**
- Modify: `next.config.ts` (whole file is 12 lines)

**Interfaces:**
- Consumes: nothing.
- Produces: the runtime ability to render `https://assets.footylogos.com/...` through `/_next/image`; tasks 4–5 depend on it.

- [ ] **Step 1: Add the remote pattern**

Current content:

```ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.footylogos.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
      // Fotos de productos (286) alojadas en el CDN de Wix
      { protocol: 'https', hostname: 'static.wixstatic.com' },
    ],
  },
};
export default nextConfig;
```

Replace the `remotePatterns` array with:

```ts
    remotePatterns: [
      { protocol: 'https', hostname: 'www.footylogos.com' },
      { protocol: 'https', hostname: 'assets.footylogos.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
      // Fotos de productos (286) alojadas en el CDN de Wix
      { protocol: 'https', hostname: 'static.wixstatic.com' },
    ],
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds; no error mentioning `assets.footylogos.com`.

- [ ] **Step 4: Checkpoint**

Record the counter of updated rows still to come (nothing to assert yet). Note in the run log: `Task 1 ok — assets host allowed, tsc+build clean`.

---

### Task 2: Persist the curated club mapping as a repo artifact

**Files:**
- Create: `scripts/equipaciones-2026-27-map.json`
- Create: `scripts/map-equipaciones-2026-27.mjs`

**Interfaces:**
- Consumes: the verified design-time resolution (FootyLogos club slugs per team).
- Produces: `scripts/equipaciones-2026-27-map.json`, an object
  `{ "<our-team-slug>": { "fl_slug": "<footylogos-club-slug>", "name": "<team name>", "how": "exact|manual|norm-slug|norm-name|fuzzy" } }`
  containing **117 entries** (110 with photos + 7 pages whose gallery is still empty), with `america-de-cali` and `rangers-fc` absent. Task 3 reads exactly this file.

- [ ] **Step 1: Write the mapping builder**

Create `scripts/map-equipaciones-2026-27.mjs`:

```js
// Builds scripts/equipaciones-2026-27-map.json: our team slug -> FootyLogos club slug.
// The resolution below was validated during design (275 FootyLogos club pages crawled,
// every resulting photo URL returned HTTP 200). Two fuzzy matches are for the WRONG club
// and are therefore excluded: america-de-cali -> club-america (Mexican club) and
// rangers-fc -> queens-park-rangers.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Curated, hand-reviewed resolutions. `exact` entries share the FootyLogos slug.
const MANUAL = {
  'athletic-club': 'athletic-club-bilbao',
  'chivas-guadalajara': 'cd-guadalajara',
  'ca-osasuna': 'osasuna',
  'brighton': 'brighton-hove-albion',
  'fc-colonia': '1-fc-koln',
  'hoffenheim': 'tsg-hoffenheim',
  'rcd-espanyol': 'rcd-espanyol-barcelona',
  'real-betis': 'real-betis-balompie',
  'olympique-de-marsella': 'olympique-de-marseille-om',
  'olympique-de-lyon': 'olympique-lyonnais',
  'estrasburgo': 'rc-strasbourg-alsace',
  'hamburgo': 'hamburger-sv',
  'santos': 'santos-fc',
  'paranaense': 'athletico-paranaense',
  'internacional': 'sc-internacional',
  'atlas-fc': 'atlas',
  'tijuana': 'club-tijuana',
};
const EXCLUDE = new Set(['america-de-cali', 'rangers-fc']);

const res = await fetch('https://www.footylogos.com/football-kits');
const html = await res.text();
const pages = new Set([...html.matchAll(/\/kits\/([a-z0-9-]+?)-(?:2026-27|2026|2026-world-cup)"/g)]
  .map((m) => m[1]));

const STOP = new Set(['fc','cf','afc','sc','ac','as','cd','ud','rc','sv','club','de','the','calcio','sco','om','1907']);
const deacc = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const toks = (s) => new Set(deacc(s).replace(/&/g, ' and ').split(/[^a-z0-9]+/)
  .filter((t) => t && !STOP.has(t)));

const { data: teams } = await sb.from('teams').select('slug,name');
const map = {};
for (const t of teams) {
  if (EXCLUDE.has(t.slug)) continue;
  let fl = MANUAL[t.slug] ?? (pages.has(t.slug) ? t.slug : null);
  let how = MANUAL[t.slug] ? 'manual' : 'exact';
  if (!fl) {
    const key = [...toks(t.slug)].sort().join(' ');
    const cand = [...pages].find((p) => [...toks(p)].sort().join(' ') === key);
    if (cand) { fl = cand; how = 'norm-slug'; }
  }
  if (!fl) continue;
  map[t.slug] = { fl_slug: fl, name: t.name, how };
}

writeFileSync('scripts/equipaciones-2026-27-map.json', JSON.stringify(map, null, 1) + '\n');
console.log(`mapping entries: ${Object.keys(map).length}`);
```

- [ ] **Step 2: Run it**

Run: `node scripts/map-equipaciones-2026-27.mjs`
Expected: `mapping entries: 117`.

- [ ] **Step 3: Assert the two excluded slugs are absent and the count is exact**

Run:

```powershell
node -e "const m=require('./scripts/equipaciones-2026-27-map.json');console.log(Object.keys(m).length, 'america-de-cali' in m, 'rangers-fc' in m)"
```

Expected: `117 false false`.

- [ ] **Step 4: Assert every mapped slug really is a FootyLogos club page**

Run:

```powershell
node -e "const m=require('./scripts/equipaciones-2026-27-map.json');const bad=[];for(const [k,v] of Object.entries(m)){const r=await fetch('https://www.footylogos.com/kits/'+v.fl_slug+'-2026-27',{method:'HEAD'});if(r.status!==200)bad.push(k+'->'+v.fl_slug+' '+r.status)}console.log('bad:',bad.length,bad.slice(0,10))"
```

Expected: `bad: 0 []` for clubs whose page uses `-2026-27`; any club printed here is a Brazilian
`-2026` page and is acceptable only if its `fl_slug` is in
`[athletico-paranaense, sc-internacional, santos-fc, bahia, botafogo, chapecoense, corinthians, coritiba, cruzeiro, flamengo, fluminense, gremio, palmeiras, rb-bragantino, sao-paulo, vasco-da-gama, vitoria, mirassol-fc, inter-miami, new-york-city-fc]`.

- [ ] **Step 5: Checkpoint**

Run: `node -e "const m=require('./scripts/equipaciones-2026-27-map.json');console.log(Object.keys(m).length)"` → `117`.

---

### Task 3: Generate and verify `supabase/equipaciones-2026-27-imagenes.sql`

**Files:**
- Create: `scripts/gen-equipaciones-2026-27.mjs`
- Create: `supabase/equipaciones-2026-27-imagenes.sql` (generated)
- Create: `supabase/equipaciones-2026-27-backup.json` (current DB images, for rollback)

**Interfaces:**
- Consumes: `scripts/equipaciones-2026-27-map.json` (Task 2, 117 entries) and `.env.local`.
- Produces:
  - `supabase/equipaciones-2026-27-imagenes.sql`: repeated blocks
    `update products p set images = '[...]'::jsonb from teams t where t.id = p.team_id and t.slug = '<our-slug>';`
    each preceded by a `-- <Club> · source: <page> (<n> photos)` comment, wrapped in `begin; ... commit;`.
  - `supabase/equipaciones-2026-27-backup.json`: `[{ id, images }]` for every product, captured **before** the update.
  - A stdout report: clubs written, total photos, HTTP failures, photos per club.

- [ ] **Step 1: Write the generator**

Create `scripts/gen-equipaciones-2026-27.mjs`:

```js
// Generates supabase/equipaciones-2026-27-imagenes.sql from the curated club mapping.
// For each club it reads its FootyLogos kit page, keeps ONLY that club's own photos
// (files under assets.footylogos.com whose club tokens overlap the page slug tokens by
// >=60% of the smaller set), verifies every URL over HTTP, and emits one idempotent UPDATE.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const map = JSON.parse(readFileSync('scripts/equipaciones-2026-27-map.json', 'utf8'));

const STOP = new Set(['fc','cf','afc','sc','ac','as','cd','ud','rc','sv','club','de','the','calcio','sco','om','1907']);
const deacc = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const toks = (s) => new Set(deacc(s).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)));
const ORDER = ['home', 'away', 'third', 'fourth', 'anniversary'];
const FNAME = /^(cover|\d{1,3})-(.+?)-(2026-27|2026)-([a-z]+)-kit-footylogos\.(?:jpg|jpeg|png|webp)$/;
const pick = (s) => (s.some((v) => v.startsWith('2026-')) ? '2026' : '2026-27');

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 2000 + 2000 * i)); continue; }
      return r;
    } catch { await new Promise((s) => setTimeout(s, 500 + 500 * i)); }
  }
  return null;
}

async function photosFor(ourSlug, { fl_slug }) {
  const page = `https://www.footylogos.com/kits/${fl_slug}-${pick([fl_slug])}`;
  const res = await get(page);
  if (!res || res.status !== 200) return { page, variants: {}, status: `page-${res ? res.status : 'err'}` };
  const html = await res.text();
  const pt = toks(fl_slug);
  const variants = {};
  for (const m of html.matchAll(/https:\/\/assets\.footylogos\.com\/[^\s"'<>\\]+?\.(?:jpg|jpeg|png|webp)/g)) {
    const url = m[0];
    const f = FNAME.exec(url.split('/').pop());
    if (!f) continue;
    const [, idx, clubPart, , kind] = f;
    const ct = toks(clubPart);
    const inter = [...pt].filter((t) => ct.has(t)).length;
    if (!pt.size || !ct.size || !inter || inter / Math.min(pt.size, ct.size) < 0.6) continue;
    (variants[kind] ??= []).push([idx === 'cover' ? 0 : Number(idx), url]);
  }
  for (const k of Object.keys(variants)) {
    variants[k] = [...new Set(variants[k].sort((a, b) => a[0] - b[0]).map((v) => v[1]))];
  }
  return { page, variants, status: Object.keys(variants).length ? 'ok' : 'empty' };
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const lines = ['-- ============================================================================',
  '-- KOVA catalogo · Imagenes reales 2026-27 de las equipaciones (FootyLogos)',
  '-- Generado por scripts/gen-equipaciones-2026-27.mjs — NO editar a mano.',
  '-- Cada bloque: todos los productos del club reciben la galeria completa del kit.',
  '-- Clubs ausentes = sin galeria 2026-27 en la fuente -> conservan su foto actual.',
  '-- Idempotente: reejecutable sin efectos secundarios.',
  '-- ============================================================================',
  'begin;', ''];

let clubs = 0, photos = 0;
const skipped = [];
const slugs = Object.keys(map).sort();
for (const ourSlug of slugs) {
  const info = map[ourSlug];
  const r = await photosFor(ourSlug, info);
  const urls = ORDER.flatMap((k) => r.variants[k] ?? [])
    .concat(Object.entries(r.variants).filter(([k]) => !ORDER.includes(k)).flatMap(([, v]) => v));
  if (!urls.length) { skipped.push(`${ourSlug} (${r.status})`); continue; }

  const bad = [];
  for (const u of urls) {
    const res = await get(u);
    if (!res || res.status !== 200) bad.push(`${u} -> ${res ? res.status : 'err'}`);
  }
  if (bad.length) { skipped.push(`${ourSlug} (${bad.length} bad urls)`); console.error(bad.slice(0, 3)); continue; }

  const counts = ORDER.filter((k) => r.variants[k]?.length).map((k) => `${k} ${r.variants[k].length}`).join(', ');
  lines.push(`-- ${info.name} · source: ${r.page} (${counts})`);
  lines.push(`update products p set images = ${q(JSON.stringify(urls))}::jsonb`);
  lines.push(`  from teams t where t.id = p.team_id and t.slug = ${q(ourSlug)};`);
  lines.push('');
  clubs++; photos += urls.length;
}
lines.push('commit;', '', '-- Verificacion esperada: 0 filas con /v1/fill o blur_2 en los clubes actualizados.');
lines.push("-- select count(*) from products where images::text like '%blur_2%';");

writeFileSync('supabase/equipaciones-2026-27-imagenes.sql', lines.join('\n'));
console.log(`clubs written: ${clubs}  photos: ${photos}  skipped: ${skipped.length}`);
if (skipped.length) console.log('skipped:', skipped.join(', '));
```

- [ ] **Step 2: Back up the current images before touching anything**

Create `scripts/backup-products-images.mjs`:

```js
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data, error } = await sb.from('products').select('id,images');
if (error) throw error;
writeFileSync('supabase/equipaciones-2026-27-backup.json', JSON.stringify(data, null, 1) + '\n');
console.log(`backed up ${data.length} products`);
```

Run: `node scripts/backup-products-images.mjs`
Expected: `backed up 286 products`.

- [ ] **Step 3: Generate the SQL**

Run: `node scripts/gen-equipaciones-2026-27.mjs`
Expected: `clubs written: 110  photos: 2271  skipped: 7` followed by the seven club slugs whose
FootyLogos page still has no photos (`atletico-de-madrid`, `atletico-mineiro`, `getafe-cf`,
`inter-miami-cf`, `ipswich-town`, `new-york-city-fc`, `remo`). Any other skipped club is a failure
to investigate before continuing.

- [ ] **Step 4: Eyeball the generated file**

Run: `node -e "const s=require('node:fs').readFileSync('supabase/equipaciones-2026-27-imagenes.sql','utf8');console.log('updates:',(s.match(/^update products/gm)||[]).length);console.log(s.split('\n').slice(0,12).join('\n'))"`
Expected: `updates: 110`, header comment block, then `begin;`.

- [ ] **Step 5: Checkpoint**

Confirm the file has 110 `update` statements, `begin;`/`commit;`, no `w_147`, and no `america-de-cali`/`rangers-fc`.

```powershell
node -e "const s=require('node:fs').readFileSync('supabase/equipaciones-2026-27-imagenes.sql','utf8');console.log({updates:(s.match(/^update products/gm)||[]).length, w147:s.includes('w_147'), cali:s.includes('america-de-cali'), rangers:s.includes('rangers-fc')})"
```

Expected: `{ updates: 110, w147: false, cali: false, rangers: false }`.

---

### Task 4: Apply the SQL to Supabase and assert the data

**Files:**
- No file changes; database mutation via MCP `execute_sql`.

**Interfaces:**
- Consumes: `supabase/equipaciones-2026-27-imagenes.sql` (Task 3).
- Produces: updated `products.images` for 178 products across 110 clubs.

- [ ] **Step 1: Pre-check the target state**

Run this SQL:

```sql
select count(*) as total,
       count(*) filter (where images::text like '%blur_2%') as blur,
       count(*) filter (where images::text like '%assets.footylogos.com%') as fl
from public.products;
```

Expected before: `total 286, blur 0, fl 0`.

- [ ] **Step 2: Apply the migration**

Paste the full contents of `supabase/equipaciones-2026-27-imagenes.sql` into MCP `execute_sql`.
Expected: no error. (The file is wrapped in `begin; … commit;`.)

- [ ] **Step 3: Assert the update landed**

Run:

```sql
select count(*) filter (where images::text like '%assets.footylogos.com%') as with_fl_photos,
       count(*) filter (where images::text like '%blur_2%') as still_blurred,
       count(*) filter (where images::text like '%/v1/fill/%') as still_thumb,
       max(jsonb_array_length(images)) as max_photos,
       min(jsonb_array_length(images)) as min_photos
from public.products;
```

Expected: `with_fl_photos` = 178, `still_blurred` = 0, `still_thumb` = 0, `max_photos` = 41,
`min_photos` = 1 (clubs without a gallery keep their single current photo).

- [ ] **Step 4: Assert every updated product has at least two photos and starts with a home photo**

Run:

```sql
select count(*) as updated_products,
       count(*) filter (where jsonb_array_length(images) < 2) as too_few
from public.products
where images::text like '%assets.footylogos.com%';
```

Expected: `updated_products` = 178, `too_few` = 0.

Run:

```sql
select count(*) as not_home_first
from public.products
where images::text like '%assets.footylogos.com%'
  and (images->>0) not like '%-home-kit-footylogos%';
```

Expected: 0 (or a small number for clubs whose gallery has no home photo — verify those club by club
against their FootyLogos page before accepting).

- [ ] **Step 5: Assert untouched rows really are untouched**

Compare against the backup for a known-untouched club, e.g. Almería:

```sql
select count(*) as almeria_products,
       count(*) filter (where images::text like '%assets.footylogos.com%') as must_be_zero
from public.products p join public.teams t on t.id = p.team_id
where t.slug = 'almeria';
```

Expected: `must_be_zero` = 0.

- [ ] **Step 6: Checkpoint**

Record the three query results verbatim in the run log.

---

### Task 5: Runtime end-to-end verification

**Files:**
- Create: `scripts/verify-2026-27-photos.py` (temporary verification script; stdlib only)

**Interfaces:**
- Consumes: the running production server and the updated database.
- Produces: a printed PASS/FAIL report; no repo state.

- [ ] **Step 1: Build and start the production server**

Run: `npm run build` then start `npm run start -- -p 3123` in the background, logging to
`C:\Users\corra\AppData\Local\Temp\opencode\next-3123.log`. Wait until
`http://localhost:3123/equipaciones` returns 200.

- [ ] **Step 2: Write the sweep script**

Create `scripts/verify-2026-27-photos.py`:

```python
import json, re, struct, sys, urllib.request, urllib.error

BASE = "http://localhost:3123"
UA = {"User-Agent": "Mozilla/5.0"}

def get(url, raw=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read() if raw else r.read().decode("utf-8", "ignore")

def dims(data):
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        if data[12:16] == b"VP8 ":
            return struct.unpack("<H", data[26:28])[0] & 0x3FFF, struct.unpack("<H", data[28:30])[0] & 0x3FFF
        if data[12:16] == b"VP8X":
            return int.from_bytes(data[24:27], "little") + 1, int.from_bytes(data[27:30], "little") + 1
    if data[:2] == b"\xff\xd8":
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1; continue
            mk = data[i + 1]
            if mk in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h, w = struct.unpack(">HH", data[i + 5:i + 9]); return w, h
            if mk in (0xD8, 0x01) or 0xD0 <= mk <= 0xD7:
                i += 2; continue
            i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
    return None

listing = get(BASE + "/equipaciones")
links = sorted(set(re.findall(r'href="(/producto/[^"]+)"', listing)))[:8]
studio = sorted(set(re.findall(r'href="(/equipaciones/[^"]+)"', listing)))[:4]
pages = links + studio
print("pages to check:", pages)

seen, bad_stale, ok, dims_seen = set(), 0, 0, []
for p in pages:
    html = get(BASE + p)
    for m in re.finditer(r'/_next/image\?url=([^&"]+)', html):
        src = urllib.request.unquote(m.group(1))
        if "w_147" in src or "blur_2" in src:
            bad_stale += 1
        if src in seen:
            continue
        seen.add(src)
        opt = f"{BASE}/_next/image?url={urllib.request.quote(src, safe='')}&w=1080&q=75"
        try:
            body = get(opt, raw=True)
            d = dims(body)
            nontrivial = d and min(d) > 300
            ok += 1 if nontrivial else 0
            if d:
                dims_seen.append((src.rsplit('/', 1)[1], d, len(body)))
        except urllib.error.HTTPError as e:
            print("  FAIL", e.code, src[:110])
        except Exception as e:
            print("  ERR", e, src[:110])

print(f"distinct images checked: {len(seen)}  served OK: {ok}  stale w_147/blur_2 refs: {bad_stale}")
for name, d, n in dims_seen[:6]:
    print(f"   {d[0]}x{d[1]}  {n:>7} bytes  {name}")
print("PASS" if (ok == len(seen) and bad_stale == 0 and seen) else "FAIL")
```

- [ ] **Step 3: Run the sweep**

Run: `python scripts/verify-2026-27-photos.py`
Expected: `stale w_147/blur_2 refs: 0`, `PASS`, and reported dimensions in the 600–1200 px range
(median source is 1200×1600, so an optimized 1080 request lands near 1080 px on the long side).

- [ ] **Step 4: Spot-check three clubs by hand**

For Arsenal, Málaga and PSG: open `https://www.footylogos.com/kits/<fl_slug>-2026-27`, then open the
matching `/producto/<slug>` page in the local server, and confirm the first three photos are the same
shirts in the same order (home cover, next home photo, …).

- [ ] **Step 5: Stop the server and checkpoint**

Kill the process listening on port 3123 and confirm the port is free. Record the sweep output.

---

### Task 6: Close-out — documentation and memory

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-equipaciones-2026-27-imagenes-reales-design.md` (status line only)
- Create: no new docs beyond the ones above.

**Interfaces:**
- Consumes: the run log from Tasks 1–5.
- Produces: a spec marked implemented, plus a saved session summary in Engram.

- [ ] **Step 1: Mark the spec implemented**

Change the spec's status line to
`**Status:** implemented (2026-09-29) — 178 products, 110 clubs, 2271 photos`.

- [ ] **Step 2: Record the outcome in Engram**

Call `mem_save` with title `Shipped real 2026-27 kit photos to products.images`, type `feature`,
including: the mapping artifact path, the generator path, the SQL path, the counts (178 products /
110 clubs / 2271 photos), the seven clubs whose pages are still empty, and the fact that
`assets.footylogos.com` had to be added to `next.config.ts`.

- [ ] **Step 3: Report to the user**

Summarize: products updated, clubs covered, clubs still on the old photo (and why), how to re-run the
generator if FootyLogos publishes more galleries later
(`node scripts/gen-equipaciones-2026-27.mjs` then re-apply the SQL).

---

## Self-review notes

- **Spec coverage:** host config → Task 1; source conventions and photo attribution → Task 3;
  ordering → Task 3 `ORDER`; fallback for clubs without a gallery → Task 3 (`skipped`) and Task 4
  Step 5; coverage counts → Task 4 Step 3; verification plan → Tasks 1, 4, 5; out-of-scope items are
  not implemented anywhere, as intended.
- **Rollback:** `supabase/equipaciones-2026-27-backup.json` plus the preserved
  `C:\Users\corra\AppData\Local\Temp\opencode\products_images_backup.json` allow restoring the
  previous arrays for all 286 rows.
- **Open risk carried into execution:** a handful of clubs may expose no `home` photo (Task 4 Step 4
  tolerates this only after per-club verification).
