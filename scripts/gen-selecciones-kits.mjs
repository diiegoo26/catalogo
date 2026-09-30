// Generates supabase/seed-selecciones-2026.sql: national-team kits (2026 World Cup)
// for the teams under region "Selecciones" -> league "Selecciones nacionales".
//
// Same convention as the club kits already in the catalogue:
//   one product per kit, slug "<team-slug>-2026-<kind>",
//   title "Equipación de <label> <Team> 2026", season "2026-27", gender "unisex".
//
// Read-only against FootyLogos; writes only the SQL file. Idempotent on re-run
// (products.slug is unique, the SQL uses ON CONFLICT DO UPDATE).
//
// Run: node scripts/gen-selecciones-kits.mjs

import { writeFileSync } from 'node:fs';

const CATEGORY_EQUIPACIONES = '612957f3-fc5a-4076-8daf-d099420b01a1';
const SEASON = '2026-27';

// team slug -> { name, id, flSlug (FootyLogos ES gallery) }
const TEAMS = [
  { slug: 'alemania',       name: 'Alemania',       id: '472a93a1-6b51-42c6-b813-4f60759d7258', fl: 'alemania-mundial-2026' },
  { slug: 'argentina',      name: 'Argentina',      id: '6080ee44-81c2-43e1-813b-030a48df907c', fl: 'argentina-mundial-2026' },
  { slug: 'belgica',        name: 'Bélgica',        id: '8c7656e8-0279-4071-a784-175b97363fbd', fl: 'belgica-mundial-2026' },
  { slug: 'brasil',         name: 'Brasil',         id: '2a766315-e59c-4105-a152-08bea892ea80', fl: 'brasil-mundial-2026' },
  { slug: 'croacia',        name: 'Croacia',        id: 'e9ce776c-ce20-46c2-bd92-d7b906b27291', fl: 'croacia-mundial-2026' },
  { slug: 'espana',         name: 'España',         id: '2874ed67-8728-41cc-9e36-4554a780ec2b', fl: 'espana-mundial-2026' },
  { slug: 'estados-unidos', name: 'Estados Unidos', id: '0e06cc45-8558-4a52-b89e-77499a2e69da', fl: 'estados-unidos-mundial-2026' },
  { slug: 'francia',        name: 'Francia',        id: '71ac33d0-aeb1-47f2-86e7-fb8a0fc9f14b', fl: 'francia-mundial-2026' },
  { slug: 'inglaterra',     name: 'Inglaterra',     id: '4bba547e-bfbd-4a8f-bb9c-f9dc2436782d', fl: 'inglaterra-mundial-2026' },
  { slug: 'italia',         name: 'Italia',         id: 'dd6fd25f-47f5-4bed-804a-cee5de401712', fl: null }, // no FootyLogos WC gallery
  { slug: 'japon',          name: 'Japón',          id: 'd9ea4c1d-6fcb-4a75-a9dd-09ca870fddf0', fl: 'japon-mundial-2026' },
  { slug: 'marruecos',      name: 'Marruecos',      id: '45d1816c-85e8-4ed3-8e7f-cdc470762005', fl: 'marruecos-mundial-2026' },
  { slug: 'mexico',         name: 'México',         id: '46063f92-e8e5-4209-8228-96e812d0b8af', fl: 'mexico-mundial-2026' },
  { slug: 'paises-bajos',   name: 'Países Bajos',   id: 'e0a1b0b9-0d81-4227-97dc-625161877149', fl: 'paises-bajos-mundial-2026' },
  { slug: 'portugal',       name: 'Portugal',       id: 'ffbe6abd-855d-4955-8331-0928e68d9f9c', fl: 'portugal-mundial-2026' },
  { slug: 'uruguay',        name: 'Uruguay',        id: '77c6d9e8-7816-4a40-9676-42e84a6a0a10', fl: 'uruguay-mundial-2026' },
];

