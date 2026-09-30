// Tests the Google-Drive product images through the image optimizer on both ports.
// Run: node scripts/probe-drive-images.mjs
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const H = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` };

const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?select=title,images,categories(slug)&images::text=like.%25googleusercontent%25&limit=5`, { headers: H });
const rows = await r.json();
console.log('drive products sampled:', rows.length);

for (const port of ['3000', '3123']) {
  console.log(`\n--- port ${port} ---`);
  for (const row of rows.slice(0, 3)) {
    const src = row.images[0];
    const u = `http://localhost:${port}/_next/image?url=${encodeURIComponent(src)}&w=1080&q=75`;
    try {
      const res = await fetch(u);
      const text = res.status === 200 ? '' : (await res.text()).slice(0, 160).replace(/\s+/g, ' ');
      console.log(`  ${res.status}  ${row.title?.slice(0, 28).padEnd(28)} ${src.slice(-28)} ${text}`);
    } catch (e) {
      console.log(`  ERR ${e.message}`);
    }
  }
  // direct upstream check (what Next would fetch)
  const src = rows[0]?.images?.[0];
  if (src) {
    try {
      const up = await fetch(src, { redirect: 'manual' });
      console.log(`  upstream direct: ${up.status} ${up.headers.get('content-type')} loc=${up.headers.get('location')?.slice(0, 60) ?? '-'}`);
    } catch (e) {
      console.log(`  upstream direct ERR ${e.message}`);
    }
  }
}
