// scripts/retro/reconcile.mjs
// manifest.json -> scripts/retro/out/delete-stale.sql
//
// El seed es un `insert ... on conflict (slug) do update`: nunca borra. Cuando
// el manifest cambia de composición (p. ej. al filtrar los kits de temporada
// reciente), los slugs que ya no aparecen se quedarían en la base de datos.
// Este script emite el DELETE que hace que la BD contenga exactamente los slugs
// del manifest. No escribe en la base de datos: solo genera el SQL.

import { readFileSync, writeFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('scripts/retro/out/manifest.json', 'utf8'));
const esc = (s) => String(s).replace(/'/g, "''");
const lista = manifest.map((m) => `'${esc(m.slug)}'`).join(', ');

const sql = `-- Reconciliación: la BD debe contener exactamente los slugs del manifest.
-- Generado por scripts/retro/reconcile.mjs. Borra las filas retro que ya no
-- están aprobadas (p. ej. kits de temporada reciente).
begin;

delete from products
where is_retro
  and slug not in (${lista});

commit;
`;

writeFileSync('scripts/retro/out/delete-stale.sql', sql);
console.log(`delete-stale.sql generado para ${manifest.length} slugs`);