const LABELS = {
  home: 'local', away: 'visitante', third: 'tercera',
  fourth: 'cuarta', anniversary: 'aniversario', goalkeeper: 'portero',
};
const ORDER = ['home', 'away', 'third', 'fourth', 'anniversary', 'goalkeeper'];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) catalogo-kit-import';
const IMG = /https:\/\/www\.footylogos\.com\/kits\/([a-z0-9-]+)\/([a-z]+)-(cover|\d{1,3})\.(?:webp|png|jpe?g)/g;

const esc = (s) => s.replace(/'/g, "''");

// -> Map<kind, { folder, files: ['cover','01',...] }>
async function kitsFor(flSlug) {
  const res = await fetch(`https://www.footylogos.com/es/kits/${flSlug}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${flSlug}`);
  const html = await res.text();
  const byKind = new Map();
  const seen = new Set();
  for (const m of html.matchAll(IMG)) {
    const [, folder, kind, n] = m;
    if (!(kind in LABELS)) continue;
    if (seen.has(m[0])) continue;           // the page repeats each cover in several tags
    seen.add(m[0]);
    const entry = byKind.get(kind) ?? { folder, files: [] };
    entry.files.push(n);
    byKind.set(kind, entry);
  }
  for (const { files } of byKind.values())
    files.sort((a, b) => (a === 'cover' ? -1 : b === 'cover' ? 1 : Number(a) - Number(b)));
  return byKind;
}

const rows = [];
for (const t of TEAMS) {
  if (t.fl === null) {
    console.warn(`SKIP ${t.slug}: no FootyLogos World Cup gallery`);
    continue;
  }
  const byKind = await kitsFor(t.fl);
  const kinds = [...byKind.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  if (!kinds.length) {
    console.warn(`SKIP ${t.slug}: no kit images parsed`);
    continue;
  }
  for (const kind of kinds) {
    const { folder, files } = byKind.get(kind);
    // Only the front/cover photo per kit: the catalogue shows one image per
    // equipación (local + visitante), same as the club kits.
    const cover = files.includes('cover') ? 'cover' : files[0];
    rows.push({
      title: `Equipación de ${LABELS[kind]} ${t.name} 2026`,
      slug: `${t.slug}-2026-${kind}`,
      teamId: t.id, folder, kind, files: [cover],
    });
  }
  console.log(`${t.name}: ${kinds.map((k) => `${k}(${byKind.get(k).files.length})`).join(', ')}`);
}

const values = rows.map((r) =>
  `  ('${esc(r.title)}', '${esc(r.slug)}', '${r.teamId}', '${r.folder}', '${r.kind}', '${r.files.join(',')}')`,
).join(',\n');

// SQL is compact: images are rebuilt from folder + kind + file name, so the seed
// stays readable and reviewable instead of repeating ~280 full URLs.
const sql = `-- Kits de selecciones (Mundial 2026) para la region "Selecciones".
-- Generado por scripts/gen-selecciones-kits.mjs. Idempotente (ON CONFLICT slug).
begin;

insert into products (title, slug, category_id, team_id, images, gender, season, is_featured)
select
  d.title, d.slug, '${CATEGORY_EQUIPACIONES}', d.team_id::uuid,
  (select jsonb_agg(
            'https://www.footylogos.com/kits/' || d.folder || '/' || d.kind || '-' || f || '.webp'
            order by o)
     from unnest(string_to_array(d.files, ',')) with ordinality as u(f, o)),
  'unisex', '${SEASON}', false
from (values
${values}
) as d(title, slug, team_id, folder, kind, files)
on conflict (slug) do update set
  title       = excluded.title,
  images      = excluded.images,
  team_id     = excluded.team_id,
  category_id = excluded.category_id,
  season      = excluded.season,
  gender      = excluded.gender;

commit;
`;

writeFileSync('supabase/seed-selecciones-2026.sql', sql);
console.log(`\n${rows.length} kit products -> supabase/seed-selecciones-2026.sql`);
