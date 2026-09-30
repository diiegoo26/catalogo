// Compares the teams that actually have 2026-27 equipaciones products against the
// teams present in supabase/equipaciones-2026-27-plan.json, and reports the gap.
// Read-only. Run: node scripts/check-team-coverage.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const plan = JSON.parse(readFileSync('supabase/equipaciones-2026-27-plan.json', 'utf8'));
const map = JSON.parse(readFileSync('scripts/equipaciones-2026-27-map.json', 'utf8'));

const { data: cat } = await sb.from('categories').select('id').eq('slug', 'equipaciones').single();
const { data: rows, error } = await sb
  .from('products')
  .select('teams!inner(slug, name)')
  .eq('season', '2026-27')
  .eq('category_id', cat.id);
if (error) throw error;

const bySlug = new Map();
for (const r of rows) {
  const t = Array.isArray(r.teams) ? r.teams[0] : r.teams;
  bySlug.set(t.slug, t.name);
}

const need = [...bySlug.keys()].sort();
const have = new Set(Object.keys(plan));
const missing = need.filter((s) => !have.has(s));

console.log(`equipos con productos 2026-27: ${need.length}`);
console.log(`equipos en plan.json:           ${have.size}`);
console.log(`faltan en plan.json:            ${missing.length}\n`);

if (missing.length) {
  console.log('-- faltantes --');
  for (const s of missing) {
    const m = map[s];
    console.log(`  ${s.padEnd(30)} ${bySlug.get(s)}${m ? `   [map: ${m.fl_slug} / ${m.how}]` : '   [sin entrada en map.json]'}`);
  }
}
