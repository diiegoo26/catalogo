-- Seed: competition patches 2026-27
-- National cups are deterministic (every top-flight club enters its cup).
-- European qualifiers come from the completed 2025-26 season -> 2026-27 UEFA slots.
--
-- Sources (European qualification):
--   * football-data skill (ESPN data) 2026-27 Champions League / Europa League / Conference League team lists
--   * https://en.wikipedia.org/wiki/2026%E2%80%9327_UEFA_Champions_League
--   * https://en.wikipedia.org/wiki/2026%E2%80%9327_UEFA_Europa_League
--   * https://www.uefa.com/news-media/news/02a4-2060ea59fbc5-4be94b1fbe5a-1000--access-list-track-which-sides-will-play-in-the-2026-27-uef/
--   * https://kassiesa.net/uefa/qual2026.html
--
-- Idempotent: all inserts use "on conflict (...) do nothing".
-- Logo URLs verified HTTP 200 against https://www.footylogos.com (same host as existing leagues.logo_url).

insert into competitions (name, slug, logo_url, kind) values
  ('UEFA Champions League', 'champions-league', 'https://www.footylogos.com/downloads/logo/uefa-champions-league-logo-footylogos.png', 'continental'),
  ('UEFA Europa League',    'europa-league',    'https://www.footylogos.com/downloads/logo/europa-league-logo-footylogos.png', 'continental'),
  ('UEFA Conference League','conference-league','https://www.footylogos.com/downloads/logo/uefa-conference-league-logo-footylogos.png', 'continental'),
  ('Copa del Rey',          'copa-del-rey',     'https://www.footylogos.com/downloads/logo/copa-del-rey-logo-footylogos.png', 'copa'),
  ('FA Cup',                'fa-cup',           'https://www.footylogos.com/downloads/logo/emirates-fa-cup-logo-footylogos.png', 'copa'),
  ('Coppa Italia',          'coppa-italia',     'https://www.footylogos.com/downloads/logo/coppa-italia-logo-footylogos.png', 'copa'),
  ('DFB-Pokal',             'dfb-pokal',        'https://www.footylogos.com/downloads/logo/dfb-pokal-logo-footylogos.png', 'copa'),
  ('Coupe de France',       'coupe-de-france',  'https://www.footylogos.com/downloads/logo/coupe-de-france-logo-footylogos.png', 'copa')
on conflict (slug) do nothing;

-- National cups: every top-flight club with a 2026-27 kit plays its cup
insert into team_competitions (team_id, competition_id)
select t.id, c.id
  from teams t
  join leagues l on l.id = t.league_id
  join regions r on r.id = l.region_id
  join competitions c on c.slug = case r.name
        when 'Inglaterra' then 'fa-cup'
        when 'España'     then 'copa-del-rey'
        when 'Italia'     then 'coppa-italia'
        when 'Alemania'   then 'dfb-pokal'
        when 'Francia'    then 'coupe-de-france'
      end
 where l.slug in ('premier-league','laliga','serie-a','bundesliga','ligue-1')
   and exists (select 1 from products p where p.team_id = t.id and p.season = '2026-27')
on conflict do nothing;

-- European qualifiers 2026-27 (researched in Step 2; explicit, one line per club)
insert into team_competitions (team_id, competition_id)
select t.id, c.id from teams t, competitions c
 where (t.name, c.slug) in (
   -- UEFA Champions League (league phase / via 2025-26 final positions)
   ('Arsenal',           'champions-league'),
   ('Manchester City',   'champions-league'),
   ('Manchester United', 'champions-league'),
   ('Aston Villa',       'champions-league'),
   ('FC Barcelona',      'champions-league'),
   ('Real Madrid',       'champions-league'),
   ('Atlético de Madrid','champions-league'),
   ('Real Betis',        'champions-league'),
   ('Villarreal CF',     'champions-league'),
   ('Inter de Milán',    'champions-league'),
   ('Napoli',            'champions-league'),
   ('AS Roma',           'champions-league'),
   ('Como',              'champions-league'),
   ('Borussia Dortmund', 'champions-league'),
   ('RB Leipzig',        'champions-league'),
   ('VfB Stuttgart',     'champions-league'),
   ('LOSC Lille',        'champions-league'),
   ('RC Lens',           'champions-league'),
   -- UEFA Europa League (league phase)
   ('Sunderland',        'europa-league'),
   ('AC Milan',          'europa-league'),
   ('Juventus',          'europa-league'),
   ('Real Sociedad',     'europa-league'),
   ('Celta de Vigo',     'europa-league'),
   ('Hoffenheim',        'europa-league'),
   ('Bayer Leverkusen',  'europa-league'),
   ('Olympique de Marsella', 'europa-league'),
   ('Olympique de Lyon', 'europa-league'),
   ('Stade Rennais',     'europa-league'),
   -- UEFA Conference League (play-off / league path)
   ('Brighton',          'conference-league'),
   ('Atalanta',          'conference-league'),
   ('Getafe CF',         'conference-league'),
   ('SC Freiburg',       'conference-league'),
   ('AS Mónaco',         'conference-league')
   )
   and c.kind = 'continental'
on conflict do nothing;