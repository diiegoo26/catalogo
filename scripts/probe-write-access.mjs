// Read-only probe: checks whether the anon client may update products.images.
// Performs a NO-OP update (writes back the identical current value), so it
// cannot change data even if it succeeds.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: row, error: readErr } = await sb
  .from('products').select('id,images').limit(1).single();
if (readErr) throw readErr;

const { error } = await sb.from('products').update({ images: row.images }).eq('id', row.id);
console.log('id       :', row.id);
console.log('images   :', Array.isArray(row.images) ? row.images.length : typeof row.images);
console.log('noop w/rit:', error ? `DENIED (${error.code}: ${error.message})` : 'ALLOWED');
