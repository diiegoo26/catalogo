import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/equipaciones-2026-27-imagenes.sql', 'utf8');
const blocks = [...sql.matchAll(/-- (.+?) · source: (\S+) \(([^)]*)\)\n(?:.|\n)*?set images = '(\[.*?\])'::jsonb/g)];
const RX = /^https:\/\/assets\.footylogos\.com\/kits\/(\d{4}(?:-\d{2})?)\/([a-z0-9-]+)\/(batch-\d+)\/(cover|\d{1,3})-(.+?)-(\d{4}(?:-\d{2})?)-([a-z]+)-kit-footylogos\.(jpg|jpeg|png|webp)$/;

const bad = [];
for (const [, name, , , arr] of blocks) {
  for (const u of JSON.parse(arr.replace(/''/g, "'"))) {
    if (!RX.test(u)) bad.push([name, u]);
  }
}
console.log('unparsed:', bad.length);
for (const [name, u] of bad.slice(12)) console.log(`  [${name}] ${u}`);
