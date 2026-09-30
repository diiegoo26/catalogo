# FKA Front Views Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 69 products of the 58 FootyLogos-uncovered equipaciones 2026-27 teams one FootyLogos-style front view per kit variant, scraped from footballkitarchive.com (FKA).

**Architecture:** A Playwright crawler reads FKA club pages and emits a JSON source of truth; a pure builder turns that JSON into idempotent SQL plus a human report; a snapshot is taken before any write; the SQL is applied through admin SQL in verifiable slices and re-read to prove every value matches the JSON. Pure logic (frontal metrics, page parsing, SQL building) lives in `scripts/lib/` and is unit-tested with vitest; Playwright I/O stays in thin top-level scripts.

**Tech Stack:** Node 24 (ESM `.mjs`), Playwright + Chromium, sharp 0.35.5, vitest 4.1.11, `@supabase/supabase-js`, `git` is NOT available.

## Global Constraints

- **git is NOT available.** This directory is not a repository. Every step that would normally `git commit` instead appends a dated line to `docs/superpowers/plans/2026-09-30-fka-front-views-fallback.progress.md`. Do not run `git init` without the owner asking.
- **Hotlink only.** The database stores the remote FKA URL. An image is downloaded **solely** to verify it. Never write a local path into `products.images`.
- **2026-27 season only.** No earlier-season substitution, ever.
- **Never write an empty array** into `products.images`. A team with no usable front view keeps its current images.
- **Applies to the 69 products** of the 58 teams listed in the spec, minus any team FKA cannot supply for 2026-27.
- **All code, identifiers and SQL comments in English.** SQL must be ASCII-only. The human report (`*-sin-frente.md`) may be Spanish.
- **Never trust an exit code or an error-free batch.** Verify by re-reading rows and comparing values.
- **Sequential requests only.** 1.5-3 s jittered delay between page loads; max 3 retries with exponential backoff on 403/429; stop the run if 403 persists.
- **Never scrape paywalled content.** FKA's paid Plus tier unlocks "additional kit images". Only images reachable without an account may ever be referenced.
- **`sharp` must be declared explicitly** in `package.json`; do not rely on the transitive copy.
- Working reference spec: `docs/superpowers/specs/2026-09-30-fka-front-views-fallback-design.md`.

---

### Task 0: Dependencies and Chromium

