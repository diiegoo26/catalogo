// Builds scripts/equipaciones-2026-27-map.json: our team slug -> FootyLogos club slug.
//
// The resolution below was validated during design (the 275 club pages linked from
// https://www.footylogos.com/football-kits were crawled and every resulting photo URL
// returned HTTP 200). Two fuzzy matches point at the WRONG club and are excluded:
//   america-de-cali -> club-america   (Mexican Club America, not the Colombian club)
//   rangers-fc      -> queens-park-rangers
//
// Run: node scripts/map-equipaciones-2026-27.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Hand-reviewed resolutions for clubs whose FootyLogos slug differs from ours.
const MANUAL = {
  'athletic-club': 'athletic-club-bilbao',
  'atletico-de-madrid': 'atletico-madrid',
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
  'deportivo': 'deportivo-la-coruna',
  'santos': 'santos-fc',
  'paranaense': 'athletico-paranaense',
  'internacional': 'sc-internacional',
  'atlas-fc': 'atlas',
  'tijuana': 'club-tijuana',
  'remo': 'club-de-remo',
};
const EXCLUDE = new Set(['america-de-cali', 'rangers-fc']);

const res = await fetch('https://www.footylogos.com/football-kits');
const html = await res.text();
const pages = new Set([...html.matchAll(/\/kits\/([a-z0-9-]+?)-(?:2026-27|2026|2026-world-cup)"/g)]
  .map((m) => m[1]));

const STOP = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'as', 'cd', 'ud', 'rc', 'sv', 'club', 'de', 'the', 'calcio', 'sco', 'om', '1907']);
const deacc = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const toks = (s) => new Set(deacc(s).replace(/&/g, ' and ').split(/[^a-z0-9]+/)
  .filter((t) => t && !STOP.has(t)));
const key = (s) => [...toks(s)].sort().join(' ');

const byKey = new Map();
for (const p of pages) byKey.set(key(p), p);

const { data: allTeams, error } = await sb.from('teams').select('slug,name,products(count)');
if (error) throw error;
const teams = allTeams.filter((t) => (t.products?.[0]?.count ?? 0) > 0);

const map = {};
for (const t of teams) {
  if (EXCLUDE.has(t.slug)) continue;
  let fl = MANUAL[t.slug] ?? (pages.has(t.slug) ? t.slug : null);
  let how = MANUAL[t.slug] ? 'manual' : 'exact';
  if (!fl) {
    const cand = byKey.get(key(t.slug)) ?? byKey.get(key(t.name));
    if (cand) { fl = cand; how = 'norm'; }
  }
  if (!fl) continue;
  map[t.slug] = { fl_slug: fl, name: t.name, how };
}

writeFileSync('scripts/equipaciones-2026-27-map.json', JSON.stringify(map, null, 1) + '\n');
console.log(`mapping entries: ${Object.keys(map).length}`);
