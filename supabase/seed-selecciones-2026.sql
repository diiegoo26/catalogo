-- Kits de selecciones (Mundial 2026) para la region "Selecciones".
-- Generado por scripts/gen-selecciones-kits.mjs. Idempotente (ON CONFLICT slug).
begin;

insert into products (title, slug, category_id, team_id, images, gender, season, is_featured)
select
  d.title, d.slug, '612957f3-fc5a-4076-8daf-d099420b01a1', d.team_id::uuid,
  (select jsonb_agg(
            'https://www.footylogos.com/kits/' || d.folder || '/' || d.kind || '-' || f || '.webp'
            order by o)
     from unnest(string_to_array(d.files, ',')) with ordinality as u(f, o)),
  'unisex', '2026-27', false
from (values
  ('Equipación de local Alemania 2026', 'alemania-2026-home', '472a93a1-6b51-42c6-b813-4f60759d7258', 'germany-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Alemania 2026', 'alemania-2026-away', '472a93a1-6b51-42c6-b813-4f60759d7258', 'germany-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Argentina 2026', 'argentina-2026-home', '6080ee44-81c2-43e1-813b-030a48df907c', 'argentina-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Argentina 2026', 'argentina-2026-away', '6080ee44-81c2-43e1-813b-030a48df907c', 'argentina-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Bélgica 2026', 'belgica-2026-home', '8c7656e8-0279-4071-a784-175b97363fbd', 'belgium-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Bélgica 2026', 'belgica-2026-away', '8c7656e8-0279-4071-a784-175b97363fbd', 'belgium-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Brasil 2026', 'brasil-2026-home', '2a766315-e59c-4105-a152-08bea892ea80', 'brazil-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Brasil 2026', 'brasil-2026-away', '2a766315-e59c-4105-a152-08bea892ea80', 'brazil-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Croacia 2026', 'croacia-2026-home', 'e9ce776c-ce20-46c2-bd92-d7b906b27291', 'croatia-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Croacia 2026', 'croacia-2026-away', 'e9ce776c-ce20-46c2-bd92-d7b906b27291', 'croatia-2026-world-cup', 'away', 'cover'),
  ('Equipación de local España 2026', 'espana-2026-home', '2874ed67-8728-41cc-9e36-4554a780ec2b', 'spain-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante España 2026', 'espana-2026-away', '2874ed67-8728-41cc-9e36-4554a780ec2b', 'spain-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Estados Unidos 2026', 'estados-unidos-2026-home', '0e06cc45-8558-4a52-b89e-77499a2e69da', 'usa-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Estados Unidos 2026', 'estados-unidos-2026-away', '0e06cc45-8558-4a52-b89e-77499a2e69da', 'usa-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Francia 2026', 'francia-2026-home', '71ac33d0-aeb1-47f2-86e7-fb8a0fc9f14b', 'france-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Francia 2026', 'francia-2026-away', '71ac33d0-aeb1-47f2-86e7-fb8a0fc9f14b', 'france-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Inglaterra 2026', 'inglaterra-2026-home', '4bba547e-bfbd-4a8f-bb9c-f9dc2436782d', 'england-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Inglaterra 2026', 'inglaterra-2026-away', '4bba547e-bfbd-4a8f-bb9c-f9dc2436782d', 'england-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Japón 2026', 'japon-2026-home', 'd9ea4c1d-6fcb-4a75-a9dd-09ca870fddf0', 'japan-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Japón 2026', 'japon-2026-away', 'd9ea4c1d-6fcb-4a75-a9dd-09ca870fddf0', 'japan-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Marruecos 2026', 'marruecos-2026-home', '45d1816c-85e8-4ed3-8e7f-cdc470762005', 'morocco-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Marruecos 2026', 'marruecos-2026-away', '45d1816c-85e8-4ed3-8e7f-cdc470762005', 'morocco-2026-world-cup', 'away', 'cover'),
  ('Equipación de local México 2026', 'mexico-2026-home', '46063f92-e8e5-4209-8228-96e812d0b8af', 'mexico-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante México 2026', 'mexico-2026-away', '46063f92-e8e5-4209-8228-96e812d0b8af', 'mexico-2026-world-cup', 'away', 'cover'),
  ('Equipación de tercera México 2026', 'mexico-2026-third', '46063f92-e8e5-4209-8228-96e812d0b8af', 'mexico-2026-world-cup', 'third', 'cover'),
  ('Equipación de local Países Bajos 2026', 'paises-bajos-2026-home', 'e0a1b0b9-0d81-4227-97dc-625161877149', 'netherlands-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Países Bajos 2026', 'paises-bajos-2026-away', 'e0a1b0b9-0d81-4227-97dc-625161877149', 'netherlands-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Portugal 2026', 'portugal-2026-home', 'ffbe6abd-855d-4955-8331-0928e68d9f9c', 'portugal-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Portugal 2026', 'portugal-2026-away', 'ffbe6abd-855d-4955-8331-0928e68d9f9c', 'portugal-2026-world-cup', 'away', 'cover'),
  ('Equipación de local Uruguay 2026', 'uruguay-2026-home', '77c6d9e8-7816-4a40-9676-42e84a6a0a10', 'uruguay-2026-world-cup', 'home', 'cover'),
  ('Equipación de visitante Uruguay 2026', 'uruguay-2026-away', '77c6d9e8-7816-4a40-9676-42e84a6a0a10', 'uruguay-2026-world-cup', 'away', 'cover')
) as d(title, slug, team_id, folder, kind, files)
on conflict (slug) do update set
  title       = excluded.title,
  images      = excluded.images,
  team_id     = excluded.team_id,
  category_id = excluded.category_id,
  season      = excluded.season,
  gender      = excluded.gender;

commit;
