// Asserts the merged plan obeys the design policy:
//   * every url is on assets.footylogos.com or www.footylogos.com
//   * no duplicate url inside a club
//   * variant rank is non-decreasing (home, away, third, fourth, anniversary, other)
//   * within one variant, all photos come from the SAME host (assets wins, else www)
// Run: node scripts/assert-plan-shape.mjs
import { readFileSync } from 'node:fs';

const plan = JSON.parse(readFileSync('supabase/equipaciones-2026-27-plan.json', 'utf8'));
const RANK = ['home', 'away', 'third', 'fourth', 'anniversary'];

function kindOf(u) {
  const asset = /^(?:cover|\d{1,3})-.*?-(\d{4}-\d{2}|\d{4})-([a-z]+)-kit-footylogos\./.exec(u.split('/').pop());
  if (asset) return { kind: asset[2], host: 'assets' };
  const web = /\/([a-z]+)-(?:cover|\d{1,3})\.(?:webp|png|jpe?g)$/.exec(u);
  if (web) return { kind: web[1], host: 'www' };
  return { kind: 'unknown', host: 'unknown' };
}
const rank = (k) => {
  const i = RANK.indexOf(k);
  return i === -1 ? 99 : i;
};

const problems = [];
let photos = 0;
for (const [slug, rec] of Object.entries(plan)) {
  const urls = rec.urls ?? [];
  photos += urls.length;
  if (!urls.length) { problems.push(`${slug}: empty gallery`); continue; }
  if (new Set(urls).size !== urls.length) problems.push(`${slug}: duplicate urls`);
  const hosts = {};
  let lastRank = -1;
  for (const u of urls) {
    if (!/^https:\/\/(assets|www)\.footylogos\.com\//.test(u)) problems.push(`${slug}: unexpected host ${u}`);
    const { kind, host } = kindOf(u);
    if (kind === 'unknown') problems.push(`${slug}: unparseable url ${u}`);
    if (hosts[kind] && hosts[kind] !== host) problems.push(`${slug}: kind ${kind} mixes hosts`);
    hosts[kind] = host;
    const r = rank(kind);
    if (r < lastRank) problems.push(`${slug}: ${kind} appears after ${RANK[lastRank]}`);
    lastRank = r;
  }
}

console.log(`clubs: ${Object.keys(plan).length}   photos: ${photos}`);
console.log(`problems: ${problems.length}`);
for (const p of problems.slice(0, 15)) console.log('  -', p);
console.log(problems.length === 0 ? 'PASS' : 'FAIL');
