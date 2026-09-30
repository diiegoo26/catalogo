// Read-only: matches every 2026-27 team against the authoritative FootyLogos
// /kits index to establish the real coverage ceiling before any write.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const map = JSON.parse(readFileSync('scripts/equipaciones-2026-27-map.json', 'utf8'));
const idxRaw = JSON.parse(readFileSync('supabase/equipaciones-2026-27-frentes.json', 'utf8'));

const { data: cat } = await sb.from('categories').select('id').eq('slug', 'equipaciones').single();
const { data: rows, error } = await sb
  .from('products')
  .select('teams!inner(slug, name)')
  .eq('season', '2026-27')
  .eq('category_id', cat.id);
if (error) throw error;

const teams = new Map();
for (const r of rows) {
  const t = Array.isArray(r.teams) ? r.teams[0] : r.teams;
  if (t) teams.set(t.slug, t.name);
}

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const found = idxRaw.found ?? {};
console.log(`teams con productos 2026-27: ${teams.size}`);
console.log(`paginas de club en el indice footylogos: 241 (191 = 2026-27, 50 = 2026)`);
console.log(`ya resueltos por el crawler: ${Object.keys(found).length}\n`);

const missing = [...teams.keys()].filter((s) => !found[s]);
console.log(`sin pagina segun el crawler: ${missing.length}\n`);
console.log('-- estos NO estan en el indice /kits (footylogos no los publica) --');
for (const s of missing) {
  const hint = map[s] ? `map=${map[s].fl_slug}` : 'sin map';
  console.log(`  ${s.padEnd(28)} ${teams.get(s).padEnd(26)} ${hint}`);
}
