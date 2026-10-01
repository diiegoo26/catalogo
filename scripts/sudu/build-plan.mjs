// Reads the workbook manifest plus a read-only snapshot of the catalog and
// produces report.md / apply.sql / apply-plan.json. Writes no database rows:
// the SQL is executed separately, over the Supabase MCP channel, after review.
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  cleanName, detectBrand, fixBrandSpellings, inferBrand, proposeBrand,
  renderTitle, sectionToCategory, slugify, uniqueSlug,
} from '../../lib/sudu/names.ts';
import { matchAll, normalizeKey } from '../../lib/sudu/match.ts';

const OUT = new URL('./out/', import.meta.url);
const MEDIA = new URL('./out/media/', import.meta.url);
const IMAGE_DIR = new URL('../../public/productos/sudu/', import.meta.url);
const MANIFEST = new URL('manifest.json', OUT);
const APPROVALS = new URL('brand-approvals.json', OUT);

// ---------------------------------------------------------------- env + state
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [
      line.slice(0, line.indexOf('=')).trim(),
      line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''),
    ]),
);
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('.env.local is missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// PostgREST truncates a bare select at the project max-rows (1,000 here): a
// single call silently matched against less than half a 2,180-row catalog and
// seeded a slug set that could collide on insert. Page through explicitly.
async function selectAll(table, columns) {
  const page = 1000;
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + page - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < page) return rows;
  }
}

const categories = await selectAll('categories', 'id,slug,name,sort_order');
const brands = await selectAll('brands', 'id,name,slug');
const products = await selectAll('products', 'id,title,slug,brand_id,category_id,is_featured');
console.log(`catalog: ${products.length} products, ${categories.length} categories, ${brands.length} brands`);

const MOVILES = { name: 'Móviles', slug: 'moviles', sort_order: 14 };
const categorySlugs = new Set(categories.map((c) => c.slug));
const brandBySlug = new Map(brands.map((b) => [b.slug, b]));

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const hotSale = new Set(manifest.hot_sale_weidian_ids);

// ------------------------------------------------------------ decide shapes
const prepared = manifest.records.map((rec) => {
  const cleaned = fixBrandSpellings(cleanName(rec.raw_name));
  const hit = detectBrand(cleaned, brands);
  const inferred = hit ? null : inferBrand(cleaned, brands);
  const proposed = hit || inferred ? null : proposeBrand(cleaned);
  return {
    ...rec,
    cleaned,
    title: renderTitle(hit, inferred, cleaned),
    knownBrandSlug: hit?.brand.slug ?? null,
    inferredBrandSlug: inferred?.slug ?? null,
    brandKey: hit
      ? normalizeKey(hit.brand.name)
      : inferred
        ? normalizeKey(inferred.name)
        : proposed
          ? proposed.key
          : '',
    proposedKey: proposed?.key ?? null,
    proposedName: proposed?.name ?? null,
    categorySlug: sectionToCategory(rec.section, cleaned),
    featured: hotSale.has(rec.weidian_id),
  };
});

// ------------------------------------------------- brand proposals + approvals
const proposals = new Map();
for (const p of prepared) {
  if (!p.proposedKey) continue;
  const entry = proposals.get(p.proposedKey)
    ?? { from: p.proposedKey, proposedName: p.proposedName, count: 0, samples: [] };
  entry.count += 1;
  if (entry.samples.length < 3) entry.samples.push(p.cleaned);
  proposals.set(p.proposedKey, entry);
}

const approvalsFile = existsSync(APPROVALS)
  ? JSON.parse(readFileSync(APPROVALS, 'utf8'))
  : { approve: [] };
const approvedSlugByKey = new Map();
const brandsToCreate = [];
for (const approval of approvalsFile.approve ?? []) {
  const proposal = proposals.get(approval.from);
  if (!proposal) continue;
  const name = approval.name ?? proposal.proposedName;
  const slug = slugify(approval.slug ?? name);
  approvedSlugByKey.set(approval.from, slug);
  brandsToCreate.push({ from: approval.from, name, slug });
}
const uniqueBrandsToCreate = [...new Map(brandsToCreate.map((b) => [b.slug, b])).values()];

const resolved = prepared.map((p) => ({
  ...p,
  brandSlug: p.knownBrandSlug
    ?? p.inferredBrandSlug
    ?? (p.proposedKey ? approvedSlugByKey.get(p.proposedKey) ?? null : null),
}));

// --------------------------------------------------------------- matching
const brandTokens = new Set(
  brands.flatMap((b) => normalizeKey(b.name).split(' ')).filter(Boolean),
);
const brandKeyById = new Map(brands.map((b) => [b.id, normalizeKey(b.name)]));
const categorySlugById = new Map(categories.map((c) => [c.id, c.slug]));
const existing = products.map((p) => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  brandKey: brandKeyById.get(p.brand_id) ?? '',
  categorySlug: categorySlugById.get(p.category_id) ?? '',
}));

