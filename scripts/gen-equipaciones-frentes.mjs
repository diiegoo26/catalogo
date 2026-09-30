// Builds supabase/equipaciones-2026-27-frentes.json: the FRONT VIEW only of every
// FootyLogos kit variant, one URL per variant.
//
// Why this crawls instead of reading the plan
// supabase/equipaciones-2026-27-plan.json is STALE: it is missing covers that do exist
// live (sc-freiburg, ajax, bologna and tsg-hoffenheim all ship a 2026-27 home cover
// on the site). Consumers of the stale plan fell back to image `01-`, and `01-` is a
// posed/worn shot, not a clean front view. The club page is the source of truth, so
// this script reads the gallery markup directly:
//
//   <button data-gallery="sc-freiburg-2026-27-home" data-kit-index="0"
//           data-image="/kits/sc-freiburg-2026-27/home-cover.webp" ...>
//
// Two URL shapes appear in the same gallery:
//   www     /kits/<fl-slug>-2026-27/<variant>-cover.webp                              (475x560)
//   assets  https://assets.footylogos.com/kits/<season>/<league>/<batch>/cover-<club>-<season>-<variant>-kit-footylogos.jpg  (1364x1600)
// A variant may publish on both. The assets one is roughly 3x the pixels, so it wins.
//
// Rule: a variant's front view is its `cover` (image 1) and nothing else. A variant
// with no cover is recorded as a miss instead of silently falling back to a numbered
// image, because numbered images can be posed shots.
//
// Two things a club page depends on, and both used to be guessed wrong:
//
//   1. The season. A club page is /kits/<fl-slug>-<season> and `<season>` is NOT
//      always 2026-27. Clubs on a calendar-year competition (Brazil, MLS) are
//      published as 2026, so a 2026-27-only URL 404s for them. Both suffixes are
//      probed, in order, and the one that answered is recorded as `season_used`. The
//      second probe happens only after a genuine 404: a timeout or a 5xx is a
//      transport problem and says nothing about whether the other suffix exists.
//
//   2. The slug. scripts/equipaciones-2026-27-map.json is hand-curated and covers
//      most clubs, but any team missing from it used to be sent the database team
//      slug, which is not a FootyLogos slug. The site index
//      https://www.footylogos.com/kits is the authority: it links every club-season
//      the site carries. It is parsed once into a <slug, season, club name> set and
//      consulted by exact slug, then by normalised club name. A normalised name held
//      by more than one entry is ambiguous and is skipped, never guessed.
//
// Run: node scripts/gen-equipaciones-frentes.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const MAP = 'scripts/equipaciones-2026-27-map.json';
const OUT = 'supabase/equipaciones-2026-27-frentes.json';
const CATEGORY_SLUG = 'equipaciones';
// The products.season value being filled. Unrelated to the FootyLogos page season,
// which is probed separately (SITE_SEASONS below).
const PRODUCT_SEASON = '2026-27';

const SITE = 'https://www.footylogos.com';
const INDEX_URL = `${SITE}/kits`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// A club page is published under the season it covers. European leagues run 2026-27;
// calendar-year competitions (the Brasileirão, MLS, the Mexican split) are published
// as 2026. Probed in this order, and the winner is what `season_used` records.
const SITE_SEASONS = ['2026-27', '2026'];

const PAGE_CONCURRENCY = 6;
const PAGE_TIMEOUT_MS = 20000;
const PROBE_CONCURRENCY = 8;
const PROBE_TIMEOUT_MS = 15000;

const VARIANT_ORDER = ['home', 'away', 'third'];

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The image regexes are anchored to the season being crawled. Without that anchor a
// club like `como-1907` mis-parses (club `como`, season `1907`, variant `2026-27-home`)
// because the season token also accepts a bare year.
function rxWww(season) {
  return new RegExp(String.raw`^(?:https://www\.footylogos\.com)?/kits/(.+?)-${esc(season)}/(.+?)-(cover|\d{1,3})\.webp$`);
}
function rxAssets(season) {
  return new RegExp(
    String.raw`^https://assets\.footylogos\.com/kits/[^/]+/[^/]+/[^/]+/(cover|\d{1,3})-(.+?)-${esc(season)}-([a-z0-9]+(?:-[a-z0-9]+)*)-kit-footylogos\.(?:jpg|jpeg|png|webp|avif)$`,
    'i',
  );
}
const RX_BY_SEASON = new Map(SITE_SEASONS.map((s) => [s, { www: rxWww(s), assets: rxAssets(s) }]));

