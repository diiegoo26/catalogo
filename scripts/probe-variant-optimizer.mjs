// Probes REAL away/third URLs taken from the database through the running /_next/image optimizer.
// Run: node scripts/probe-variant-optimizer.mjs
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3123';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const H = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` };

const plan = JSON.parse(readFileSync('supabase/equipaciones-2026-27-plan.json', 'utf8'));
const kind = (u) => {
  const a = /-(home|away|third|fourth|anniversary)-kit-footylogos\./.exec(u);
  if (a) return a[1];
  const w = /\/(home|away|third|fourth|anniversary)-(?:cover|\d+)\.(?:webp|png|jpe?g)$/.exec(u);
  return w ? w[1] : 'other';
};

const targets = [];
for (const slug of ['arsenal', 'napoli', 'tigres-uanl', 'real-madrid', 'brentford', 'malaga', 'schalke-04']) {
  const urls = plan[slug]?.urls ?? [];
  for (const k of ['away', 'third']) {
    const u = urls.find((x) => kind(x) === k);
    if (u) targets.push([slug, k, u]);
  }
}

// confirm the DB really matches the plan for these clubs
let dbOk = 0;
for (const slug of ['arsenal', 'napoli', 'tigres-uanl', 'real-madrid']) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?select=images,teams!inner(slug)&teams.slug=eq.${slug}&limit=1`, { headers: H });
  const [row] = await r.json();
  const same = JSON.stringify(row?.images ?? []) === JSON.stringify(plan[slug].urls);
  if (same) dbOk++;
  else console.log(`  DB mismatch for ${slug}`);
}
console.log(`db matches plan: ${dbOk}/4`);

let ok = 0;
for (const [slug, k, src] of targets) {
  const url = `${BASE}/_next/image?url=${encodeURIComponent(src)}&w=1080&q=75`;
  try {
    const r = await fetch(url);
    const buf = new Uint8Array(await r.arrayBuffer());
    let dims = '?';
    if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
      if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x58) {
        dims = `${1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))}x${1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))}`;
      } else dims = 'webp-sc';
    } else if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const mk = buf[i + 1];
        if ([0xc0, 0xc1, 0xc2, 0xc3].includes(mk)) { dims = `${(buf[i + 7] << 8) | buf[i + 8]}x${(buf[i + 5] << 8) | buf[i + 6]}`; break; }
        if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { i += 2; continue; }
        i += 2 + ((buf[i + 2] << 8) | buf[i + 3]);
      }
    } else if (buf[0] === 0x89 && buf[1] === 0x50) {
      const dv = new DataView(buf.buffer);
      dims = `${dv.getUint32(16)}x${dv.getUint32(20)}`;
    }
    const good = r.status === 200 && dims !== '?' && dims !== 'webp-sc';
    if (good) ok++;
    console.log(`${r.status}  ${dims.padEnd(11)} ${buf.length.toString().padStart(7)}b  ${slug}/${k}  ${src.split('/').slice(-2).join('/')}`);
  } catch (e) {
    console.log(`ERR ${e.message} ${slug}/${k}`);
  }
}
console.log(`served correctly: ${ok}/${targets.length}`);
