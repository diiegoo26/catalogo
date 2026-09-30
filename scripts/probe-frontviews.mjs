// Probe: does /images/kit-history/<slug>/<slug>-2026-27-<variant>-kit.avif exist?
// Read-only feasibility check. Run: node scripts/probe-frontviews.mjs
import { readFileSync } from 'node:fs';

const map = JSON.parse(readFileSync('scripts/equipaciones-2026-27-map.json', 'utf8'));
const slugs = [...new Set(Object.values(map).map((v) => v.fl_slug))].sort();
const VARIANTS = ['home', 'away', 'third'];

const url = (s, v) => `https://www.footylogos.com/images/kit-history/${s}/${s}-2026-27-${v}-kit.avif`;

async function head(u) {
  try {
    const r = await fetch(u, { method: 'HEAD' });
    return r.status;
  } catch (e) {
    return `ERR:${e.message}`;
  }
}

// small concurrency pool
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    }),
  );
  return out;
}

const rows = await pool(slugs, 8, async (s) => {
  const codes = await pool(VARIANTS, 3, (v) => head(url(s, v)));
  return { slug: s, codes };
});

const ok = rows.filter((r) => r.codes.some((c) => c === 200));
const none = rows.filter((r) => !r.codes.some((c) => c === 200));

console.log(`slugs comprobados: ${rows.length}`);
console.log(`  con >=1 frente 200: ${ok.length}`);
console.log(`  sin ninguna  200:   ${none.length}`);
const dist = {};
for (const r of rows) {
  const n = r.codes.filter((c) => c === 200).length;
  dist[n] = (dist[n] ?? 0) + 1;
}
console.log('  variantes 200 por club:', dist);
console.log('\n-- clubs sin ninguna vista frontal 2026-27 --');
for (const r of none) console.log(`  ${r.slug}  [${r.codes.join(', ')}]`);