// Runs `fn` over `items` with at most `limit` in flight, preserving input order.
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const k = cursor++;
        if (k >= items.length) return;
        out[k] = await fn(items[k], k);
      }
    }),
  );
  return out;
}

function withTimeout(ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(timer) };
}

// Splits one data-image value into { variant, isCover, host, url }, or null when the
// value matches neither known shape. Returns are counted so a silent regex gap on a
// page shows up in the summary instead of quietly dropping a club.
function parseImage(raw, season) {
  const rx = RX_BY_SEASON.get(season);
  const assets = rx.assets.exec(raw);
  if (assets) {
    const [, index, , variant] = assets;
    return { variant: variant.toLowerCase(), isCover: index.toLowerCase() === 'cover', host: 'assets', url: raw };
  }
  const www = rx.www.exec(raw);
  if (www) return { variant: www[2].toLowerCase(), isCover: www[3] === 'cover', host: 'www', url: `${SITE}${raw}` };
  return null;
}

function variantRank(v) {
  const i = VARIANT_ORDER.indexOf(v);
  return i === -1 ? VARIANT_ORDER.length : i;
}

const byVariant = (a, b) => variantRank(a) - variantRank(b) || a.localeCompare(b);

async function fetchPage(url) {
  const t = withTimeout(PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: t.signal, headers: { 'user-agent': USER_AGENT, accept: 'text/html' } });
    if (res.status === 404) { await res.body?.cancel(); return { status: 404, html: null }; }
    if (!res.ok) { await res.body?.cancel(); return { status: res.status, html: null }; }
    return { status: res.status, html: await res.text() };
  } catch (err) {
    // A single dead page must never abort the run; the team is reported as a miss.
    return { status: err?.name === 'AbortError' ? 'timeout' : `error: ${err?.message ?? err}`, html: null };
  } finally {
    t.done();
  }
}

async function probe(url) {
  const t = withTimeout(PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: t.signal, headers: { 'user-agent': USER_AGENT } });
    await res.body?.cancel();
    return res.status;
  } catch (err) {
    return err?.name === 'AbortError' ? 'timeout' : `error: ${err?.message ?? err}`;
  } finally {
    t.done();
  }
}

// Every index link the site publishes, as /kits/<fl-slug>-<season>. The anchor text is
// the card heading, e.g.
//   "Home Away Puma 2026 AC Milan 2026-27 3 kits - 35 photos"
// so the club name is the run between the two season tokens.
const RX_INDEX_LINK = /<a\b[^>]*href="\/kits\/([a-z0-9][a-z0-9-]*)-(20\d\d(?:-27)?)"[^>]*>([\s\S]*?)<\/a>/gi;

function clubNameOf(text, season) {
  const m = text.match(new RegExp(`\\b${esc(season)}\\b\\s+(.+?)\\s+\\b${esc(season)}\\b`));
  return m ? m[1].trim() : null;
}

