// scripts/retro/build-seed.mjs
// manifest.json -> supabase/seed-retro-soccerplus.sql
// No escribe en la base de datos: solo genera el SQL para revisarlo y aplicarlo.

import { readFileSync, writeFileSync } from 'node:fs';

const CATEGORIA_EQUIPACIONES = '612957f3-fc5a-4076-8daf-d099420b01a1';
const manifest = JSON.parse(readFileSync('scripts/retro/out/manifest.json', 'utf8'));
const esc = (s) => String(s).replace(/'/g, "''");
const val = (v, cast) => (v === null || v === undefined ? 'null' : cast ? `'${esc(v)}'::${cast}` : `'${esc(v)}'`);

const values = manifest.map((m) => `  (${
  [
    val(m.title),
    val(m.slug),
    val(m.team_id, 'uuid'),
    val(m.image),
    val(m.season),
  ].join(', ')
})`).join(',\n');

const sql = `-- Equipaciones retro del proveedor SoccerPlus (búsqueda "retro" en yupoo).
-- Generado por scripts/retro/build-seed.mjs. Idempotente (ON CONFLICT slug).
-- Los productos retro van en la categoría Equipaciones con is_retro = true, para
-- conservar el precio Fans/Jugador y el flujo CompraEquipacion.
begin;

insert into products (title, slug, category_id, team_id, images, gender, season, is_retro, is_featured, description, brand_id)
select
  d.title,
  d.slug,
  '${CATEGORIA_EQUIPACIONES}',
  d.team_id,
  jsonb_build_array(d.image),
  'unisex',
  d.season,
  true,
  false,
  null,
  null
from (values
${values}
) as d(title, slug, team_id, image, season)
on conflict (slug) do update set
  title       = excluded.title,
  images      = excluded.images,
  team_id     = excluded.team_id,
  season      = excluded.season,
  is_retro    = excluded.is_retro;

commit;
`;

writeFileSync('supabase/seed-retro-soccerplus.sql', sql);
console.log(`${manifest.length} productos -> supabase/seed-retro-soccerplus.sql`);
