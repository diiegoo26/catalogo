// Computes the merged 2026-27 gallery per club (assets host preferred per variant, www host as
// fallback per variant) and emits supabase/equipaciones-2026-27-fill-www.sql, a SMALL script that
// either prepends the missing variants (clubs already carrying assets photos) or replaces the
// whole gallery (clubs whose only photos live on the www host).
//
// It also rewrites supabase/equipaciones-2026-27-plan.json with the merged expectation used by
// scripts/verify-equipaciones-2026-27.mjs.
//
// Run: node scripts/build-fill-sql.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const UA = { 'User-Agent': 'Mozilla/5.0' };
const map = JSON.parse(readFileSync('scripts/equipaciones-2026-27-map.json', 'utf8'));
// The pristine assets-only galleries come from the generated full SQL (never from plan.json,
// which this script overwrites with the merged result).
const fullSql = readFileSync('supabase/equipaciones-2026-27-imagenes.sql', 'utf8');
const assetsPlan = {};
for (const m of fullSql.matchAll(/-- (.+?) . source: (\S+) \(([^)]*)\)\nupdate products p set images = '(\[.*?\])'::jsonb\n  from teams t where t\.id = p\.team_id and t\.slug = '(.*?)';/g)) {
  assetsPlan[m[5]] = { name: m[1], source: m[2], urls: JSON.parse(m[4].replace(/''/g, "'")) };
}
const ORDER = ['home', 'away', 'third', 'fourth', 'anniversary'];

async function page(fl) {
  for (const season of ['2026-27', '2026']) {
    const r = await fetch(`https://www.footylogos.com/kits/${fl}-${season}`, { headers: UA });
    if (r.status === 200) return { season, html: await r.text() };
  }
  return null;
}

const WEB = /https:\/\/www\.footylogos\.com\/kits\/([a-z0-9-]+?)-(\d{4}-\d{2}|\d{4})\/([a-z]+)-(cover|\d{1,3})\.(?:webp|png|jpe?g)/g;

function kindOfAssetUrl(u) {
  const f = u.split('/').pop();
  const m = /^(?:cover|\d{1,3})-.*?-(\d{4}-\d{2}|\d{4})-([a-z]+)-kit-footylogos\./.exec(f);
  return m ? m[2] : null;
}

const fill = [];
const plan = {};
let photos = 0;

