// Snapshots products.images so a photo migration can be rolled back.
//
// Two snapshots exist and must never be confused:
//   supabase/equipaciones-2026-27-backup.json        pre-FootyLogos Wix store photos
//   supabase/equipaciones-2026-27-frentes-rollback.json  current FootyLogos galleries
//
// The legacy path is a rollback of record, so this script refuses to write it.
//
// Run: node scripts/backup-products-images.mjs [outfile]
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const LEGACY = 'supabase/equipaciones-2026-27-backup.json';
const out = process.argv[2] ?? 'supabase/equipaciones-2026-27-frentes-rollback.json';
if (out === LEGACY) {
  console.error(`refusing to overwrite the pre-FootyLogos rollback: ${LEGACY}`);
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: cat, error: catErr } = await sb
  .from('categories').select('id').eq('slug', 'equipaciones').single();
if (catErr) throw catErr;

const { data, error } = await sb
  .from('products')
  .select('id,images,season,team_id')
  .eq('category_id', cat.id)
  .eq('season', '2026-27');
if (error) throw error;

const withImages = data.filter((p) => Array.isArray(p.images) && p.images.length > 0);
if (existsSync(out)) {
  console.error(`refusing to overwrite an existing snapshot: ${out}`);
  process.exit(1);
}
writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
console.log(`backed up ${data.length} equipaciones 2026-27 products (${withImages.length} with images) -> ${out}`);
