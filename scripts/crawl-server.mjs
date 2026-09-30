// Crawls a running server: every internal route reachable from the main pages, plus a sample of
// /_next/image URLs, and reports anything that is not HTTP 200.
// Run: node scripts/crawl-server.mjs [port] [imageSample]
import { readFileSync } from 'node:fs';

const port = process.argv[2] ?? '3000';
const sample = Number(process.argv[3] ?? 25);
const BASE = `http://localhost:${port}`;
const UA = { 'User-Agent': 'Mozilla/5.0' };

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const H = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` };

const seen = new Set();
const bad = [];
const queue = ['/', '/equipaciones', '/calzado'];

async function visit(path) {
  if (seen.has(path) || seen.size > 60) return;
  seen.add(path);
  try {
    const r = await fetch(BASE + path, { headers: UA, redirect: 'manual' });
    const text = r.status === 200 ? await r.text() : '';
    if (r.status !== 200) bad.push([r.status, path]);
    for (const m of text.matchAll(/href="(\/[^"#?]*)"/g)) {
      const p = m[1];
      if (/^\/(_next|api)\//.test(p)) continue;
      if (!seen.has(p) && seen.size < 60) queue.push(p);
    }
    for (const m of text.matchAll(/\/_next\/image\?url=([^&"]+)/g)) imageUrls.add(decodeURIComponent(m[1]));
  } catch (e) {
    bad.push(['ERR', `${path} ${e.message}`]);
  }
}

const imageUrls = new Set();
while (queue.length) await visit(queue.shift());

const all = [...imageUrls];
const step = Math.max(1, Math.floor(all.length / sample));
const picked = all.filter((_, i) => i % step === 0).slice(0, sample);
let imgOk = 0;
for (const src of picked) {
  const u = `${BASE}/_next/image?url=${encodeURIComponent(src)}&w=1080&q=75`;
  try {
    const r = await fetch(u, { headers: UA });
    if (r.status === 200) imgOk++;
    else bad.push([`img ${r.status}`, src]);
  } catch (e) {
    bad.push(['img ERR', `${src} ${e.message}`]);
  }
}

console.log(`port ${port}: routes checked ${seen.size}, images sampled ${picked.length} (200: ${imgOk})`);
console.log(`problems: ${bad.length}`);
for (const [s, p] of bad.slice(0, 25)) console.log('  -', s, p);
console.log(bad.length === 0 ? 'PASS' : 'FAIL');
