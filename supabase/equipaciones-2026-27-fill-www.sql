-- ============================================================================
-- KOVA - Relleno de variantes que solo existen en www.footylogos.com
-- Generado por scripts/build-fill-sql.mjs. NO editar a mano.
-- 58 clubes - 800 fotos - prepend 53 / replace 5
-- ============================================================================
begin;

create or replace function pg_temp.web_urls(base text, slug text, season text, ext text, spec text)
returns jsonb language sql immutable as $fn$
with runs as (
  select split_part(p,'::',1) as kind, split_part(p,'::',2) as toks, ro as run_ord
  from regexp_split_to_table(spec, ';') with ordinality as x(p, ro)
), tks as (
  select kind, run_ord, tk.tok, vo as tok_ord
  from runs, regexp_split_to_table(runs.toks, ',') with ordinality as tk(tok, vo)
), parsed as (
  select kind, run_ord, tok, tok_ord,
         case when tok = 'c' then 0 else split_part(tok, '-', 1)::int end as lo,
         case when tok = 'c' then 0
              when position('-' in tok) > 0 then split_part(tok, '-', 2)::int
              else split_part(tok, '-', 1)::int end as hi
  from tks
), expanded as (
  select kind, run_ord, tok_ord,
         case when tok = 'c' then 'cover' else lpad((lo + gs.n - 1)::text, 2, '0') end as num
  from parsed cross join lateral generate_series(1, hi - lo + 1) as gs(n)
)
select jsonb_agg(base || slug || '-' || season || '/' || kind || '-' || num || '.' || ext
                 order by run_ord, tok_ord, num)
from expanded;
$fn$;

-- Rango de la variante dentro de la galeria: local, visitante, tercera, ...
create or replace function pg_temp.kind_rank(u text) returns int language sql immutable as $kr$
  select case when u like '%-home-kit-footylogos.%' or u ~ '/home-' then 1
              when u like '%-away-kit-footylogos.%' or u ~ '/away-' then 2
              when u like '%-third-kit-footylogos.%' or u ~ '/third-' then 3
              when u like '%-fourth-kit-footylogos.%' or u ~ '/fourth-' then 4
              when u like '%-anniversary-kit-footylogos.%' or u ~ '/anniversary-' then 5
              else 6 end
$kr$;

-- Estos clubes no tenian fotos en assets: la galeria de www los sustituye por completo.
update products p set images = pg_temp.web_urls('https://www.footylogos.com/kits/', v.slug, v.season, v.ext, v.spec)
  from (values
    ('atletico-de-madrid', 'atletico-madrid', '2026-27', 'webp', 'home::c,01-10;away::c,01-07;third::c,01-09'),
    ('getafe-cf', 'getafe-cf', '2026-27', 'webp', 'home::c,01-06;away::c,01-06;third::c,01-06'),
    ('inter-miami-cf', 'inter-miami', '2026', 'webp', 'home::c,01-08;away::c,01-08'),
    ('ipswich-town', 'ipswich-town', '2026-27', 'webp', 'home::c,01-09;away::c,01-09'),
    ('new-york-city-fc', 'new-york-city-fc', '2026', 'webp', 'home::c,01-08;away::c,01-07')
  ) as v(team_slug, slug, season, ext, spec)
  join teams t on t.slug = v.team_slug
 where p.team_id = t.id;