const matches = matchAll(
  resolved.map((p) => ({ title: p.title, brandKey: p.brandKey })),
  existing,
  { brandTokens },
).map((result, i) => ({ ...result, prepared: resolved[i] }));

// Two workbook rows must never fight over the same existing product.
const byTarget = new Map();
for (const m of matches) {
  if (m.tier === 'none' || !m.target) continue;
  const list = byTarget.get(m.target.id) ?? [];
  list.push(m);
  byTarget.set(m.target.id, list);
}
const conflicted = new Set();
const conflicts = [];
for (const list of byTarget.values()) {
  if (list.length < 2) continue;
  for (const m of list) conflicted.add(m);
  conflicts.push({ target: list[0].target, rows: list.map((m) => m.prepared.row) });
}

// ----------------------------------------------------------------- assets
mkdirSync(IMAGE_DIR, { recursive: true });
const takenSlugs = new Set(products.map((p) => p.slug));
const toPath = (u) => fileURLToPath(u);

async function convert(sourceName, targetName) {
  const source = toPath(new URL(sourceName, MEDIA));
  if (!existsSync(source)) return false;
  await sharp(source)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(toPath(new URL(targetName, IMAGE_DIR)));
  return true;
}

const inserted = [];
const unresolvedSection = [];
for (const m of matches) {
  if (m.tier !== 'none') continue;
  const p = m.prepared;
  if (p.categorySlug === null) {
    unresolvedSection.push(p);
    continue;
  }
  const slug = uniqueSlug(slugify(p.title), takenSlugs);
  const images = [];
  for (const media of p.images) {
    const name = `${slug}-${images.length + 1}.webp`;
    if (await convert(media, name)) images.push(`/productos/sudu/${name}`);
  }
  inserted.push({
    row: p.row,
    title: p.title,
    slug,
    images,
    categorySlug: p.categorySlug,
    brandSlug: p.brandSlug,
    brandKey: p.brandKey,
    brandSource: p.knownBrandSlug ? 'existing' : p.inferredBrandSlug ? 'inferred' : p.brandSlug ? 'approved' : 'none',
    isFeatured: p.featured,
    weidianId: p.weidian_id,
  });
}

// Only the `safe` tier is applied automatically. A `probable` match is
// evidence of a product *family*, not of the same product: on this workbook
// roughly two thirds of them pointed at the wrong row (Jabra elite 75T ->
// Elite 7 Pro, Samsung watch 9 -> Galaxy Watch Ultra, Apple Pencil 2 ->
// Pencil 3). They are reported and written nowhere.
const updated = [];
const probableOnly = [];
const matchedNoPhoto = [];
const assetFailed = [];
for (const m of matches) {
  if (m.tier === 'none') continue;
  if (conflicted.has(m)) continue;
  const p = m.prepared;
  if (m.tier === 'probable') {
    probableOnly.push({ row: p.row, title: p.title, target: m.target, reason: m.reason });
    continue;
  }
  if (p.images.length === 0) {
    matchedNoPhoto.push({ row: p.row, title: p.title, target: m.target });
    continue;
  }
  const images = [];
  for (const media of p.images) {
    const name = `${m.target.slug}-${images.length + 1}.webp`;
    if (await convert(media, name)) images.push(`/productos/sudu/${name}`);
  }
  if (images.length === 0) {
    assetFailed.push({ row: p.row, title: p.title, target: m.target, media: p.images });
    continue;
  }
  updated.push({
    id: m.target.id,
    slug: m.target.slug,
    title: m.target.title,
    tier: m.tier,
    reason: m.reason,
    isFeatured: p.featured,
    images,
  });
}

// --------------------------------------------------- possible duplicates
// Signalling for the human gate only: which new products look like something
// the catalog already has under a different title. Reported, never acted on.
const existingByCategoryBrand = new Map();
for (const q of existing) {
  if (!q.brandKey) continue;
  const key = `${q.categorySlug}|${q.brandKey}`;
  const list = existingByCategoryBrand.get(key) ?? [];
  list.push(q);
  existingByCategoryBrand.set(key, list);
}
const distinctiveWords = (text) =>
  [...new Set(normalizeKey(text).split(' '))]
    .filter((token) => token.length >= 4 && !/^\d+$/.test(token) && !brandTokens.has(token));

for (const ins of inserted) {
  const pool = ins.brandKey
    ? existingByCategoryBrand.get(`${ins.categorySlug}|${ins.brandKey}`) ?? []
    : [];
  const words = new Set(distinctiveWords(ins.title));
  ins.possibleDuplicates = words.size === 0
    ? []
    : pool
      .filter((q) => distinctiveWords(q.title).some((token) => words.has(token)))
      .slice(0, 3)
      .map((q) => ({ slug: q.slug, title: q.title }));
}
const insertsWithPossibleDuplicate = inserted.filter((i) => i.possibleDuplicates.length > 0).length;

