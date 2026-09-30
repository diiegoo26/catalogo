// Generates supabase/equipaciones-2026-27-imagenes.sql from the curated club mapping.
//
// For each club it reads its FootyLogos kit page (trying the 2026-27 season URL first, then the
// single-year 2026 URL used by Brazilian/MLS clubs), keeps ONLY that club's own photos, verifies
// every URL over HTTP 200, and emits one idempotent UPDATE per club that gives every product of
// that club the club's complete kit gallery (home, away, third, ...; cover photo first).
//
// Run: node scripts/gen-equipaciones-2026-27.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const map = JSON.parse(readFileSync('scripts/equipaciones-2026-27-map.json', 'utf8'));

const STOP = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'as', 'cd', 'ud', 'rc', 'sv', 'club', 'de', 'the', 'calcio', 'sco', 'om', '1907']);
const deacc = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const toks = (s) => new Set(deacc(s).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)));
const ORDER = ['home', 'away', 'third', 'fourth', 'anniversary'];
const FNAME = /^(cover|\d{1,3})-(.+?)-(2026-27|2026)-([a-z]+)-kit-footylogos\.(?:jpg|jpeg|png|webp)$/;

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 2000 + 2000 * i)); continue; }
      return r;
    } catch { await new Promise((s) => setTimeout(s, 500 + 500 * i)); }
  }
  return null;
}

async function pageHtml(flSlug) {
  for (const season of ['2026-27', '2026']) {
    const url = `https://www.footylogos.com/kits/${flSlug}-${season}`;
    const res = await get(url);
    if (res && res.status === 200) return { url, html: await res.text() };
  }
  return null;
}

async function photosFor(flSlug) {
  const found = await pageHtml(flSlug);
  if (!found) return { page: `https://www.footylogos.com/kits/${flSlug}-2026-27`, variants: {}, status: 'page-missing' };
  const pt = toks(flSlug);
  const assets = {};
  for (const m of found.html.matchAll(/https:\/\/assets\.footylogos\.com\/[^\s"'<>\\]+?\.(?:jpg|jpeg|png|webp)/g)) {
    const url = m[0];
    const f = FNAME.exec(url.split('/').pop());
    if (!f) continue;
    const [, idx, clubPart, , kind] = f;
    const ct = toks(clubPart);
    const inter = [...pt].filter((t) => ct.has(t)).length;
    if (!pt.size || !ct.size || !inter || inter / Math.min(pt.size, ct.size) < 0.6) continue;
    (assets[kind] ??= []).push([idx === 'cover' ? 0 : Number(idx), url]);
  }
  for (const k of Object.keys(assets)) {
    assets[k] = [...new Set(assets[k].sort((a, b) => a[0] - b[0]).map((v) => v[1]))];
  }

  // The www host carries the club's own kit gallery as /kits/<slug>-<season>/<kind>-NN.webp
  // (plus <kind>-cover.webp). 42 of 117 clubs have no home photos on the assets host but do
  // have them here, so per kit variant we prefer assets (more photos) and fall back to www.
  const web = {};
  const WEB = /https:\/\/www\.footylogos\.com\/kits\/([a-z0-9-]+?)-(\d{4}-\d{2}|\d{4})\/([a-z]+)-(cover|\d{1,3})\.(?:webp|png|jpe?g)/g;
  for (const m of found.html.matchAll(WEB)) {
    const [, slug, pageSeason, kind, num] = m;
    if (slug !== flSlug || !found.url.endsWith(`/${slug}-${pageSeason}`)) continue;
    (web[kind] ??= []).push([num === 'cover' ? 0 : Number(num), m[0]]);
  }
  for (const k of Object.keys(web)) {
    web[k] = [...new Set(web[k].sort((a, b) => a[0] - b[0]).map((v) => v[1]))];
  }

  const variants = {};
  for (const kind of new Set([...Object.keys(assets), ...Object.keys(web)])) {
    const chosen = assets[kind]?.length ? assets[kind] : (web[kind] ?? []);
    if (chosen.length) variants[kind] = chosen;
  }
  return { page: found.url, variants, status: Object.keys(variants).length ? 'ok' : 'empty' };
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const lines = [
  '-- ============================================================================',
  '-- KOVA catalogo · Imagenes reales 2026-27 de las equipaciones (FootyLogos)',
  '-- Generado por scripts/gen-equipaciones-2026-27.mjs — NO editar a mano.',
  '-- Cada bloque da a todos los productos del club la galeria completa de su kit.',
  '-- Clubs ausentes = sin galeria 2026-27 en la fuente -> conservan su foto actual.',
  '-- Idempotente: reejecutable sin efectos secundarios.',
  '-- ============================================================================',
  'begin;', '',
];

let clubs = 0, photos = 0;
const skipped = [];
for (const ourSlug of Object.keys(map).sort()) {
  const info = map[ourSlug];
  const r = await photosFor(info.fl_slug);
  const urls = ORDER.flatMap((k) => r.variants[k] ?? [])
    .concat(Object.entries(r.variants).filter(([k]) => !ORDER.includes(k)).flatMap(([, v]) => v));
  if (!urls.length) { skipped.push(`${ourSlug} (${r.status})`); continue; }

  const bad = [];
  for (const u of urls) {
    const res = await get(u);
    if (!res || res.status !== 200) bad.push(`${u} -> ${res ? res.status : 'err'}`);
  }
  if (bad.length) { skipped.push(`${ourSlug} (${bad.length} bad urls)`); bad.slice(0, 3).forEach((b) => console.error('   ', b)); continue; }

  const counts = ORDER.filter((k) => r.variants[k]?.length).map((k) => `${k} ${r.variants[k].length}`).join(', ');
  lines.push(`-- ${info.name} · source: ${r.page} (${counts} => ${urls.length} fotos)`);
  lines.push(`update products p set images = ${q(JSON.stringify(urls))}::jsonb`);
  lines.push(`  from teams t where t.id = p.team_id and t.slug = ${q(ourSlug)};`);
  lines.push('');
  clubs++; photos += urls.length;
}
lines.push('commit;', '');
lines.push('-- Verificacion esperada tras aplicar: 0 filas con blur_2 o /v1/fill.');

writeFileSync('supabase/equipaciones-2026-27-imagenes.sql', lines.join('\n'));
console.log(`clubs written: ${clubs}  photos: ${photos}  skipped: ${skipped.length}`);
if (skipped.length) console.log('skipped:', skipped.join(' | '));