// Lowercase, drop diacritics, collapse every non-alphanumeric run to a single dash, so
// "Newell's Old Boys" and "Newells Old Boys" land on the same key.
const normKey = (s) =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const indexFetch = await fetchPage(INDEX_URL);
const indexEntries = [];
const indexUnparsed = [];
if (indexFetch.html) {
  const seen = new Set();
  for (const m of indexFetch.html.matchAll(RX_INDEX_LINK)) {
    const [, flSlug, season] = m;
    const pair = `${flSlug}|${season}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    const club = clubNameOf(m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), season);
    if (!club) { indexUnparsed.push({ fl_slug: flSlug, season }); continue; }
    indexEntries.push({ flSlug, season, club, key: normKey(club) });
  }
}

const indexBySlug = new Map();
const indexByName = new Map();
for (const e of indexEntries) {
  if (!indexBySlug.has(e.flSlug)) indexBySlug.set(e.flSlug, []);
  indexBySlug.get(e.flSlug).push(e);
  if (!indexByName.has(e.key)) indexByName.set(e.key, []);
  indexByName.get(e.key).push(e);
}
const indexAmbiguous = new Set([...indexByName].filter(([, v]) => v.length > 1).map(([k]) => k));
// An empty index means the fetch failed or the markup moved. The map must not be
// invalidated by that, so it is trusted unconditionally and every unresolved team
// falls back to the team-slug guess, exactly as before this fix.
const indexUsable = indexEntries.length > 0;
const indexSeasonMix = {};
for (const e of indexEntries) indexSeasonMix[e.season] = (indexSeasonMix[e.season] ?? 0) + 1;

// 1. Which teams actually need images: products in the category for this season.
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: cat, error: catErr } = await sb.from('categories').select('id').eq('slug', CATEGORY_SLUG).maybeSingle();
if (catErr) throw catErr;
if (!cat) throw new Error(`category ${CATEGORY_SLUG} not found`);

const { data: rows, error: prodErr } = await sb
  .from('products')
  .select('id, title, team_id, teams ( slug, name )')
  .eq('category_id', cat.id)
  .eq('season', PRODUCT_SEASON)
  .order('id');
if (prodErr) throw prodErr;

const map = JSON.parse(readFileSync(MAP, 'utf8'));

// Priority: the hand-curated map, then the site index (exact slug, then unique
// normalised name), then the team slug as a last resort.
function resolveSlug(teamSlug, name) {
  const mapSlug = map[teamSlug]?.fl_slug ?? null;
  // A map slug the index does not list is a page that does not exist; skip it and let
  // the index decide, but only when the index is actually usable.
  if (mapSlug && (!indexUsable || indexBySlug.has(mapSlug))) return { flSlug: mapSlug, source: 'map' };
  if (indexUsable) {
    if (indexBySlug.has(teamSlug)) return { flSlug: teamSlug, source: 'index-slug' };
    const key = normKey(name);
    // Two clubs sharing a normalised name is a coin flip, not a match. Skip the index
    // rather than bind this product to whichever club sorted first.
    if (indexAmbiguous.has(key)) return { flSlug: teamSlug, source: 'team-slug-fallback', ambiguous: true };
    const hits = indexByName.get(key);
    if (hits?.length === 1) return { flSlug: hits[0].slug, source: 'index-name' };
  }
  return { flSlug: teamSlug, source: 'team-slug-fallback' };
}

// One entry per team; a team can own several products but needs one set of front views.
const byTeam = new Map();
const orphanProducts = [];
for (const p of rows ?? []) {
  const slug = p.teams?.slug ?? null;
  if (!slug) { orphanProducts.push({ id: p.id, title: p.title, team_id: p.team_id ?? null }); continue; }
  if (!byTeam.has(slug)) {
    const r = resolveSlug(slug, p.teams.name);
    byTeam.set(slug, {
      teamSlug: slug,
      name: p.teams.name,
      flSlug: r.flSlug,
      flSlugSource: r.source,
      ambiguousName: r.ambiguous === true,
      products: [],
    });
  }
  byTeam.get(slug).products.push(p.id);
}
const teams = [...byTeam.values()].sort((a, b) => a.teamSlug.localeCompare(b.teamSlug));

// 2. Crawl each club page and keep only the cover of each variant.
const pages = await pool(teams, PAGE_CONCURRENCY, async (t) => {
  // Try each candidate season, stopping at the first page that answers.
  const tries = [];
  let hit = null;
  let seasonUsed = null;
  for (const season of SITE_SEASONS) {
    const pageUrl = `${SITE}/kits/${t.flSlug}-${season}`;
    const r = await fetchPage(pageUrl);
    tries.push({ season, pageUrl, status: r.status });
    if (r.html !== null) { hit = r; seasonUsed = season; break; }
    if (r.status !== 404) break;
  }
  // The deciding status is the last attempt: a completed loop ends on a 404, an early
  // break ends on the transport failure. Anything else would be a claim the site has
  // no page when the probe simply failed.
  const pageStatus = tries[tries.length - 1].status;
  if (hit === null) return { ...t, pageUrl: tries[tries.length - 1].pageUrl, pageStatus, seasonUsed, seasonsTried: tries, variants: [], missingCovers: [], ignored: 0 };

  const variants = new Map();
  let ignored = 0;
  for (const m of hit.html.matchAll(/data-image="([^"]+)"/g)) {
    const info = parseImage(m[1], seasonUsed);
    if (!info) { ignored++; continue; }
    if (!variants.has(info.variant)) variants.set(info.variant, []);
    variants.get(info.variant).push(info);
  }

  const picked = [];
  const missingCovers = [];
  for (const variant of [...variants.keys()].sort(byVariant)) {
    const images = variants.get(variant);
    const covers = images.filter((i) => i.isCover);
    // No cover means no front view. Never substitute a numbered image: it may be posed.
    if (!covers.length) { missingCovers.push(variant); continue; }
    covers.sort((a, b) => Number(b.host === 'assets') - Number(a.host === 'assets') || a.url.localeCompare(b.url));
    picked.push({ variant, url: covers[0].url, source: 'cover', host: covers[0].host, dualHost: covers.length > 1 });
  }
  return { ...t, pageUrl: tries[tries.length - 1].pageUrl, pageStatus, seasonUsed, seasonsTried: tries, variants: picked, missingCovers, ignored };
});

const found = pages.filter((p) => p.pageStatus === 200);
const notFound = pages.filter((p) => p.pageStatus === 404);
const failed = pages.filter((p) => typeof p.pageStatus !== 'number');

// 3. Probe every chosen URL, keep only 200.
const chosen = found.flatMap((t) => t.variants.map((v) => ({ team: t, view: v })));
const statuses = await pool(chosen, PROBE_CONCURRENCY, (c) => probe(c.view.url));
chosen.forEach((c, i) => { c.view.status = statuses[i]; });

const dropped = chosen.filter((c) => c.view.status !== 200);

// 4. Materialise the output.
const out = {};
for (const t of pages) {
  out[t.teamSlug] = {
    name: t.name,
    fl_slug: t.flSlug,
    fl_slug_source: t.flSlugSource,
    season_used: t.seasonUsed,
    // Every season suffix actually requested, so the human report can say what was
    // tried instead of implying only one season was checked.
    seasons_tried: t.seasonsTried.map((x) => x.season),
    source: t.pageUrl,
    page_status: t.pageStatus,
    products: t.products,
    views: t.variants.filter((v) => v.status === 200),
    missing_covers: t.missingCovers,
  };
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');

// 5. Report.
const hostMix = {};
for (const t of Object.values(out)) for (const v of t.views) hostMix[v.host] = (hostMix[v.host] ?? 0) + 1;
const perTeam = {};
for (const t of Object.values(out)) perTeam[t.views.length] = (perTeam[t.views.length] ?? 0) + 1;
const noFront = Object.entries(out).filter(([, t]) => t.views.length === 0);
const variantMisses = Object.entries(out).flatMap(([slug, t]) => t.missing_covers.map((v) => `${t.name} (${slug}): ${v}`));
const ignoredTotal = pages.reduce((n, t) => n + (t.ignored ?? 0), 0);
const parseGapTeams = pages.filter((t) => (t.ignored ?? 0) > 0);

const srcCount = (s) => teams.filter((t) => t.flSlugSource === s).length;
const seasonCount = (s) => found.filter((p) => p.seasonUsed === s).length;
const notFoundBySource = {};
for (const t of notFound) notFoundBySource[t.flSlugSource] = (notFoundBySource[t.flSlugSource] ?? 0) + 1;
const srcBreak = (obj) => ['map', 'index-slug', 'index-name', 'team-slug-fallback']
  .map((s) => `${s}=${obj[s] ?? 0}`).join(' ');

console.log('=== 2026-27 kit front views (live FootyLogos crawl) ===');
console.log(`products season ${PRODUCT_SEASON} : ${rows?.length ?? 0} (category ${CATEGORY_SLUG})`);
console.log(`products without team      : ${orphanProducts.length}`);
console.log(`teams needing images       : ${teams.length}`);
console.log(`index entries parsed       : ${indexEntries.length} (${Object.entries(indexSeasonMix).map(([s, n]) => `${s}=${n}`).join(' ')})`);
console.log(`index anchors unparsed     : ${indexUnparsed.length}`);
console.log(`index name keys ambiguous  : ${indexAmbiguous.size}`);
if (!indexUsable) console.log(`index fetch status         : ${indexFetch.status}  WARNING: index unusable, fl_slug from map + team-slug guess only`);
console.log(`fl_slug from map           : ${srcCount('map')}`);
console.log(`fl_slug from index (slug)  : ${srcCount('index-slug')}`);
console.log(`fl_slug from index (name)  : ${srcCount('index-name')}`);
console.log(`fl_slug team-slug fallback : ${srcCount('team-slug-fallback')}`);
console.log(`pages found (HTTP 200)     : ${found.length}`);
console.log(`pages missing (HTTP 404)   : ${notFound.length} (${srcBreak(notFoundBySource)})`);
console.log(`pages failed (fetch error) : ${failed.length}`);
console.log(`season used 2026-27        : ${seasonCount('2026-27')}`);
console.log(`season used 2026           : ${seasonCount('2026')}`);
console.log(`variants chosen (cover)    : ${chosen.length}`);
console.log(`urls kept (HTTP 200)       : ${chosen.length - dropped.length}`);
console.log(`urls dropped by probe      : ${dropped.length}`);
console.log(`variants with NO cover     : ${variantMisses.length}`);
console.log(`images skipped (unparsed)  : ${ignoredTotal}${parseGapTeams.length ? ` (pages affected: ${parseGapTeams.map((t) => t.teamSlug).join(', ')})` : ''}`);
console.log(`source host                : ${Object.entries(hostMix).map(([h, n]) => `${h}=${n}`).join(' ')}`);
console.log(`front views per team       : ${Object.entries(perTeam).sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}=${c} teams`).join(', ')}`);

if (indexUnparsed.length) {
  console.log('index anchors with no club name (skipped):');
  for (const e of indexUnparsed) console.log(`    ${e.fl_slug} @${e.season}`);
}
if (orphanProducts.length) {
  console.log('products with null team_id:');
  for (const p of orphanProducts) console.log(`    ${p.id}  ${p.title}`);
}
const ambiguousTeams = teams.filter((t) => t.ambiguousName);
if (ambiguousTeams.length) {
  console.log('ambiguous normalised name in index (index entry skipped, not guessed):');
  for (const t of ambiguousTeams) console.log(`    ${t.teamSlug} -> ${t.name} (${t.flSlug})`);
}
const notFromMap = teams.filter((t) => t.flSlugSource !== 'map');
if (notFromMap.length) {
  console.log('fl_slug NOT from the map:');
  for (const t of notFromMap) console.log(`    ${t.teamSlug} -> ${t.flSlug}  (${t.flSlugSource})`);
}
if (variantMisses.length) {
  console.log('variants with no cover (no front view):');
  for (const m of variantMisses) console.log(`    ${m}`);
}
if (dropped.length) {
  console.log('dropped by probe:');
  for (const d of dropped) console.log(`    [${d.view.status}] ${d.team.teamSlug} ${d.view.variant}  ${d.view.url}`);
}
if (noFront.length) {
  console.log('teams with ZERO front views:');
  for (const [slug, t] of noFront) {
    const why = t.page_status === 404 ? `no page (tried ${SITE_SEASONS.join(', ')})`
      : typeof t.page_status === 'number' ? `HTTP ${t.page_status}`
        : `fetch ${t.page_status}`;
    console.log(`    ${slug} (${t.name})  ${why}  [${t.fl_slug_source}]${t.missing_covers.length ? ` | variants without cover: ${t.missing_covers.join(', ')}` : ''}`);
  }
}
console.log(`wrote ${OUT}`);
