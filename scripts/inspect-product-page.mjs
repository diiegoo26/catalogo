// Inspects the rendered product page: how many distinct images, and their variant mix.
// Run: node scripts/inspect-product-page.mjs [url]
const url = process.argv[2] ?? 'http://localhost:3123/producto/camiseta-arsenal-2026';
const html = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
const refs = [...html.matchAll(/\/_next\/image\?url=([^&"]+)/g)].map((m) => decodeURIComponent(m[1]));
const uniq = [...new Set(refs)];
const kind = (u) => {
  const a = /-(home|away|third|fourth|anniversary)-kit-footylogos\./.exec(u);
  if (a) return a[1];
  const w = /\/(home|away|third|fourth|anniversary)-(?:cover|\d+)\.(?:webp|png|jpe?g)$/.exec(u);
  return w ? w[1] : 'other';
};
const counts = {};
for (const u of uniq) counts[kind(u)] = (counts[kind(u)] ?? 0) + 1;
console.log(`url: ${url}`);
console.log(`image refs: ${refs.length}   distinct: ${uniq.length}`);
console.log('distinct by variant:', counts);
console.log('first 10 distinct:');
for (const u of uniq.slice(0, 10)) console.log('  ', kind(u).padEnd(11), u);
