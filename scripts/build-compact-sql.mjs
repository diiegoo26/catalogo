// Builds supabase/equipaciones-2026-27-plan.json (authoritative full URL lists) and
// supabase/equipaciones-2026-27-compact.sql (a compact, verifiable application script).
//
// Why two artifacts:
//   * plan.json  â€” full absolute URLs per club, for audit and rollback.
//   * compact.sql â€” the same data encoded as (folder, kind, index-range) groups so the whole
//     migration fits in a single SQL statement instead of ~290 KB of literal arrays.
// The builder reconstructs every URL from the compact encoding and refuses to emit anything
// unless the reconstruction matches the original URL list byte for byte.
//
// Run: node scripts/build-compact-sql.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const sql = readFileSync('supabase/equipaciones-2026-27-imagenes.sql', 'utf8');
const blocks = [...sql.matchAll(/-- (.+?) Â· source: (\S+) \(([^)]*)\)\nupdate products p set images = '(\[.*?\])'::jsonb\n  from teams t where t\.id = p\.team_id and t\.slug = '(.*?)';/g)];
if (!blocks.length) throw new Error('no blocks parsed from the generated SQL');

const RX = /^https:\/\/assets\.footylogos\.com\/kits\/(\d{4}(?:-\d{2})?)\/([a-z0-9-]+)\/([^/]+)\/(cover|\d{1,3})-(.+?)-(\d{4}(?:-\d{2})?)-([a-z]+)-kit-footylogos\.(jpg|jpeg|png|webp)$/;
// The spec carries the full kind word (home/away/third/...), so no code mapping is needed here.


const plan = {};
const rows = [];
let nPhotos = 0;

