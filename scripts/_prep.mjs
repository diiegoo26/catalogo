import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: products } = await sb.from('products').select('id,title,slug');
const { data: teams } = await sb.from('teams')
  .select('id,name,slug,league_id,leagues(slug,name,regions(slug,name))');
const { data: leagues } = await sb.from('leagues').select('id,name,slug,region_id,regions(slug,name)');

const deacc = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const STOP = new Set(['de','del','la','el','los','las','fc','cd','ud','cf','ac','as','sc','ca','rc','sv','sd','club','atletico','athletic','city','united','sports','1','a','al','the']);
const norm = (s) => deacc(s.toLowerCase()).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter((w)=>w&&!STOP.has(w)).join('');

function extract(title) {
  return deacc(title)
    .replace(/\d{4}/g, ' ')
    .replace(/(camiseta|conjunto deportivo|player versi.n|jersey|playera)\b/gi, ' ')
    .split(/\s+/).filter((w) => w && !/^ni.{0,2}$/i.test(w) && !/^(infantil|junior|version|player)$/i.test(w))
    .join(' ').trim();
}

const cur = new Set();
for (const t of teams) cur.add(norm(t.name));
for (const l of leagues) cur.add(norm(l.name));
for (const t of teams) cur.add(norm(t.leagues.regions.name));

const base = new Map();
for (const p of products) {
  const b = extract(p.title);
  if (!base.has(b)) base.set(b, []);
  base.get(b).push(p.slug);
}

console.log(`productos=${products.length}  nombres base=${base.size}  equipos=${teams.length}  ligas=${leagues.length}`);
console.log('\n### BASE NAMES (orden) ###');
for (const b of [...base.keys()].sort()) {
  const tag = cur.has(norm(b)) ? 'EXISTE' : 'HUERFANO';
  console.log(`${tag}\t${base.get(b).length}\t${b}`);
}
