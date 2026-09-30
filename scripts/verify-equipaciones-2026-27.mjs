// Verifies the live database against the generated plan and the pre-migration backup.
// Run: node scripts/verify-equipaciones-2026-27.mjs
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const H = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` };
const URL = env.NEXT_PUBLIC_SUPABASE_URL;

const plan = JSON.parse(readFileSync('supabase/equipaciones-2026-27-plan.json', 'utf8'));
const backup = JSON.parse(readFileSync('supabase/equipaciones-2026-27-backup.json', 'utf8'));
const backupById = new Map(backup.map((r) => [r.id, r.images]));

const rows = [];
for (let off = 0; ; off += 1000) {
  const res = await fetch(`${URL}/rest/v1/products?select=id,title,images,teams(slug)&limit=1000&offset=${off}`, { headers: H });
  const batch = await res.json();
  rows.push(...batch);
  if (batch.length < 1000) break;
}

const expectedProducts = rows.filter((r) => r.teams?.slug && plan[r.teams.slug]);
let ok = 0, untouchedOk = 0;
const mismatches = [];
const perClub = new Map();
for (const r of rows) {
  const slug = r.teams?.slug;
  if (slug && plan[slug]) {
    const want = plan[slug].urls;
    const got = r.images ?? [];
    const same = got.length === want.length && got.every((u, i) => u === want[i]);
    if (same) ok++; else mismatches.push({ id: r.id, title: r.title, slug, want: want.length, got: got.length, firstGot: got[0], firstWant: want[0] });
    perClub.set(slug, (perClub.get(slug) ?? 0) + 1);
  } else {
    const want = backupById.get(r.id) ?? [];
    const got = r.images ?? [];
    const same = JSON.stringify(got) === JSON.stringify(want);
    if (same) untouchedOk++; else mismatches.push({ id: r.id, title: r.title, slug: slug ?? '(none)', kind: 'untouched-changed', got: got.length, want: want.length });
  }
}

const distinct = new Set();
for (const r of rows) for (const u of r.images ?? []) if (u.includes('footylogos.com')) distinct.add(u);
const withFl = rows.filter((r) => (r.images ?? []).some((u) => u.includes('footylogos.com'))).length;
const stillWix = rows.filter((r) => (r.images ?? []).some((u) => u.includes('wixstatic'))).length;
const withBlur = rows.filter((r) => JSON.stringify(r.images ?? []).includes('blur_2')).length;
const withWww = rows.filter((r) => (r.images ?? []).some((u) => u.includes('www.footylogos.com'))).length;

console.log(`products total: ${rows.length}`);
console.log(`updated products (expected): ${expectedProducts.length}   matched exactly: ${ok}`);
console.log(`untouched products matching backup: ${untouchedOk}`);
console.log(`distinct FootyLogos urls now in db: ${distinct.size}`);
console.log(`products with FootyLogos photos: ${withFl} (of which ${withWww} include www-host photos)   still on wixstatic: ${stillWix}   with blur_2: ${withBlur}`);
console.log(`clubs covered: ${perClub.size}`);
console.log(`mismatches: ${mismatches.length}`);
for (const m of mismatches.slice(0, 10)) console.log('  -', JSON.stringify(m));
console.log(mismatches.length === 0 && ok === expectedProducts.length ? 'PASS' : 'FAIL');
