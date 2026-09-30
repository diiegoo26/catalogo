// Analyses the generated SQL to find a compact, lossless encoding for the photo URLs.
// Run: node scripts/analyze-kit-encoding.mjs
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/equipaciones-2026-27-imagenes.sql', 'utf8');
const blocks = [...sql.matchAll(/-- (.+?) · source: (\S+) \(([^)]*)\)\n(?:.|\n)*?set images = '(\[.*?\])'::jsonb/g)];

const RX = /^https:\/\/assets\.footylogos\.com\/kits\/(\d{4}(?:-\d{2})?)\/([a-z0-9-]+)\/(batch-\d+)\/(cover|\d{1,3})-(.+?)-(\d{4}(?:-\d{2})?)-([a-z]+)-kit-footylogos\.(jpg|jpeg|png|webp)$/;

let nPhotos = 0;
const issues = [];
const stat = { prefixVaries: 0, clubfileVaries: 0, extVaries: 0, batchVariesPerKind: 0, nonContiguous: 0, coverMissing: 0 };
const prefixLen = new Map(), encodedLen = new Map();

for (const [, name, , , arr] of blocks) {
  const urls = JSON.parse(arr.replace(/''/g, "'"));
  nPhotos += urls.length;
  const parsed = urls.map((u) => {
    const m = RX.exec(u);
    if (!m) { issues.push(`unparsed: ${u}`); return null; }
    return { season: m[1], league: m[2], batch: m[3], idx: m[4], clubfile: m[5], s2: m[6], kind: m[7], ext: m[8] };
  }).filter(Boolean);

  const uniq = (f) => new Set(parsed.map(f));
  if (uniq((p) => `${p.season}/${p.league}`).size > 1) stat.prefixVaries++;
  if (uniq((p) => p.clubfile).size > 1) stat.clubfileVaries++;
  if (uniq((p) => `${p.s2}`).size > 1) stat.clubfileVaries++;
  if (uniq((p) => p.ext).size > 1) stat.extVaries++;

  const byKind = new Map();
  for (const p of parsed) (byKind.get(p.kind) ?? byKind.set(p.kind, []).get(p.kind)).push(p);
  for (const [, list] of byKind) {
    if (new Set(list.map((p) => p.batch)).size > 1) stat.batchVariesPerKind++;
    const nums = list.filter((p) => p.idx !== 'cover').map((p) => Number(p.idx)).sort((a, b) => a - b);
    const contiguous = nums.every((v, i) => i === 0 || v === nums[i - 1] + 1);
    if (!contiguous) stat.nonContiguous++;
    if (!list.some((p) => p.idx === 'cover')) stat.coverMissing++;
  }
  prefixLen.set(name, Math.max(...parsed.map((p) => `https://assets.footylogos.com/kits/${p.season}/${p.league}/`.length)));
  encodedLen.set(name, parsed.length);
}

console.log(`clubs: ${blocks.length}  photos: ${nPhotos}`);
console.log('structure issues:', stat);
console.log('unparsed:', issues.length);
const pl = [...prefixLen.values()].sort((a, b) => a - b);
const el = [...encodedLen.values()].sort((a, b) => a - b);
console.log(`prefix chars: min=${pl[0]} max=${pl[pl.length - 1]}`);
console.log(`photos/club: min=${el[0]} max=${el[el.length - 1]}`);
const fullBytes = sql.length;
console.log(`full SQL bytes: ${fullBytes}`);
