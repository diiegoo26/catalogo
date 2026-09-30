-- 2026-30 -- Copas domesticas: crear competiciones y vincular equipos por pais.
-- Aplicado con el MCP de Supabase (proyecto catalogo). Idempotente.
-- Tanda A: copas que ya existian + 3 con logo verificado en footylogos.
-- Resultado: 11 competiciones, 197 equipos con al menos una competicion.

-- 1) Competiciones nuevas (idempotente por slug)
insert into competitions (name, slug, logo_url, kind) values
  ('Copa do Brasil',   'copa-do-brasil',   'https://www.footylogos.com/downloads/logo/copa-do-brasil-logo-footylogos.png',   'copa'),
  ('Taca de Portugal', 'taca-de-portugal', 'https://www.footylogos.com/downloads/logo/taca-de-portugal-logo-footylogos.png', 'copa'),
  ('US Open Cup',      'us-open-cup',      'https://www.footylogos.com/downloads/logo/us-open-cup-logo-footylogos.png',      'copa')
on conflict (slug) do nothing;

-- 2) Liga -> copa nacional
with map(league_slug, cup_slug) as (
  values
    ('laliga','copa-del-rey'), ('segunda-division','copa-del-rey'),
    ('premier-league','fa-cup'), ('championship','fa-cup'),
    ('serie-a','coppa-italia'), ('serie-b','coppa-italia'),
    ('bundesliga','dfb-pokal'), ('bundesliga-2','dfb-pokal'),
    ('ligue-1','coupe-de-france'), ('ligue-2','coupe-de-france'),
    ('serie-a-brasil','copa-do-brasil'),
    ('liga-portugal','taca-de-portugal'),
    ('mls','us-open-cup')
)
insert into team_competitions (team_id, competition_id)
select t.id, c.id
from teams t
join leagues l on l.id = t.league_id
join map m on m.league_slug = l.slug
join competitions c on c.slug = m.cup_slug
on conflict (team_id, competition_id) do nothing;