for (const [ourSlug, info] of Object.entries(map).sort()) {
  const existing = assetsPlan[ourSlug]?.urls ?? [];
  const p = await page(info.fl_slug);
  if (!p) {
    if (existing.length) plan[ourSlug] = { ...assetsPlan[ourSlug] };
    continue;
  }
  const web = {};
  for (const m of p.html.matchAll(WEB)) {
    const [, slug, season, kind, num] = m;
    if (slug !== info.fl_slug || season !== p.season) continue;
    (web[kind] ??= []).push([num === 'cover' ? 0 : Number(num), m[0]]);
  }
  for (const k of Object.keys(web)) {
    const seen = new Set();
    web[k] = web[k].sort((a, b) => a[0] - b[0]).filter(([, u]) => (seen.has(u) ? false : seen.add(u)));
  }

  const urlsOf = (k) => web[k].map(([, u]) => u);
  const assetsByKind = {};
  for (const u of existing) {
    const k = kindOfAssetUrl(u) ?? 'other';
    (assetsByKind[k] ??= []).push(u);
  }
  const allKinds = [...new Set([...ORDER, ...Object.keys(assetsByKind), ...Object.keys(web)])];
  const missing = allKinds.filter((k) => web[k]?.length && !assetsByKind[k]?.length);
  if (!missing.length) { plan[ourSlug] = { ...assetsPlan[ourSlug] }; continue; }

  // Interleave by variant: for each kind, assets photos win; otherwise the www photos.
  const merged = [];
  for (const k of allKinds) {
    if (assetsByKind[k]?.length) merged.push(...assetsByKind[k]);
    else if (web[k]?.length) merged.push(...urlsOf(k));
  }
  const add = missing.flatMap((k) => urlsOf(k));
  plan[ourSlug] = { ...(assetsPlan[ourSlug] ?? { name: info.name, source: assetsPlan[ourSlug]?.source ?? '' }), urls: merged };
  photos += add.length;

  // spec for the www fill: kind::c,01-14 per variant (tokens come from the numeric index)
  const spec = missing.map((k) => {
    const nums = web[k].map(([n]) => n).filter((n) => n > 0).sort((a, b) => a - b);
    const hasCover = web[k].some(([n]) => n === 0);
    const tokens = [];
    if (hasCover) tokens.push('c');
    let i = 0;
    while (i < nums.length) {
      let j = i;
      while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      tokens.push(i === j ? String(nums[i]).padStart(2, '0') : `${String(nums[i]).padStart(2, '0')}-${String(nums[j]).padStart(2, '0')}`);
      i = j + 1;
    }
    return `${k}::${tokens.join(',')}`;
  }).join(';');

  const extMatch = /\.([a-z]+)$/.exec(add[0]);
  fill.push({ ourSlug, slug: info.fl_slug, season: p.season, ext: extMatch[1], spec, mode: existing.length ? 'prepend' : 'replace', n: add.length });
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const fnSig = 'create or replace function pg_temp.web_urls(base text, slug text, season text, ext text, spec text)';
const fnBody = `with runs as (
  select split_part(p,'::',1) as kind, split_part(p,'::',2) as toks, ro as run_ord
  from regexp_split_to_table(spec, ';') with ordinality as x(p, ro)
), tks as (
  select kind, run_ord, tk.tok, vo as tok_ord
  from runs, regexp_split_to_table(runs.toks, ',') with ordinality as tk(tok, vo)
), parsed as (
  select kind, run_ord, tok, tok_ord,
         case when tok = 'c' then 0 else split_part(tok, '-', 1)::int end as lo,
         case when tok = 'c' then 0
              when position('-' in tok) > 0 then split_part(tok, '-', 2)::int
              else split_part(tok, '-', 1)::int end as hi
  from tks
), expanded as (
  select kind, run_ord, tok_ord,
         case when tok = 'c' then 'cover' else lpad((lo + gs.n - 1)::text, 2, '0') end as num
  from parsed cross join lateral generate_series(1, hi - lo + 1) as gs(n)
)
select jsonb_agg(base || slug || '-' || season || '/' || kind || '-' || num || '.' || ext
                 order by run_ord, tok_ord, num)
from expanded`;

const byMode = (m) => fill.filter((f) => f.mode === m);
const valuesFor = (rows) => rows.map((r) =>
  `    (${q(r.ourSlug)}, ${q(r.slug)}, ${q(r.season)}, ${q(r.ext)}, ${q(r.spec)})`).join(',\n');

const out = [];
out.push('-- ============================================================================');
out.push('-- KOVA - Relleno de variantes que solo existen en www.footylogos.com');
out.push('-- Generado por scripts/build-fill-sql.mjs. NO editar a mano.');
out.push(`-- ${fill.length} clubes - ${photos} fotos - prepend ${byMode('prepend').length} / replace ${byMode('replace').length}`);
out.push('-- ============================================================================');
out.push('begin;');
out.push('');
out.push(fnSig);
out.push('returns jsonb language sql immutable as $fn$');
out.push(fnBody + ';');
out.push('$fn$;');
out.push('');
out.push('-- Rango de la variante dentro de la galeria: local, visitante, tercera, ...');
out.push('create or replace function pg_temp.kind_rank(u text) returns int language sql immutable as $kr$');
out.push("  select case when u like '%-home-kit-footylogos.%' or u ~ '/home-' then 1");
out.push("              when u like '%-away-kit-footylogos.%' or u ~ '/away-' then 2");
out.push("              when u like '%-third-kit-footylogos.%' or u ~ '/third-' then 3");
out.push("              when u like '%-fourth-kit-footylogos.%' or u ~ '/fourth-' then 4");
out.push("              when u like '%-anniversary-kit-footylogos.%' or u ~ '/anniversary-' then 5");
out.push('              else 6 end');
out.push('$kr$;');
out.push('');
for (const mode of ['replace', 'prepend']) {
  const rows = byMode(mode);
  if (!rows.length) continue;
  out.push(mode === 'prepend'
    ? '-- Antepone las variantes que faltaban, respetando el orden local > visitante > tercera.'
    : '-- Estos clubes no tenian fotos en assets: la galeria de www los sustituye por completo.');
  if (mode === 'prepend') {
    out.push('update products p set images = (');
    out.push('    select jsonb_agg(u order by rnk, src, ord)');
    out.push('    from (');
    out.push("      select u, pg_temp.kind_rank(u) as rnk, 0 as src, ord");
    out.push("      from jsonb_array_elements_text(pg_temp.web_urls('https://www.footylogos.com/kits/', v.slug, v.season, v.ext, v.spec)) with ordinality as w(u, ord)");
    out.push('      union all');
    out.push('      select u, pg_temp.kind_rank(u) as rnk, 1 as src, ord');
    out.push('      from jsonb_array_elements_text(p.images) with ordinality as e(u, ord)');
    out.push('    ) s');
    out.push('  )');
    out.push('  from (values');
  } else {
    out.push("update products p set images = pg_temp.web_urls('https://www.footylogos.com/kits/', v.slug, v.season, v.ext, v.spec)");
    out.push('  from (values');
  }
  out.push(valuesFor(rows));
  out.push('  ) as v(team_slug, slug, season, ext, spec)');
  out.push('  join teams t on t.slug = v.team_slug');
  out.push(' where p.team_id = t.id;');
  out.push('');
}
out.push('commit;');
out.push('');

writeFileSync('supabase/equipaciones-2026-27-fill-www.sql', out.join('\n'));
writeFileSync('supabase/equipaciones-2026-27-plan.json', JSON.stringify(plan, null, 1) + '\n');
const total = Object.values(plan).reduce((a, v) => a + v.urls.length, 0);
console.log(`clubs with a merged gallery: ${Object.keys(plan).length}`);
console.log(`fill clubs: ${fill.length} (prepend ${byMode('prepend').length}, replace ${byMode('replace').length})  added photos: ${photos}`);
console.log(`planned urls total: ${total}   fill sql bytes: ${out.join('\n').length}`);