for (const [, name, source, , arr, teamSlug] of blocks) {
  const urls = JSON.parse(arr.replace(/''/g, "'"));
  nPhotos += urls.length;
  let meta = null;

  // Build the spec as consecutive runs in the ORIGINAL order: folder::kind::tokens,
  // runs separated by ';'. A run ends as soon as (folder, kind) changes, so the rebuilt
  // list is byte-identical to the source list, not merely set-equal.
  const specParts = [];
  let run = null;
  const flush = () => {
    if (!run) return;
    const tokens = [];
    tokens.push(...run.covers.map(() => 'c'));
    const nums = run.nums.slice().sort((a, b) => a - b);
    let i = 0;
    while (i < nums.length) {
      let j = i;
      while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      tokens.push(i === j ? String(nums[i]).padStart(2, '0') : `${String(nums[i]).padStart(2, '0')}-${String(nums[j]).padStart(2, '0')}`);
      i = j + 1;
    }
    specParts.push(`${run.folder}::${run.kind}::${tokens.join(',')}`);
    run = null;
  };
  for (const u of urls) {
    const m = RX.exec(u);
    if (!m) throw new Error(`unparsed url for ${teamSlug}: ${u}`);
    const [, season, league, folder, idx, clubfile, s2, kind, ext] = m;
    const thisMeta = { season, league, clubfile, s2, ext };
    if (!meta) meta = thisMeta;
    else if (JSON.stringify(meta) !== JSON.stringify(thisMeta)) {
      throw new Error(`per-club constants vary for ${teamSlug}: ${u}`);
    }
    if (!run || run.folder !== folder || run.kind !== kind) {
      flush();
      run = { folder, kind, covers: [], nums: [] };
    }
    if (idx === 'cover') run.covers.push(u);
    else run.nums.push(Number(idx));
  }
  flush();
  const spec = specParts.join(';');

  // Reconstruct exactly as the SQL function will, and compare.
  const rebuilt = [];
  for (const part of spec.split(';')) {
    const [folder, kind, toks] = part.split('::');
    for (const tok of toks.split(',')) {
      const idxs = tok === 'c' ? ['cover']
        : tok.includes('-')
          ? Array.from({ length: Number(tok.split('-')[1]) - Number(tok.split('-')[0]) + 1 }, (_, k) => String(Number(tok.split('-')[0]) + k).padStart(2, '0'))
          : [tok];
      for (const idx of idxs) {
        rebuilt.push(`https://assets.footylogos.com/kits/${meta.season}/${meta.league}/${folder}/${idx}-${meta.clubfile}-${meta.s2}-${kind}-kit-footylogos.${meta.ext}`);
      }
    }
  }
  const same = rebuilt.length === urls.length && rebuilt.every((u, k) => u === urls[k]);
  if (!same) {
    const firstDiff = rebuilt.findIndex((u, k) => u !== urls[k]);
    throw new Error(`round-trip mismatch for ${teamSlug} at ${firstDiff}: ${rebuilt[firstDiff]} != ${urls[firstDiff]}`);
  }

  plan[teamSlug] = { name, source, urls };
  rows.push({ teamSlug, name, season: meta.season, league: meta.league, clubfile: meta.clubfile, season2: meta.s2, ext: meta.ext, spec });
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const out = [];
out.push('-- ============================================================================');
out.push('-- KOVA - Imagenes reales 2026-27 (FootyLogos) - script compacto y verificado');
out.push('-- Generado por scripts/build-compact-sql.mjs a partir de');
out.push('-- supabase/equipaciones-2026-27-imagenes.sql. NO editar a mano.');
out.push(`-- ${rows.length} clubes - ${nPhotos} fotos - round-trip verificado 1:1.`);
out.push('-- ============================================================================');
out.push('begin;');
out.push('');
out.push('create or replace function pg_temp.kit_urls(prefix text, clubfile text, season text, ext text, spec text)');
out.push('returns jsonb language sql immutable as $fn$');
out.push('with runs as (');
out.push("  select split_part(p,'::',1) as folder, split_part(p,'::',2) as kind, split_part(p,'::',3) as toks, ro as run_ord");
out.push("  from regexp_split_to_table(spec, ';') with ordinality as x(p, ro)");
out.push('), tks as (');
out.push('  select folder, kind, toks, run_ord, tk.tok, vo as tok_ord');
out.push("  from runs, regexp_split_to_table(runs.toks, ',') with ordinality as tk(tok, vo)");
out.push('), parsed as (');
out.push('  select folder, kind, run_ord, tok, tok_ord,');
out.push("         case when tok = 'c' then 0 else split_part(tok, '-', 1)::int end as lo,");
out.push("         case when tok = 'c' then 0");
out.push("              when position('-' in tok) > 0 then split_part(tok, '-', 2)::int");
out.push("              else split_part(tok, '-', 1)::int end as hi");
out.push('  from tks');
out.push('), expanded as (');
out.push('  select folder, kind, run_ord, tok_ord,');
out.push("         case when tok = 'c' then 'cover' else lpad((lo + gs.n - 1)::text, 2, '0') end as idx");
out.push('  from parsed cross join lateral generate_series(1, hi - lo + 1) as gs(n)');
out.push(')');
out.push('select jsonb_agg(');
out.push("  prefix || folder || '/' || idx || '-' || clubfile || '-' || season || '-' ||");
out.push("  kind || '-kit-footylogos.' || ext");
out.push('  order by run_ord, tok_ord, idx)');
out.push('from expanded;');
out.push('$fn$;');
out.push('');
out.push('update products p set images = pg_temp.kit_urls(');
out.push('    v.prefix || v.league || \'/\', v.clubfile, v.season, v.ext, v.spec)');
out.push('  from (values');
out.push(rows.map((r) => `    (${q(r.teamSlug)}, ${q('https://assets.footylogos.com/kits/' + r.season + '/')}, ${q(r.league)}, ${q(r.clubfile)}, ${q(r.season2)}, ${q(r.ext)}, ${q(r.spec)})`).join(',\n'));
out.push('  ) as v(team_slug, prefix, league, clubfile, season, ext, spec)');
out.push('  join teams t on t.slug = v.team_slug');
out.push(' where p.team_id = t.id;');
out.push('');
out.push('commit;');
out.push('');

writeFileSync('supabase/equipaciones-2026-27-plan.json', JSON.stringify(plan, null, 1) + '\n');
writeFileSync('supabase/equipaciones-2026-27-compact.sql', out.join('\n'));
const size = out.join('\n').length;
console.log(`clubs: ${rows.length}  photos: ${nPhotos}  round-trip: verified`);
console.log(`compact.sql bytes: ${size}  (full literal version was ${sql.length})`);
