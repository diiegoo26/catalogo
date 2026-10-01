// Read-only post-apply checks. Prints PASS/FAIL per assertion; writes nothing.
// Note: `products.slug` is UNIQUE, so a duplicate-slug check over a single
// SELECT cannot fail — that assertion belongs in SQL (Task 5 Step 3).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [
      line.slice(0, line.indexOf('=')).trim(),
      line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''),
    ]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const plan = JSON.parse(readFileSync(new URL('./out/apply-plan.json', import.meta.url), 'utf8'));

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

// PostgREST truncates a bare select at the project max-rows (1,000 here), and
// the catalog is now 2,553 rows: page through, or every check below silently
// passes on a fraction of the data.
async function selectAll(table, columns) {
  const page = 1000;
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(table).select(columns).order('id').range(from, from + page - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < page) return rows;
  }
}

const products = await selectAll('products', 'id,slug,title,images,is_featured');
const categories = await selectAll('categories', 'slug,name');

const bySlug = new Map(products.map((p) => [p.slug, p]));
const byId = new Map(products.map((p) => [p.id, p]));
const catSlugs = new Set(categories.map((c) => c.slug));

check('categoría Móviles existe', catSlugs.has('moviles'));

const missing = plan.inserted.filter((i) => !bySlug.has(i.slug));
check('todos los productos nuevos existen', missing.length === 0,
  missing.length ? `faltan ${missing.length}: ${missing.slice(0, 5).map((m) => m.slug).join(', ')}` : `${plan.inserted.length} comprobados`);

const emptyTitles = plan.inserted.filter((i) => !bySlug.get(i.slug)?.title);
check('ningún producto nuevo tiene título vacío', emptyTitles.length === 0, `${emptyTitles.length} vacíos`);

const noImages = plan.inserted.filter((i) => (bySlug.get(i.slug)?.images ?? []).length === 0);
const expectedNoImages = plan.inserted.filter((i) => i.images.length === 0).length;
check('los nuevos sin foto son exactamente los previstos', noImages.length === expectedNoImages,
  `${noImages.length} sin imagen (esperado ${expectedNoImages})`);

const badPaths = plan.inserted.flatMap((i) => bySlug.get(i.slug)?.images ?? [])
  .filter((p) => typeof p === 'string' && !p.startsWith('/productos/sudu/'));
check('toda imagen apunta a /productos/sudu/', badPaths.length === 0, `${badPaths.length} rutas ajenas`);

const staleImages = plan.updated.filter((u) => {
  const row = byId.get(u.id);
  return !row || JSON.stringify(row.images ?? []) !== JSON.stringify(u.images ?? []);
});
check('cada producto emparejado tiene ya la imagen nueva', staleImages.length === 0, `${staleImages.length} sin actualizar`);

const featuredWanted = plan.updated.filter((u) => u.isFeatured).map((u) => u.id);
const featuredMissing = featuredWanted.filter((id) => !byId.get(id)?.is_featured);
check('los destacados de HOT SALE están marcados', featuredMissing.length === 0, `${featuredMissing.length} sin marcar`);

const planSlugs = plan.inserted.map((i) => i.slug);
const planDupes = planSlugs.filter((s, i) => planSlugs.indexOf(s) !== i);
check('los slugs nuevos son únicos dentro del plan', planDupes.length === 0, `${planDupes.length} repetidos`);

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} COMPROBACIONES FALLIDAS`);
process.exit(failures === 0 ? 0 : 1);
