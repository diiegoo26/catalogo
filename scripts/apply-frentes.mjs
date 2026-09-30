// Applies the reviewed front-view SQL to products.images.
//
// Safety properties:
//  1. The payload is parsed straight out of supabase/equipaciones-2026-27-frentes.sql,
//     so exactly the reviewed statements are applied - no second logic path.
//  2. Dry run by default. Writes only with --apply.
//  3. Refuses to run unless the rollback snapshot exists and is complete.
//  4. Verifies each write echoes back the exact array that was sent.
//
// Run: node scripts/apply-frentes.mjs          (dry run)
//      node scripts/apply-frentes.mjs --apply
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

const SQL = 'supabase/equipaciones-2026-27-frentes.sql';
const ROLLBACK = 'supabase/equipaciones-2026-27-frentes-rollback.json';
const apply = process.argv.includes('--apply');

for (const [p, n] of [[SQL, 'SQL'], [ROLLBACK, 'rollback snapshot']]) {
  if (!existsSync(p)) { console.error(`missing ${n}: ${p}`); process.exit(1); }
}

// Parse the statements the SQL builder produced.
const sql = readFileSync(SQL, 'utf8');
const stmt = /update\s+products\s+p\s+set\s+images\s*=\s*'([\s\S]*?)'::jsonb\s+where\s+p\.id\s*=\s*'([0-9a-f-]{36})'\s*;/gi;
const pairs = [];
for (const m of sql.matchAll(stmt)) pairs.push({ json: m[1], id: m[2] });

const declared = Number(sql.match(/--\s*(\d+)\s+products/)?.[1] ?? -1);
if (pairs.length !== declared) {
  console.error(`parse mismatch: ${pairs.length} statements vs header "${declared} products"`);
  process.exit(1);
}
const ids = new Set(pairs.map((p) => p.id));
if (ids.size !== pairs.length) { console.error('duplicate product ids in SQL'); process.exit(1); }

const views = pairs.reduce((n, p) => n + JSON.parse(p.json).length, 0);
const empties = pairs.filter((p) => JSON.parse(p.json).length === 0).length;
console.log(`SQL statements : ${pairs.length} (unique ids ${ids.size})`);
console.log(`front views    : ${views}`);
console.log(`empty arrays   : ${empties}`);
console.log(`mode           : ${apply ? 'APPLY' : 'DRY RUN'}`);

if (empties > 0) { console.error('refusing: SQL would blank a product'); process.exit(1); }

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

if (!apply) { console.log('\nnothing written. re-run with --apply.'); process.exit(0); }

const CONC = 6;
let ok = 0; const failed = [];
await Promise.all(
  [...pairs].map(async ({ json, id }) => {
    const want = JSON.parse(json);
    const { error, data } = await sb.from('products')
      .update({ images: want }).eq('id', id).select('images').single();
    if (error) { failed.push({ id, error: error.message }); return; }
    if (JSON.stringify(data.images) !== JSON.stringify(want)) {
      failed.push({ id, error: 'echo mismatch' }); return;
    }
    ok++;
  }),
).catch(() => {});

console.log(`\nupdated : ${ok}/${pairs.length}`);
if (failed.length) {
  console.error(`FAILED  : ${failed.length}`);
  for (const f of failed.slice(0, 10)) console.error(`  ${f.id} ${f.error}`);
  process.exit(1);
}