// ------------------------------------------------------------ partition check
const buckets = {
  updated: updated.length,
  probableOnly: probableOnly.length,
  matchedNoPhoto: matchedNoPhoto.length,
  assetFailed: assetFailed.length,
  conflict: [...conflicted].length,
  inserted: inserted.length,
  unresolvedSection: unresolvedSection.length,
  skippedRow: manifest.skipped.length,
};
const recordsAccounted =
  buckets.updated + buckets.probableOnly + buckets.matchedNoPhoto + buckets.assetFailed
  + buckets.conflict + buckets.inserted + buckets.unresolvedSection;
if (recordsAccounted !== manifest.records.length) {
  throw new Error(
    `partition mismatch: ${recordsAccounted} accounted for, ${manifest.records.length} records`,
  );
}

// ------------------------------------------------------------ emit the SQL
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const jsonArray = (values) =>
  values.length === 0
    ? `'[]'::jsonb`
    : `to_jsonb(ARRAY[${values.map(q).join(', ')}]::text[])`;

const knownCategories = new Set([...categorySlugs, MOVILES.slug]);
for (const i of inserted) {
  if (!knownCategories.has(i.categorySlug)) {
    throw new Error(`insert ${i.slug} targets unknown category ${i.categorySlug}`);
  }
}
for (const b of uniqueBrandsToCreate) {
  if (brandBySlug.has(b.slug)) {
    throw new Error(`brand slug ${b.slug} already exists — remove it from brand-approvals.json`);
  }
}

const lines = ['BEGIN;', `-- ${new Date().toISOString()}  SUDU-Gadgets 2026-9 import`, ''];

if (!categorySlugs.has(MOVILES.slug)) {
  lines.push(
    `INSERT INTO categories (name, slug, sort_order) VALUES (${q(MOVILES.name)}, ${q(MOVILES.slug)}, ${MOVILES.sort_order});`,
    '',
  );
}
for (const b of uniqueBrandsToCreate) {
  lines.push(`INSERT INTO brands (name, slug) VALUES (${q(b.name)}, ${q(b.slug)}) ON CONFLICT (slug) DO NOTHING;`);
}
if (uniqueBrandsToCreate.length) lines.push('');

lines.push(`-- ${inserted.length} new products`);
for (const i of inserted) {
  const brandRef = i.brandSlug
    ? `(SELECT id FROM brands WHERE slug = ${q(i.brandSlug)})`
    : 'NULL';
  lines.push(
    'INSERT INTO products (title, slug, description, images, category_id, brand_id, is_featured)',
    `VALUES (${q(i.title)}, ${q(i.slug)}, NULL, ${jsonArray(i.images)},`,
    `        (SELECT id FROM categories WHERE slug = ${q(i.categorySlug)}), ${brandRef}, ${i.isFeatured});`,
  );
}

lines.push('', `-- ${updated.length} image-only updates`);
for (const u of updated) {
  const setFeatured = u.isFeatured ? ', is_featured = TRUE' : '';
  lines.push(`UPDATE products SET images = ${jsonArray(u.images)}${setFeatured} WHERE id = ${q(u.id)}::uuid;`);
}

lines.push('', 'COMMIT;');
writeFileSync(new URL('apply.sql', OUT), lines.join('\n'), 'utf8');

