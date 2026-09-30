// Prints md5 hashes of the expected URL lists (joined with \n) for a few clubs, plus the
// ready-to-send dry-run SQL that computes the same hash with the pg_temp.kit_urls function.
// Run: node scripts/dryrun-kit-urls.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const plan = JSON.parse(readFileSync('supabase/equipaciones-2026-27-plan.json', 'utf8'));
const compact = readFileSync('supabase/equipaciones-2026-27-compact.sql', 'utf8');
const rows = [...compact.matchAll(/^\s{4}\('([a-z0-9-]+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)'\),?$/gm)]
  .map((m) => ({ team: m[1], prefix: m[2], league: m[3], clubfile: m[4], season: m[5], ext: m[6], spec: m[7] }));
console.log('spec rows parsed:', rows.length);

const pick = ['arsenal', 'napoli', 'celtic-fc', 'santos', 'schalke-04', 'boro'];

const fields = (m) => `'${m.prefix}' || '${m.league}' || '/' , '${m.clubfile}', '${m.season}', '${m.ext}', '${m.spec}'`;
const values = rows.filter((r) => pick.includes(r.team)).map((m) =>
  `    ('${m.team}', ${fields(m)})`).join(',\n');

const fn = compact.split('returns jsonb language sql immutable as $fn$\n')[1].split('$fn$;')[0];

for (const t of pick) {
  const m = rows.find((r) => r.team === t);
  if (!m) continue;
  const urls = plan[t]?.urls ?? [];
  console.log(`${t}: n=${urls.length} md5=${createHash('md5').update(urls.join('\n')).digest('hex')}`);
}

console.log('\n--- dry run sql ---');
console.log(`create or replace function pg_temp.kit_urls${fn}$fn$;
select v.team_slug, jsonb_array_length(pg_temp.kit_urls(v.prefix || v.league || '/', v.clubfile, v.season, v.ext, v.spec)) as n,
       md5(array_to_string(array(select jsonb_array_elements_text(pg_temp.kit_urls(v.prefix || v.league || '/', v.clubfile, v.season, v.ext, v.spec))), E'\\n')) as md5
from (values
${values}
) as v(team_slug, prefix, league, clubfile, season, ext, spec);`);