**Files:**
- Modify: `package.json`
- Create: `docs/superpowers/plans/2026-09-30-fka-front-views-fallback.progress.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `playwright` and `sharp` importable from `scripts/lib/*.mjs`; a Chromium build for Playwright.

- [ ] **Step 1: Declare the dependencies**

Run: `npm install --save-dev playwright@^1.49.0 sharp@^0.35.5`

- [ ] **Step 2: Confirm both resolve from a script**

Create `scripts/_dep-check.mjs`:

```js
import sharp from 'sharp';
import { chromium } from 'playwright';

console.log('sharp', sharp.versions.sharp);
console.log('playwright chromium executable:', chromium.executablePath());
```

Run: `node scripts/_dep-check.mjs`
Expected: prints a sharp version and an absolute Chromium path.

- [ ] **Step 3: Download Chromium**

Run: `npx playwright install chromium`
Expected: downloads roughly 300 MB and exits 0. If the download fails, stop and report; nothing downstream can work.

- [ ] **Step 4: Prove Chromium launches and can reach a page**

Create `scripts/_browser-check.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'es-ES' });
const res = await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
console.log('status', res.status());
console.log('title', await page.title());
await browser.close();
```

Run: `node scripts/_browser-check.mjs`
Expected: `status 200` and a non-empty title.

- [ ] **Step 5: Baseline the FKA block from the browser**

Create `scripts/_fka-probe.mjs`:

```js
import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'es-ES', userAgent: UA });
const page = await ctx.newPage();
const res = await page.goto('https://www.footballkitarchive.com/es/', { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('status', res?.status());
console.log('title', await page.title());
console.log('body length', (await page.content()).length);
await browser.close();
```

Run: `node scripts/_fka-probe.mjs`
Expected: EITHER `status 200` with a long body, OR `status 403`. Record which, verbatim, in the progress file. Both are informative; Task 1 depends on the answer.

- [ ] **Step 6: Record the checkpoint**

Append to `docs/superpowers/plans/2026-09-30-fka-front-views-fallback.progress.md`:

```markdown
## Task 0 — dependencies
- date: <YYYY-MM-DD>
- sharp version: <value>
- chromium installed: yes/no
- FKA home via Playwright: <status> / body <n> bytes
```

Delete `scripts/_dep-check.mjs`, `scripts/_browser-check.mjs` and `scripts/_fka-probe.mjs`.

---

### Task 1: Phase 0 spike — the go/no-go gate

**Files:**
- Create: `scripts/fka-spike.mjs`
- Create: `fixtures/fka/<slug>.html` (captured page source)
- Modify: `docs/superpowers/plans/2026-09-30-fka-front-views-fallback.progress.md`

**Interfaces:**
- Consumes: Playwright from Task 0.
- Produces: three HTML fixtures at `fixtures/fka/{granada,cerezo-osaka,boca-juniors}.html`, a written go/no-go verdict, and the observed club-page URL shape needed by Task 3.

**This task is a gate. If question 1 or question 2 fails for all three clubs, STOP. Report and do not build Tasks 2-7.**

- [ ] **Step 1: Write the spike script**

Create `scripts/fka-spike.mjs`:

```js
// Phase 0: proves whether FKA is reachable by a real browser and whether the
// three sampled clubs expose 2026-27 kits. Read-only: writes fixtures, never the DB.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CLUBS = ['granada', 'cerezo-osaka', 'boca-juniors'];
const BASE = 'https://www.footballkitarchive.com';

mkdirSync('fixtures/fka', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'es-ES', userAgent: UA });

for (const slug of CLUBS) {
  const page = await ctx.newPage();
  // The club-history URL shape is confirmed against the live DOM in Step 2.
  const url = `${BASE}/es/${slug}-kits/`;
  let status = null;
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    status = res?.status() ?? null;
  } catch (err) {
    console.log(`${slug}: navigation error ${err.message}`);
  }
  const html = await page.content();
  console.log(`${slug}: status=${status} bytes=${html.length} url=${url}`);
  if (status === 200 && html.length > 5000) {
    writeFileSync(`fixtures/fka/${slug}.html`, html);
  }
  await page.close();
  await new Promise((r) => setTimeout(r, 2000));
}

await browser.close();
```

- [ ] **Step 2: Run it and inspect the real DOM**

Run: `node scripts/fka-spike.mjs`

If every club reports 403 or an unusable body:
- record it, **STOP**, and report: the WAF defeats headless Chromium from this machine; consider the owner-supplied-images option instead.

If at least one club returns 200:
- open the captured fixture and determine, from the actual HTML, the real club URL shape and the selectors that mark (a) a season block and (b) a kit image. Record the exact selectors in the progress file. Task 3 consumes them.

- [ ] **Step 3: Answer question 2 — does a 2026-27 section exist?**

In the captured HTML, search for the three clubs for a season marker containing `2026-27` (or its Spanish/season-label equivalent found in Step 2).

Run: `Select-String -Path fixtures/fka/*.html -Pattern '2026.?27' -List | Select-Object Filename, LineNumber`

Expected: at least one club matches. Record which. If **none** of the three matches, STOP and report: FKA does not carry these clubs for 2026-27 and the whole approach is void.

- [ ] **Step 4: Answer question 3 — capture 2-3 candidate image URLs and verify frontalness by eye**

Extract image URLs from a matching fixture (exact attribute from Step 2) and render each with the existing tool:

Run: `node scripts/ascii-kit.mjs <image-url>`

Expected: the ASCII silhouette shows a symmetric, centred shirt. Record the rendered verdict for each sampled image. If FKA photos are consistently on-body or angled, record it; that changes Task 2's thresholds and may mean the discard rate is high.

- [ ] **Step 5: Write the go/no-go verdict**

Append to the progress file:

```markdown
## Task 1 — phase 0 verdict
- WAF defeated: yes/no (statuses: <...>)
- 2026-27 present: yes/no (clubs: <...>)
- frontal quality: <description of what the ASCII renders showed>
- actual club URL shape: <...>
- season-block selector: <...>
- image attribute: <...>
- GO / NO-GO: <...>
```

- [ ] **Step 6: Stop and get owner sign-off**

Report the verdict to the owner. **Do not proceed to Task 2 until the owner confirms.** If NO-GO, this plan ends here.

---

### Task 2: Frontal verification module

**Files:**
- Create: `scripts/lib/frontal-check.mjs`
- Create: `scripts/lib/frontal-check.test.mjs`

**Interfaces:**
- Consumes: `sharp`.
- Produces:
  - `analyse(buffer: Buffer) -> Promise<Metrics>` where `Metrics = { aspect: number, coverage: number, centroidX: number, symmetry: number }`
  - `verdict(m: Metrics) -> { pass: boolean, reasons: string[] }`
  - `THRESHOLDS_2026_27: object` — the calibrated constants (Task 1 Step 4 informs them)

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/frontal-check.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { analyse, verdict } from './frontal-check.mjs';

// Builds a synthetic image by painting foreground pixels on a white canvas.
async function synth(W, H, fg) {
  const buf = Buffer.alloc(W * H * 3, 255);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (fg(x, y)) {
        const i = (y * W + x) * 3;
        buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0;
      }
    }
  }
  return sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

describe('frontal-check', () => {
  it('passes a centred, symmetric shirt shape', async () => {
    const img = await synth(200, 200, (x, y) => x > 60 && x < 140 && y > 50 && y < 170);
    const m = await analyse(img);
    expect(verdict(m).pass).toBe(true);
  });

  it('rejects an off-centre shape', async () => {
    const img = await synth(200, 200, (x, y) => x > 150 && x < 195 && y > 50 && y < 170);
    const m = await analyse(img);
    expect(verdict(m).pass).toBe(false);
    expect(verdict(m).reasons).toContain('off-centre');
  });

  it('rejects an asymmetric shape', async () => {
    const img = await synth(200, 200, (x, y) => x > 60 && x < 140 && y > 50 && y < 170 && !(x > 100 && y > 100));
    const m = await analyse(img);
    expect(verdict(m).pass).toBe(false);
  });

  it('rejects a nearly empty frame', async () => {
    const img = await synth(200, 200, (x, y) => x > 98 && x < 102 && y > 98 && y < 102);
    const m = await analyse(img);
    expect(verdict(m).pass).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/lib/frontal-check.test.mjs`
Expected: FAIL — cannot resolve `./frontal-check.mjs`.

- [ ] **Step 3: Implement the module**

Create `scripts/lib/frontal-check.mjs`:

```js
// Deterministic frontalness check for a kit photo. Pure: buffer in, verdict out.
// Thresholds are calibrated against real FKA images observed in phase 0.
import sharp from 'sharp';

const W = 64;

// Calibrated in Task 1 Step 4. Values here are the starting point, not final truth.
export const THRESHOLDS_2026_27 = {
  coverageMin: 0.06,
  coverageMax: 0.85,
  centroidTolerance: 0.08,
  symmetryMin: 0.90,
  aspectMin: 0.55,
  aspectMax: 1.8,
};

export async function analyse(buffer) {
  const trimmed = sharp(buffer).trim({ threshold: 10 });
  const meta = await trimmed.metadata();
  const aspect = meta.width && meta.height ? meta.width / meta.height : 0;

  const { data } = await sharp(buffer)
    .trim({ threshold: 10 })
    .resize(W, W, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Foreground weight: dark pixel on a light background scores high.
  let sum = 0, weightedX = 0, diff = 0;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const f = (255 - data[y * W + x]) / 255;
      const fr = (255 - data[y * W + (W - 1 - x)]) / 255;
      sum += f;
      weightedX += f * x;
      diff += Math.abs(f - fr);
    }
  }
  const coverage = sum / (W * W);
  const centroidX = sum > 0 ? weightedX / sum / (W - 1) : 0.5;
  const symmetry = 1 - diff / (W * W);
  return { aspect, coverage, centroidX, symmetry };
}

export function verdict(m) {
  const t = THRESHOLDS_2026_27;
  const reasons = [];
  if (m.coverage < t.coverageMin) reasons.push('coverage too low');
  if (m.coverage > t.coverageMax) reasons.push('coverage too high (background not trimmed?)');
  if (Math.abs(m.centroidX - 0.5) > t.centroidTolerance) reasons.push('off-centre');
  if (m.symmetry < t.symmetryMin) reasons.push('asymmetric');
  if (m.aspect < t.aspectMin || m.aspect > t.aspectMax) reasons.push('implausible aspect ratio');
  return { pass: reasons.length === 0, reasons };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/lib/frontal-check.test.mjs`
Expected: 4 passing.

- [ ] **Step 5: Calibrate against the real images**

Run the module against the phase 0 candidate images and record the real metric values. Tighten `THRESHOLDS_2026_27` so genuine FKA shirt photos pass and the known non-frontal examples fail. Re-run the test after any threshold change.

- [ ] **Step 6: Record the checkpoint**

Append the calibrated threshold values to the progress file.

---

### Task 3: FKA page parser

**Depends on Task 1 fixtures.** The exact selectors are read from the captured HTML, never guessed.

**Files:**
- Create: `scripts/lib/fka-parse.mjs`
- Create: `scripts/lib/fka-parse.test.mjs`
- Read: `fixtures/fka/*.html`

**Interfaces:**
- Consumes: a raw HTML string.
- Produces: `parseClubPage(html: string, opts: { season: string }) -> { seasonFound: boolean, kits: Array<{ variant: string, url: string }> }`

- [ ] **Step 1: Record the real selectors**

From the Task 1 progress notes, write down the confirmed season-block selector and image-attribute. Do not proceed on a guess.

- [ ] **Step 2: Write the failing test against a real fixture**

Create `scripts/lib/fka-parse.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseClubPage } from './fka-parse.mjs';

describe('parseClubPage', () => {
  // Uses a real captured page; the fixture is committed evidence, not a mock.
  const html = readFileSync('fixtures/fka/granada.html', 'utf8');

  it('reports the 2026-27 season as found when present', () => {
    const r = parseClubPage(html, { season: '2026-27' });
    expect(r.seasonFound).toBe(true);
  });

  it('returns at least one kit with a variant and an absolute url', () => {
    const r = parseClubPage(html, { season: '2026-27' });
    expect(r.kits.length).toBeGreaterThan(0);
    for (const k of r.kits) {
      expect(k.variant).toBeTruthy();
      expect(k.url).toMatch(/^https?:\/\//);
    }
  });

  it('returns seasonFound false for a season that is absent', () => {
    const r = parseClubPage(html, { season: '1998-99' });
    expect(r.seasonFound).toBe(false);
    expect(r.kits).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run scripts/lib/fka-parse.test.mjs`
Expected: FAIL — cannot resolve `./fka-parse.mjs`.

- [ ] **Step 4: Implement the parser using the confirmed selectors**

Create `scripts/lib/fka-parse.mjs`. Use the exact season-block selector and image attribute recorded in Step 1. Resolve relative image paths against `https://www.footballkitarchive.com`. Normalise the variant label to one of `home`, `away`, `third`, `fourth`, `anniversary`; anything else keeps its raw label so it is visible in the report rather than silently dropped.

If the site does not group kits into cleanly separable season blocks, fall back to this ordered strategy and record which one you used:

1. match a container whose text contains the season string;
2. if none, match each kit card and keep only those whose own text contains the season string;
3. if neither yields results for a fixture that visibly contains 2026-27 kits, stop and report the actual DOM structure instead of guessing further.

`seasonFound` is true only when at least one kit survives the chosen strategy.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run scripts/lib/fka-parse.test.mjs`
Expected: 3 passing. If a fixture does not contain 2026-27, point the test at a fixture that does.

- [ ] **Step 6: Record the checkpoint**

---

### Task 4: Club map

**Files:**
- Create: `scripts/fka-map.json`

**Interfaces:**
- Consumes: the confirmed club URL shape from Task 1.
- Produces: a JSON object mapping each of the 58 team slugs to its FKA club path.

- [ ] **Step 1: Build the map from the 58 known slugs**

Use the slug list in the spec (section "Why the gap exists"). Start from the URL shape confirmed in Task 1 — for example `https://www.footballkitarchive.com/es/<slug>-kits/` — and record the club path for each of the 58.

Slugs do not translate automatically (`zaragoza` -> `real-zaragoza`, `leganes` -> `leganes`). For any slug whose direct form does not resolve to a real club page, search FKA by club name and record the slug it actually uses. Where a club genuinely has no FKA page, **omit the key**; the crawler reports it as absent, exactly as the FootyLogos crawler does.

- [ ] **Step 2: Verify every key is a real team slug**

Run this check and confirm it prints 58 and no `MISSING`:

```js
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const map = JSON.parse(readFileSync('scripts/fka-map.json', 'utf8'));
console.log('keys', Object.keys(map).length);
for (const slug of Object.keys(map)) {
  const { data } = await sb.from('teams').select('slug').eq('slug', slug).maybeSingle();
  if (!data) console.log('MISSING', slug);
}
```

- [ ] **Step 3: Record the checkpoint**

---

### Task 5: Playwright crawler

**Files:**
- Create: `scripts/gen-equipaciones-fka.mjs`
- Produces: `supabase/equipaciones-2026-27-fka.json`

**Interfaces:**
- Consumes: `scripts/fka-map.json`, `scripts/lib/fka-parse.mjs`, `scripts/lib/frontal-check.mjs`.
- Produces: JSON keyed by team slug: `{ name, fka_url, season, page_status, variants: [{ variant, url, verdict, metrics }], missing: [{ variant, reasons }] }`. A variant appears in `variants` **only** when its verdict passes; otherwise it appears in `missing` with the reasons and there is no `variants` entry for it.

- [ ] **Step 1: Write the crawler**

Structure it exactly like `scripts/gen-equipaciones-frentes.mjs`: resolve the category and products from the DB, drive the browser sequentially, and write the JSON plus a short console summary. Reuse the same DB query shape:

```js
const { data: cat } = await sb.from('categories').select('id').eq('slug', 'equipaciones').maybeSingle();
const { data: rows } = await sb
  .from('products')
  .select('id, title, team_id, teams ( slug, name )')
  .eq('category_id', cat.id)
  .eq('season', '2026-27')
  .order('id');
```

Rate policy is mandatory: one browser, one context with `locale: 'es-ES'`, sequential navigation, `await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500))` between clubs, up to 3 retries with `2 ** attempt * 1000` backoff on a 403/429 navigation status. If a club still 403s after retries, record `page_status: 403`, stop the run, and leave the JSON partial so it can be resumed.

For every candidate image: fetch the bytes once, run `analyse` + `verdict`, and store the verdict and metrics. Only store the URL for a passing variant; a failing variant goes into `missing` with its reasons.

- [ ] **Step 2: Run it on a 3-club slice first**

Temporarily limit the crawl to `granada`, `cerezo-osaka`, `boca-juniors` and run it.

Expected: JSON with `page_status: 200` entries and at least one passing variant. If every club 403s, stop and report.

- [ ] **Step 3: Confirm the JSON shape and the discard behaviour**

Verify by inspection that a failing variant appears in `missing` with reasons and has **no** entry in `variants`. Confirm no empty arrays and no local filesystem paths.

- [ ] **Step 4: Run the full 58-team crawl**

Run: `node scripts/gen-equipaciones-fka.mjs`

Expected: completes or stops cleanly on persistent 403. Record how many teams were covered, how many skipped, and how many variants were discarded.

- [ ] **Step 5: Record the checkpoint**

---

### Task 6: SQL and report builder

**Files:**
- Create: `scripts/build-fka-sql.mjs`
- Create: `scripts/lib/fka-sql.mjs`
- Create: `scripts/lib/fka-sql.test.mjs`
- Produces: `supabase/equipaciones-2026-27-fka.sql`, `supabase/equipaciones-2026-27-fka-sin-frente.md`

**Interfaces:**
- Consumes: the Task 5 JSON and the live DB.
- Produces: `buildStatements({ rows, frentes }) -> { blocks, skipped, noTeam }` where each block is `{ id, images, comment, sql }`.

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/fka-sql.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { buildStatements } from './fka-sql.mjs';

const rows = [
  { id: '11111111-1111-1111-1111-111111111111', title: 'A', teams: { slug: 'granada', name: 'Granada' } },
  { id: '22222222-2222-2222-2222-222222222222', title: 'B', teams: { slug: 'nope', name: 'Nope' } },
  { id: '33333333-3333-3333-3333-333333333333', title: 'C', teams: null },
];
const frentes = {
  granada: { name: 'Granada', variants: [{ variant: 'home', url: 'https://x/1.jpg' }] },
  nope: { name: 'Nope', variants: [] },
};

describe('buildStatements', () => {
  it('emits one block per product with a usable view', () => {
    const { blocks } = buildStatements({ rows, frentes });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('11111111-1111-1111-1111-111111111111');
    expect(blocks[0].images).toEqual(['https://x/1.jpg']);
  });

  it('never emits an empty array', () => {
    const { blocks } = buildStatements({ rows, frentes });
    for (const b of blocks) expect(b.images.length).toBeGreaterThan(0);
  });

  it('skips view-less teams and teamless products separately', () => {
    const { skipped, noTeam } = buildStatements({ rows, frentes });
    expect(skipped.map((s) => s.slug)).toContain('nope');
    expect(noTeam.map((n) => n.id)).toContain('33333333-3333-3333-3333-333333333333');
  });

  it('produces ASCII-only, idempotent update text', () => {
    const { blocks } = buildStatements({ rows, frentes });
    expect(blocks[0].sql).toMatch(/^update products p set images = '\[.*\]'::jsonb\n  where p\.id = '[0-9a-f-]{36}';$/);
    expect(/^[\x00-\x7F]*$/.test(blocks[0].comment)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/lib/fka-sql.test.mjs`
Expected: FAIL — cannot resolve `./fka-sql.mjs`.

- [ ] **Step 3: Implement the builder**

Create `scripts/lib/fka-sql.mjs` exporting `buildStatements`. It skips a team when `!f || f.variants.length === 0` and **never emits `[]`**. Otherwise it mirrors `scripts/build-frentes-sql.mjs`: escape single quotes, ASCII-normalise comments, and emit one block per product.

**Important:** the FKA JSON keys the per-variant list as `variants`, whereas the FootyLogos JSON calls it `views`. Read `f.variants` here. Do not copy `f.views` from the FootyLogos builder.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/lib/fka-sql.test.mjs`
Expected: 4 passing.

- [ ] **Step 5: Write the thin top-level builder**

Create `scripts/build-fka-sql.mjs` that resolves the category/products from the DB, calls `buildStatements`, and writes the SQL and the Spanish report. The SQL header must reference `supabase/equipaciones-2026-27-fka-rollback.json` as the rollback — not the FootyLogos or Wix snapshots.

- [ ] **Step 6: Run the builder and validate the SQL**

Run: `node scripts/build-fka-sql.mjs`

Then confirm: exactly one `begin;` and one `commit;`, unique ids, no `[]` arrays, ASCII-only, and update count equals the number of covered products.

- [ ] **Step 7: Record the checkpoint**

---

### Task 7: Snapshot, apply and verify

**Files:**
- Create: `scripts/backup-fka-rollback.mjs`
- Produces: `supabase/equipaciones-2026-27-fka-rollback.json`

**Interfaces:**
- Consumes: the Task 6 SQL and the live DB.
- Produces: a snapshot of every product the SQL will touch.

- [ ] **Step 1: Write the snapshot tool**

Follow `scripts/backup-products-images.mjs`: scope to category `equipaciones` + season `2026-27`, refuse to overwrite an existing snapshot file, and write `{ id, images }` for **every product appearing in the Task 6 SQL**.

- [ ] **Step 2: Take the snapshot before any write**

Run: `node scripts/backup-fka-rollback.mjs`
Expected: the snapshot contains exactly as many rows as the SQL has updates. If it does not, **stop** — do not apply.

- [ ] **Step 3: Apply the SQL in verifiable slices**

Apply through admin SQL in slices of about 60 statements. After each slice, cache the affected-row count. A slice whose count does not equal the number of statements sent means a UUID matched nothing — investigate before continuing. Never proceed on an error-free return alone.

- [ ] **Step 4: Verify by value-diff, not by exit code**

Read every touched row back and compare `images` to the JSON byte-for-byte:

```js
const want = new Map(/* parsed from the SQL file: id -> images json string */);
let mismatch = 0;
for (let i = 0; i < ids.length; i += 40) {
  const { data } = await sb.from('products').select('id,images').in('id', ids.slice(i, i + 40));
  for (const r of data) if (JSON.stringify(r.images) !== want.get(r.id)) mismatch++;
}
console.log('mismatch', mismatch);
```

Expected: `mismatch 0`. Any non-zero mismatch must be reconciled before declaring done.

- [ ] **Step 5: Verify the untouched scope did not drift**

Confirm every product **not** in the SQL still equals its row in the snapshot. Expected: 0 drift.

- [ ] **Step 6: Final sanity sweep**

Confirm: 0 empty arrays among touched products, 0 local filesystem paths in any `images`, 0 numbered `NN-` FootyLogos URLs introduced, and only FKA URLs written.

- [ ] **Step 7: Record the final checkpoint**

Append the applied count, the mismatch count and the drift count to the progress file.

---

## Verification summary

- Task 1 verdict file records the go/no-go with real statuses.
- `npx vitest run scripts/lib/` passes for frontal-check, fka-parse and fka-sql.
- Snapshot row count equals the SQL update count before applying.
- Value-diff of touched products: **0 mismatches**.
- Drift of untouched products: **0**.
- 0 empty arrays, 0 local paths, 0 non-frontal images.
- 0 references to paywalled Plus images.

## Out of scope

- The 20 products with `team_id = null`.
- Any season other than 2026-27.
- Self-hosting or mirroring images.
- Any legal or licensing determination; flagged for the owner.
- Modifying the 190 products already updated from FootyLogos.