// ---------------------------------------------------------------- report
const unmatched = matches.filter((m) => m.tier === 'none');
const md = [
  '# SUDU-Gadgets 2026-9 — import report',
  '',
  `Generated ${new Date().toISOString()} from \`${manifest.source}\`.`,
  '',
  '## Totals',
  '',
  '| Metric | Count |',
  '| --- | --- |',
  `| Workbook records | ${manifest.records.length} |`,
  ...Object.entries(buckets).map(([k, v]) => `| ${k} | ${v} |`),
  `| New brands to create | ${uniqueBrandsToCreate.length} |`,
  `| New products resembling an existing one | ${insertsWithPossibleDuplicate} |`,
  '',
  '## Categories to create',
  '',
  categorySlugs.has(MOVILES.slug) ? '- none — `Móviles` already exists' : `- ${MOVILES.name} (\`${MOVILES.slug}\`)`,
  '',
  '## Brands to create (approved)',
  '',
  uniqueBrandsToCreate.length
    ? uniqueBrandsToCreate.map((b) => `- ${b.name} (\`${b.slug}\`) — from proposal \`${b.from}\``).join('\n')
    : '- none',
  '',
  '## Brand proposals awaiting approval',
  '',
  'Add any of these to `scripts/sudu/out/brand-approvals.json` as',
  '`{ "approve": [{ "from": "<key>", "name": "<Name>", "slug": "<slug>" }] }`, then re-run this script.',
  '',
  '| key | proposed name | products | examples |',
  '| --- | --- | --- | --- |',
  ...[...proposals.values()]
    .sort((a, b) => b.count - a.count)
    .map((p) => `| \`${p.from}\` | ${p.proposedName} | ${p.count} | ${p.samples.join(' · ')} |`),
  '',
  '## Probable matches — nothing written, review manually',
  '',
  'Evidence of the same product *family*, not of the same product. None of these is applied.',
  '',
  '| Workbook title | Existing product | Why |',
  '| --- | --- | --- |',
  ...probableOnly.map((p) => `| ${p.title} | ${p.target.title} (\`${p.target.slug}\`) | ${p.reason} |`),
  '',
  '## Possible duplicates among the new products',
  '',
  'New products in the same category and brand that share a distinctive word with an existing',
  'product. Nothing is changed automatically — check these before or after applying.',
  '',
  '| New product | Existing candidates |',
  '| --- | --- |',
  ...inserted.filter((i) => i.possibleDuplicates.length)
    .map((i) => `| ${i.title} (\`${i.slug}\`) | ${i.possibleDuplicates.map((c) => `${c.title} (\`${c.slug}\`)`).join(' · ')} |`),
  '',
  '## Conflicts — two workbook rows, one product, nothing written',
  '',
  ...(conflicts.length
    ? conflicts.map((c) => `- ${c.target.title} (\`${c.target.slug}\`) ← rows ${c.rows.join(', ')}`)
    : ['- none']),
  '',
  '## Matched but the workbook has no photo — nothing written',
  '',
  ...(matchedNoPhoto.length
    ? matchedNoPhoto.map((m) => `- row ${m.row} ${m.title} → ${m.target.slug}`)
    : ['- none']),
  '',
  '## Assets that failed to convert — nothing written',
  '',
  ...(assetFailed.length
    ? assetFailed.map((m) => `- row ${m.row} ${m.title} → ${m.target.slug} (${m.media.join(', ')})`)
    : ['- none']),
  '',
  '## Sections that map to no category — nothing written',
  '',
  ...(unresolvedSection.length
    ? unresolvedSection.map((p) => `- row ${p.row} ${p.title} — section \`${p.section}\``)
    : ['- none']),
  '',
  '## Unmatched — nothing will be written',
  '',
  '| Workbook title | Section | Category | Candidates considered | Note |',
  '| --- | --- | --- | --- | --- |',
  ...unmatched.map((m) =>
    `| ${m.prepared.title} | ${m.prepared.section} | ${m.prepared.categorySlug ?? '—'} | ${m.candidates.map((c) => c.slug).join(', ') || '—'} | ${m.reason} |`),
  '',
  '## Rows the extractor skipped',
  '',
  ...manifest.skipped.map((s) => `- row ${s.row}: ${s.reason}`),
  '',
  '## New products, as they will appear',
  '',
  ...inserted.map((i) =>
    `- ${i.title} — \`${i.slug}\` — ${i.categorySlug}${i.brandSlug ? ` — ${i.brandSlug}` : ''}${i.isFeatured ? ' — **destacado**' : ''}${i.images.length ? '' : ' — **sin foto**'}`),
  '',
].join('\n');

writeFileSync(new URL('report.md', OUT), md, 'utf8');
writeFileSync(
  new URL('brand-proposals.json', OUT),
  JSON.stringify([...proposals.values()], null, 2),
  'utf8',
);
writeFileSync(
  new URL('apply-plan.json', OUT),
  JSON.stringify({ buckets, inserted, updated, probableOnly, matchedNoPhoto, assetFailed, conflicts, unresolvedSection, insertsWithPossibleDuplicate, brandsToCreate: uniqueBrandsToCreate }, null, 2),
  'utf8',
);

console.log(`catalog products : ${products.length}`);
console.log(`inserted         : ${inserted.length}`);
console.log(`updated (safe)   : ${updated.length}`);
console.log(`probable no-write: ${probableOnly.length}`);
console.log(`matched no photo : ${matchedNoPhoto.length}`);
console.log(`possible dupes   : ${insertsWithPossibleDuplicate}`);
console.log(`asset failed     : ${assetFailed.length}`);
console.log(`conflicts        : ${conflicts.length}`);
console.log(`unresolved categ.: ${unresolvedSection.length}`);
console.log(`unmatched        : ${unmatched.length}`);
console.log(`brand proposals  : ${proposals.size}`);
console.log(`brands to create : ${uniqueBrandsToCreate.length}`);
console.log('-> scripts/sudu/out/report.md');
console.log('-> scripts/sudu/out/apply.sql');
