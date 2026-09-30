// Checks, for every mapped club, how many home/away/third photos exist on the assets host
// versus the www host, to see whether the www host adds kits the assets host misses.
// Run: node scripts/check-home-coverage.mjs
import { readFileSync } from 'node:fs';

const map = JSON.parse(readFileSync('scripts/equipaciones-2026-27-map.json', 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0' };
const STOP = new Set(['fc','cf','afc','sc','ac','as','cd','ud','rc','sv','club','de','the','calcio','sco','om','1907']);
const deacc = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const toks = (s) => new Set(deacc(s).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)));

const FNAME = /^(cover|\d{1,3})-(.+?)-(2026-27|2026)-([a-z]+)-kit-footylogos\.(?:jpg|jpeg|png|webp)$/;
const WEB = /https:\/\/www\.footylogos\.com\/kits\/([a-z0-9-]+?)-(\d{4}-\d{2}|\d{4})\/([a-z]+)-(\d{1,3})\.(?:webp|png|jpe?g)/g;

async function page(fl) {
  for (const s of ['2026-27', '2026']) {
    const r = await fetch(`https://www.footylogos.com/kits/${fl}-${s}`, { headers: UA });
    if (r.status === 200) return { season: s, html: await r.text() };
  }
  return null;
}

const rows = [];
const missingHome = [];
for (const [ourSlug, info] of Object.entries(map).sort()) {
  const p = await page(info.fl_slug);
  if (!p) { rows.push({ ourSlug, status: 'no-page' }); continue; }
  const pt = toks(info.fl_slug);
  const asset = {};
  for (const m of p.html.matchAll(/https:\/\/assets\.footylogos\.com\/[^\s"'<>\\]+?\.(?:jpg|jpeg|png|webp)/g)) {
    const f = FNAME.exec(m[0].split('/').pop());
    if (!f) continue;
    const ct = toks(f[2]);
    const inter = [...pt].filter((t) => ct.has(t)).length;
    if (!pt.size || !ct.size || !inter || inter / Math.min(pt.size, ct.size) < 0.6) continue;
    asset[f[4]] = (asset[f[4]] ?? 0) + 1;
  }
  const web = {};
  for (const m of p.html.matchAll(WEB)) {
    const [, slug, season, kind] = m;
    if (slug !== info.fl_slug || season !== p.season) continue;
    web[kind] = (web[kind] ?? 0) + 1;
  }
  const rec = { ourSlug, fl: info.fl_slug, season: p.season, asset, web };
  rows.push(rec);
  if (!asset.home && !web.home) missingHome.push(ourSlug);
}

const noHomeAssets = rows.filter((r) => r.asset && !r.asset.home);
const gainFromWeb = noHomeAssets.filter((r) => r.web && r.web.home);
console.log(`clubs checked: ${rows.length}`);
console.log(`clubs with home on assets host: ${rows.filter((r) => r.asset?.home).length}`);
console.log(`clubs WITHOUT home on assets host: ${noHomeAssets.length}`);
console.log(`  ...of which the www host HAS home photos: ${gainFromWeb.length}`);
console.log(`clubs with no home anywhere: ${missingHome.length} -> ${missingHome.join(', ')}`);
console.log('\nsample of clubs that would gain home photos from the www host:');
for (const r of gainFromWeb.slice(0, 12)) {
  console.log(`  ${r.ourSlug}: assets=${JSON.stringify(r.asset)} www=${JSON.stringify(r.web)}`);
}
console.log('\nsample of clubs where assets lack home and www lacks it too:');
for (const r of noHomeAssets.filter((x) => !x.web?.home).slice(0, 10)) {
  console.log(`  ${r.ourSlug}: assets=${JSON.stringify(r.asset)} www=${JSON.stringify(r.web)}`);
}
