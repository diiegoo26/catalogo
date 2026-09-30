// Asserts the curated mapping artifact: entry count, exclusions, and that every mapped
// FootyLogos page exists (HTTP 200). Run: node scripts/check-map-equipaciones-2026-27.mjs
import { readFileSync } from 'node:fs';

const BRAZIL_2026 = new Set(['athletico-paranaense', 'sc-internacional', 'santos-fc', 'bahia', 'botafogo',
  'chapecoense', 'corinthians', 'coritiba', 'cruzeiro', 'flamengo', 'fluminense', 'gremio', 'palmeiras',
  'rb-bragantino', 'sao-paulo', 'vasco-da-gama', 'vitoria', 'mirassol-fc', 'inter-miami', 'new-york-city-fc',
  'atletico-mineiro', 'club-de-remo']);

const map = JSON.parse(readFileSync('scripts/equipaciones-2026-27-map.json', 'utf8'));
const keys = Object.keys(map);
const problems = [];

if (!('america-de-cali' in map)) { /* good */ } else problems.push('america-de-cali present');
if (!('rangers-fc' in map)) { /* good */ } else problems.push('rangers-fc present');

for (const [ourSlug, info] of Object.entries(map)) {
  const url = `https://www.footylogos.com/kits/${info.fl_slug}-2026-27`;
  let status = 0;
  try {
    status = (await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } })).status;
  } catch {
    status = 'err';
  }
  if (status !== 200) {
    const alt = `https://www.footylogos.com/kits/${info.fl_slug}-2026`;
    let altStatus = 0;
    try {
      altStatus = (await fetch(alt, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } })).status;
    } catch {
      altStatus = 'err';
    }
    if (altStatus === 200 && BRAZIL_2026.has(info.fl_slug)) {
      problems.push(`${ourSlug} -> ${info.fl_slug}: only -2026 page (allowed)`);
    } else {
      problems.push(`${ourSlug} -> ${info.fl_slug}: ${status} / alt ${altStatus}`);
    }
  }
}

console.log(`entries: ${keys.length}  excluded-ok: ${!('america-de-cali' in map) && !('rangers-fc' in map)}`);
console.log('problems:', problems.length);
for (const p of problems) console.log('  -', p);
console.log(problems.length === 0 && keys.length === 117 ? 'PASS' : 'REVIEW');