-- Antepone las variantes que faltaban, respetando el orden local > visitante > tercera.
update products p set images = (
    select jsonb_agg(u order by rnk, src, ord)
    from (
      select u, pg_temp.kind_rank(u) as rnk, 0 as src, ord
      from jsonb_array_elements_text(pg_temp.web_urls('https://www.footylogos.com/kits/', v.slug, v.season, v.ext, v.spec)) with ordinality as w(u, ord)
      union all
      select u, pg_temp.kind_rank(u) as rnk, 1 as src, ord
      from jsonb_array_elements_text(p.images) with ordinality as e(u, ord)
    ) s
  )
  from (values
    ('ac-milan', 'ac-milan', '2026-27', 'webp', 'home::c,01-13'),
    ('ajax', 'ajax', '2026-27', 'webp', 'third::c,01-08'),
    ('arsenal', 'arsenal', '2026-27', 'webp', 'home::c,01-14'),
    ('as-monaco', 'as-monaco', '2026-27', 'webp', 'home::c,01-06'),
    ('as-roma', 'as-roma', '2026-27', 'webp', 'third::c,01-06'),
    ('aston-villa', 'aston-villa', '2026-27', 'webp', 'home::c,01-13;away::c,01-12'),
    ('atalanta', 'atalanta', '2026-27', 'webp', 'third::c,01-08'),
    ('athletic-club', 'athletic-club-bilbao', '2026-27', 'webp', 'home::c,01-10;away::c,01-09'),
    ('birmingham-city', 'birmingham-city', '2026-27', 'webp', 'third::c,01-05'),
    ('borussia-dortmund', 'borussia-dortmund', '2026-27', 'webp', 'home::c,01-09'),
    ('borussia-monchengladbach', 'borussia-monchengladbach', '2026-27', 'webp', 'home::c,01-07;away::c,01-06'),
    ('cardiff-city', 'cardiff-city', '2026-27', 'webp', 'home::c,01-09'),
    ('celta-de-vigo', 'celta-vigo', '2026-27', 'webp', 'home::c,01-08;away::c,01-06'),
    ('chelsea', 'chelsea', '2026-27', 'webp', 'home::c,01-09;third::c,01-09'),
    ('coventry-city', 'coventry-city', '2026-27', 'webp', 'home::c,01-09;third::c,01-08'),
    ('deportivo', 'deportivo-la-coruna', '2026-27', 'webp', 'home::c,01-06'),
    ('deportivo-alaves', 'deportivo-alaves', '2026-27', 'webp', 'home::c,01-17'),
    ('derby-county', 'derby-county', '2026-27', 'webp', 'home::c,01-09;third::c,01-05'),
    ('eintracht-frankfurt', 'eintracht-frankfurt', '2026-27', 'webp', 'home::c,01-09'),
    ('estrasburgo', 'rc-strasbourg-alsace', '2026-27', 'webp', 'third::c,01-07'),
    ('everton', 'everton', '2026-27', 'webp', 'home::c,01-12;third::c,01-10'),
    ('fc-barcelona', 'fc-barcelona', '2026-27', 'webp', 'home::c,01-10'),
    ('fc-colonia', '1-fc-koln', '2026-27', 'webp', 'home::c,01-09'),
    ('feyenoord', 'feyenoord', '2026-27', 'webp', 'home::c,01-05;third::c,01-05'),
    ('hamburgo', 'hamburger-sv', '2026-27', 'webp', 'third::c,01-09'),
    ('hoffenheim', 'tsg-hoffenheim', '2026-27', 'webp', 'third::c,01-11'),
    ('hull-city', 'hull-city', '2026-27', 'webp', 'home::c,01-08;third::c,01-06'),
    ('inter-de-milan', 'inter-milan', '2026-27', 'webp', 'home::c,01-08;third::c,01-06'),
    ('juventus', 'juventus', '2026-27', 'webp', 'home::c,01-11'),
    ('leeds-united', 'leeds-united', '2026-27', 'webp', 'away::c,01-11;third::c,01-06'),
    ('losc-lille', 'losc-lille', '2026-27', 'webp', 'third::c,01-05'),
    ('manchester-city', 'manchester-city', '2026-27', 'webp', 'home::c,01-10;third::c,01-06'),
    ('manchester-united', 'manchester-united', '2026-27', 'webp', 'home::c,01-13'),
    ('nottingham-forest', 'nottingham-forest', '2026-27', 'webp', 'third::c,01-06'),
    ('olympique-de-lyon', 'olympique-lyonnais', '2026-27', 'webp', 'home::c,01-10;away::c,01-08'),
    ('olympique-de-marsella', 'olympique-de-marseille-om', '2026-27', 'webp', 'home::c,01-09;away::c,01-11'),
    ('parma', 'parma', '2026-27', 'webp', 'third::c,01-07'),
    ('preston-north-end', 'preston-north-end', '2026-27', 'webp', 'home::c,01-07;away::c,01-12'),
    ('psv-eindhoven', 'psv-eindhoven', '2026-27', 'webp', 'away::c,01-07;third::c,01-06'),
    ('rb-leipzig', 'rb-leipzig', '2026-27', 'webp', 'home::c,01-09;third::c,01-08'),
    ('rc-lens', 'rc-lens', '2026-27', 'webp', 'home::c,01-07;away::c,01-07'),
    ('rcd-espanyol', 'rcd-espanyol-barcelona', '2026-27', 'webp', 'home::c,01-05'),
    ('real-betis', 'real-betis-balompie', '2026-27', 'webp', 'home::c,01-08'),
    ('real-madrid', 'real-madrid', '2026-27', 'webp', 'home::c,01-13'),
    ('stade-rennais', 'stade-rennais', '2026-27', 'webp', 'home::c,01-06'),
    ('sunderland', 'sunderland', '2026-27', 'webp', 'away::c,01-08'),
    ('tottenham-hotspur', 'tottenham-hotspur', '2026-27', 'webp', 'home::c,01-08;away::c,01-11'),
    ('union-berlin', 'union-berlin', '2026-27', 'webp', 'home::c,01-07'),
    ('valencia-cf', 'valencia-cf', '2026-27', 'webp', 'home::c,01-12'),
    ('villarreal-cf', 'villarreal-cf', '2026-27', 'webp', 'home::c,01-07'),
    ('werder-bremen', 'werder-bremen', '2026-27', 'webp', 'third::c,01-12'),
    ('west-bromwich-albion', 'west-bromwich-albion', '2026-27', 'webp', 'third::c,01-04'),
    ('wrexham', 'wrexham-afc', '2026-27', 'webp', 'third::c,01-09')
  ) as v(team_slug, slug, season, ext, spec)
  join teams t on t.slug = v.team_slug
 where p.team_id = t.id;

commit;
