-- ============================================================================
-- KOVA - Imagenes reales 2026-27 (FootyLogos) - script compacto y verificado
-- Generado por scripts/build-compact-sql.mjs a partir de
-- supabase/equipaciones-2026-27-imagenes.sql. NO editar a mano.
-- 112 clubes - 2317 fotos - round-trip verificado 1:1.
-- ============================================================================
begin;

create or replace function pg_temp.kit_urls(prefix text, clubfile text, season text, ext text, spec text)
returns jsonb language sql immutable as $fn$
with runs as (
  select split_part(p,'::',1) as folder, split_part(p,'::',2) as kind, split_part(p,'::',3) as toks, ro as run_ord
  from regexp_split_to_table(spec, ';') with ordinality as x(p, ro)
), tks as (
  select folder, kind, toks, run_ord, tk.tok, vo as tok_ord
  from runs, regexp_split_to_table(runs.toks, ',') with ordinality as tk(tok, vo)
), parsed as (
  select folder, kind, run_ord, tok, tok_ord,
         case when tok = 'c' then 0 else split_part(tok, '-', 1)::int end as lo,
         case when tok = 'c' then 0
              when position('-' in tok) > 0 then split_part(tok, '-', 2)::int
              else split_part(tok, '-', 1)::int end as hi
  from tks
), expanded as (
  select folder, kind, run_ord, tok_ord,
         case when tok = 'c' then 'cover' else lpad((lo + gs.n - 1)::text, 2, '0') end as idx
  from parsed cross join lateral generate_series(1, hi - lo + 1) as gs(n)
)
select jsonb_agg(
  prefix || folder || '/' || idx || '-' || clubfile || '-' || season || '-' ||
  kind || '-kit-footylogos.' || ext
  order by run_ord, tok_ord, idx)
from expanded;
$fn$;

update products p set images = pg_temp.kit_urls(
    v.prefix || v.league || '/', v.clubfile, v.season, v.ext, v.spec)
  from (values
    ('ac-milan', 'https://assets.footylogos.com/kits/2026-27/', 'serie-a', 'ac-milan', '2026-27', 'jpg', 'batch-01::away::c,01-13;batch-01::third::c,01-06'),
    ('ajax', 'https://assets.footylogos.com/kits/2026-27/', 'eredivisie', 'ajax', '2026-27', 'jpg', 'batch-01::home::01-09;batch-01::away::c,01-08'),
    ('arsenal', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'arsenal-fc', '2026-27', 'jpg', 'batch-04::away::c;batch-01::away::01-03;batch-02::away::04-06;batch-03::away::07-09;batch-04::away::10-14;batch-04::third::c;batch-01::third::01-03;batch-02::third::04-06;batch-03::third::07-09;batch-04::third::10-11'),
    ('as-monaco', 'https://assets.footylogos.com/kits/2026-27/', 'ligue-1', 'as-monaco', '2026-27', 'jpg', 'batch-01::away::c,01-09;batch-01::third::c,01-04'),
    ('as-roma', 'https://assets.footylogos.com/kits/2026-27/', 'serie-a', 'as-roma', '2026-27', 'jpg', 'batch-01::home::c,01-14;batch-01::away::c,01-15'),
    ('aston-villa', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'aston-villa', '2026-27', 'jpg', 'batch-04::third::c;batch-01::third::01-03;batch-02::third::04-06;batch-03::third::07'),
    ('atalanta', 'https://assets.footylogos.com/kits/2026-27/', 'serie-a', 'atalanta', '2026-27', 'jpg', 'batch-01::home::c,01-13;batch-01::away::c,01-03;batch-02::away::04-11'),
    ('athletic-club', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'athletic-club', '2026-27', 'jpg', 'batch-01::third::c,01-08'),
    ('atlante', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'atlante', '2026-27', 'jpg', 'batch-01::home::c,01-16;batch-01::away::c,01-09'),
    ('atlas-fc', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'atlas', '2026-27', 'jpg', 'batch-01::home::c,01-10;batch-01::away::c,01-09'),
    ('atletico-mineiro', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'atletico-mineiro', '2026', 'jpg', 'batch-01::home::c,01-10;batch-01::away::c,01-09;batch-01::third::c,01'),
    ('bahia', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'bahia', '2026', 'jpg', 'batch-03::home::c,01-02;batch-03::away::c,01'),
    ('bayer-leverkusen', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'bayer-leverkusen', '2026-27', 'jpg', 'batch-01::home::c,01-12;batch-01::away::c,01-12;batch-01::third::c,01-09'),
    ('birmingham-city', 'https://assets.footylogos.com/kits/2026-27/', 'efl-championship', 'birmingham-city', '2026-27', 'jpg', 'batch-01::home::c,01-10;batch-01::away::c,01-06'),
    ('blackburn-rovers', 'https://assets.footylogos.com/kits/2026-27/', 'efl-championship', 'blackburn-rovers', '2026-27', 'jpg', 'batch-01::home::c,01-09;batch-01::away::c,01-05;batch-01::third::c,01-02'),
    ('bologna', 'https://assets.footylogos.com/kits/2026-27/', 'serie-a', 'bologna', '2026-27', 'jpg', 'batch-02::home::01-08;batch-02::away::c,01-15'),
    ('borussia-dortmund', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'borussia-dortmund', '2026-27', 'jpg', 'batch-02::away::c,01-12;batch-02::third::c,01-10'),
    ('borussia-monchengladbach', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'borussia-monchengladbach', '2026-27', 'jpg', 'batch-02::third::c,01-10'),
    ('botafogo', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'botafogo', '2026', 'jpg', 'batch-01::home::c,01-08;batch-01::away::c,01-14;batch-01::third::c,01-10'),
    ('brentford', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'brentford-fc', '2026-27', 'jpg', 'batch-04::home::c;batch-01::home::01-03;batch-02::home::04-06;batch-03::home::07;batch-04::away::c;batch-01::away::01-03;batch-02::away::04-05;batch-04::third::c;batch-01::third::01-03;batch-02::third::04-05'),
    ('brighton', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'brighton-hove-albion', '2026-27', 'jpg', 'batch-04::home::c;batch-01::home::01-03;batch-02::home::04-06;batch-03::home::07-09;batch-04::home::10-12;batch-04::away::c;batch-01::away::01-03;batch-02::away::04-06;batch-03::away::07-09;batch-04::away::10-11;batch-04::third::c;batch-01::third::01-03;batch-02::third::04-06;batch-03::third::07-09;batch-04::third::10'),
    ('ca-osasuna', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'ca-osasuna', '2026-27', 'jpg', 'batch-01::home::c,01-10;batch-01::away::c,01-15;batch-01::third::c,01-07'),
    ('cardiff-city', 'https://assets.footylogos.com/kits/2026-27/', 'efl-championship', 'cardiff-city', '2026-27', 'jpg', 'batch-01::away::c,01-06;batch-01::third::c,01-04'),
    ('celta-de-vigo', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'celta-vigo', '2026-27', 'jpg', 'batch-01::third::c,01-08'),
    ('celtic-fc', 'https://assets.footylogos.com/kits/2026-27/', 'uefa-europa-league', 'celtic', '2026-27', 'webp', 'batch-02::home::c,01-10;batch-02::away::c,01-12;batch-02::third::c,01-07'),
    ('chapecoense', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'chapecoense', '2026', 'jpg', 'batch-01::home::c,01-09;batch-01::away::c,01-04'),
    ('chelsea', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'chelsea-fc', '2026-27', 'jpg', 'batch-04::away::c;batch-01::away::01-03;batch-02::away::04-05;batch-03::away::06-07'),
    ('chivas-guadalajara', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'cd-guadalajara', '2026-27', 'jpg', 'batch-01::home::c,01'),
    ('club-america', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'club-america', '2026-27', 'jpg', 'batch-01::home::c,01-15;batch-01::away::c,01-10'),
    ('como', 'https://assets.footylogos.com/kits/2026-27/', 'serie-a', 'como-1907', '2026-27', 'jpg', 'batch-02::home::c,01-15;batch-02::away::c,01-13'),
    ('corinthians', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'corinthians', '2026', 'jpg', 'batch-05::home::c,01-06;batch-05::away::c,01-08;batch-05::third::c,01'),
    ('coritiba', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'coritiba', '2026', 'jpg', 'batch-02::home::c,01-12;batch-02::away::c,01-15;batch-02::third::c,01-06'),
    ('coventry-city', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'coventry-city', '2026-27', 'jpg', 'batch-04::away::c;batch-01::away::01-03;batch-02::away::04-05;batch-03::away::06-07'),
    ('cruz-azul', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'cruz-azul', '2026-27', 'jpg', 'batch-02::home::c,01-09;batch-02::away::c,01-09'),
    ('cruzeiro', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'cruzeiro', '2026', 'jpg', 'batch-02::home::c,01-11;batch-02::away::c,01-05;batch-03::away::06-11;batch-03::third::c,01-13'),
    ('deportivo', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'deportivo-de-a-coruna', '2026-27', 'jpg', 'batch-01::away::c,01-07;batch-01::third::c,01-12'),
    ('deportivo-alaves', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'deportivo-alaves', '2026-27', 'jpg', 'batch-01::away::c,01-11;batch-01::third::c,01-11'),
    ('derby-county', 'https://assets.footylogos.com/kits/2026-27/', 'efl-championship', 'derby-county', '2026-27', 'jpg', 'batch-01::away::c,01-08;batch-02::away::09-10'),
    ('eintracht-frankfurt', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'eintracht-frankfurt', '2026-27', 'jpg', 'batch-02::away::c,01-09;batch-02::third::c,01-07'),
    ('elche-cf', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'elche-cf', '2026-27', 'jpg', 'batch-01::home::c,01;batch-02::home::02-08;batch-02::away::c,01-09;batch-02::third::c,01-06'),
    ('estrasburgo', 'https://assets.footylogos.com/kits/2026-27/', 'ligue-1', 'rc-strasbourg-alsace', '2026-27', 'jpg', 'batch-03::home::c,01-09;batch-03::away::c,01-13'),
    ('everton', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'everton-fc', '2026-27', 'jpg', 'batch-04::away::c;batch-01::away::01-03;batch-02::away::04-05;batch-03::away::06-07'),
    ('fc-barcelona', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'fc-barcelona', '2026-27', 'jpg', 'batch-02::away::c,01-12;batch-02::third::c,01-10'),
    ('fc-colonia', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', '1-fc-koln', '2026-27', 'jpg', 'batch-01::away::c,01-09;batch-01::third::c,01-09'),
    ('fc-porto', 'https://assets.footylogos.com/kits/2026-27/', 'uefa-champions-league', 'fc-porto', '2026-27', 'jpg', 'batch-02::home::c,01-12;batch-02::away::c,01-08;batch-02::third::c,01-06'),
    ('feyenoord', 'https://assets.footylogos.com/kits/2026-27/', 'eredivisie', 'feyenoord', '2026-27', 'jpg', 'batch-01::away::c,01-12'),
    ('fiorentina', 'https://assets.footylogos.com/kits/2026-27/', 'serie-a', 'fiorentina', '2026-27', 'jpg', 'batch-01::home::c,01-09;batch-01::away::c,01-08'),
    ('fk-bodo-glimt', 'https://assets.footylogos.com/kits/2026-27/', 'uefa-champions-league', 'fk-bodo-glimt', '2026-27', 'jpg', 'batch-01::home::c,01-14;batch-01::away::c,01-08'),
    ('flamengo', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'flamengo', '2026', 'jpg', 'batch-03::home::c,01-11;batch-03::away::c,01-06;batch-03::third::c,01-13'),
    ('fluminense', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'fluminense', '2026', 'jpg', 'batch-03::home::c,01-09;batch-03::away::c,01-07;batch-03::third::c,01-08'),
    ('fulham', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'fulham-fc', '2026-27', 'jpg', 'batch-04::home::c;batch-01::home::01-03;batch-02::home::04-05;batch-03::home::06-08;batch-04::away::c;batch-01::away::01-03;batch-02::away::04-05;batch-03::away::06-09;batch-04::third::c;batch-01::third::01-03;batch-02::third::04-05;batch-03::third::06-09'),
    ('gremio', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'gremio', '2026', 'jpg', 'batch-03::home::c,01-06;batch-03::away::c,01-06;batch-03::third::c;batch-04::third::01-05'),
    ('hamburgo', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'hamburger-sv', '2026-27', 'jpg', 'batch-02::home::c,01-09;batch-02::away::c;bundesliga-batch-03-rebuilt::away::01-13'),
    ('hoffenheim', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'tsg-hoffenheim', '2026-27', 'jpg', 'batch-04::home::01-08;batch-04::away::01-06'),
    ('hull-city', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'hull-city-afc', '2026-27', 'jpg', 'batch-04::away::c;batch-01::away::01-03;batch-02::away::04-05;batch-03::away::06-09'),
    ('inter-de-milan', 'https://assets.footylogos.com/kits/2026-27/', 'uefa-champions-league', 'inter-milan', '2026-27', 'jpg', 'batch-02::away::c,01-02'),
    ('internacional', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'sc-internacional', '2026', 'jpg', 'batch-05::home::c,01-07;batch-05::away::c,01-09;batch-05::third::c,01-02'),
    ('juventus', 'https://assets.footylogos.com/kits/2026-27/', 'serie-a', 'juventus', '2026-27', 'jpg', 'batch-03::away::c,01-15;batch-03::third::c,01-13'),
    ('lazio', 'https://assets.footylogos.com/kits/2026-27/', 'serie-a', 'lazio', '2026-27', 'jpg', 'batch-03::home::c,01-06;batch-03::away::c,01-03;batch-03::third::c,01-05'),
    ('leeds-united', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'leeds-united', '2026-27', 'jpg', 'batch-04::home::c;batch-01::home::01-03;batch-02::home::04-05;batch-03::home::06-09;batch-04::home::10'),
    ('levante-ud', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'levante-ud', '2026-27', 'jpg', 'batch-02::home::c,01-12;batch-02::away::c,01-07;batch-02::third::c,01-10'),
    ('losc-lille', 'https://assets.footylogos.com/kits/2026-27/', 'ligue-1', 'losc-lille', '2026-27', 'jpg', 'batch-02::home::c,01-07;batch-02::away::c,01-09'),
    ('malaga', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'malaga-cf', '2026-27', 'jpg', 'batch-02::home::c,01-08;batch-02::away::c,01-10;batch-03::third::c,01-11'),
    ('manchester-city', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'manchester-city', '2026-27', 'jpg', 'batch-04::away::c;batch-01::away::01-02;batch-02::away::03-05;batch-03::away::06-09;batch-04::away::10-11'),
    ('manchester-united', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'manchester-united', '2026-27', 'jpg', 'batch-04::away::c;batch-01::away::01-02;batch-02::away::03-05;batch-03::away::06-07;batch-04::third::c;batch-01::third::01-02;batch-02::third::03-05;batch-03::third::06-09;batch-04::third::10-11'),
    ('middlesbrough', 'https://assets.footylogos.com/kits/2026-27/', 'efl-championship', 'middlesbrough-fc', '2026-27', 'jpg', 'batch-02::home::c,01-09;batch-02::away::c,01-09;batch-02::third::c,01-08'),
    ('monterrey', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'monterrey', '2026-27', 'jpg', 'batch-03::home::c,01-09'),
    ('napoli', 'https://assets.footylogos.com/kits/2026-27/', 'serie-a', 'napoli', '2026-27', 'jpg', 'batch-03::home::c;batch-04::home::01-18;batch-04::away::c,01-12;batch-04::third::c,01-08'),
    ('newcastle-united', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'newcastle-united', '2026-27', 'jpg', 'batch-04::home::c;batch-01::home::01-02;batch-02::home::03-05;batch-03::home::06-07;batch-04::away::c;batch-01::away::01-02;batch-02::away::03-05;batch-03::away::06-09;batch-04::third::c;batch-01::third::01-02;batch-02::third::03-05;batch-03::third::06-08'),
    ('nottingham-forest', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'nottingham-forest', '2026-27', 'jpg', 'batch-04::home::c;batch-01::home::01-02;batch-02::home::03-05;batch-03::home::06;batch-04::away::c;batch-01::away::01-02;batch-02::away::03-05;batch-03::away::06-07'),
    ('olympiacos', 'https://assets.footylogos.com/kits/2026-27/', 'uefa-europa-league', 'olympiacos', '2026-27', 'webp', 'batch-04::home::c,01-12;batch-04::away::c,01-04;batch-04::third::c,01-06'),
    ('olympique-de-lyon', 'https://assets.footylogos.com/kits/2026-27/', 'ligue-1', 'olympique-lyonnais', '2026-27', 'jpg', 'batch-02::third::c,01-12'),
    ('olympique-de-marsella', 'https://assets.footylogos.com/kits/2026-27/', 'ligue-1', 'olympique-de-marseille-om', '2026-27', 'jpg', 'batch-02::third::c,01-08'),
    ('palmeiras', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'palmeiras', '2026', 'jpg', 'batch-04::home::c,01-08;batch-04::away::c,01-08'),
    ('paranaense', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'athletico-paranaense', '2026', 'jpg', 'batch-01::home::c,01-09;batch-01::away::c,01-11;batch-01::third::c,01-04;batch-02::third::05-09'),
    ('parma', 'https://assets.footylogos.com/kits/2026-27/', 'serie-a', 'parma', '2026-27', 'jpg', 'batch-03::home::c,01-08;batch-03::away::c,01'),
    ('preston-north-end', 'https://assets.footylogos.com/kits/2026-27/', 'efl-championship', 'preston-north-end', '2026-27', 'jpg', 'batch-02::third::c,01-05;batch-03::third::06'),
    ('psv-eindhoven', 'https://assets.footylogos.com/kits/2026-27/', 'eredivisie', 'psv-eindhoven', '2026-27', 'jpg', 'batch-02::home::c,01-08'),
    ('pumas-unam', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'pumas-unam', '2026-27', 'jpg', 'batch-03::home::c,01-05;batch-03::away::c,01-06'),
    ('racing-santander', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'racing-de-santander', '2026-27', 'jpg', 'batch-03::home::c,01-06;batch-03::away::c,01-06'),
    ('rayo-vallecano', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'rayo-vallecano', '2026-27', 'jpg', 'batch-03::home::c,01-03;batch-03::away::c,01-02;batch-03::third::c,01'),
    ('rb-leipzig', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'rb-leipzig', '2026-27', 'jpg', 'bundesliga-batch-03-rebuilt::away::c,01-08'),
    ('rc-lens', 'https://assets.footylogos.com/kits/2026-27/', 'ligue-1', 'rc-lens', '2026-27', 'jpg', 'batch-03::third::c,01-10'),
    ('rcd-espanyol', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'rcd-espanyol', '2026-27', 'jpg', 'batch-03::away::c,01-07;batch-03::third::c,01-05'),
    ('real-betis', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'real-betis', '2026-27', 'jpg', 'batch-03::away::c,01-04;batch-03::third::c,01-13'),
    ('real-madrid', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'real-madrid', '2026-27', 'jpg', 'batch-03::away::c,01-16;batch-03::third::c,01-09'),
    ('real-sociedad', 'https://assets.footylogos.com/kits/2026-27/', 'uefa-europa-league', 'real-sociedad', '2026-27', 'webp', 'batch-04::home::c,01-04'),
    ('remo', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'club-de-remo', '2026', 'jpg', 'batch-02::home::c,01-10;batch-02::away::c,01-09;batch-02::third::c,01'),
    ('santos', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'santos-fc', '2026', 'jpg', 'batch-04::home::c,01-16;batch-04::away::c,01-12;batch-04::fourth::c,01'),
    ('santos-laguna', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'santos-laguna', '2026-27', 'jpg', 'batch-03::home::c,01-02;batch-03::away::c,01-02'),
    ('sao-paulo', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'sao-paulo', '2026', 'jpg', 'batch-04::home::c,01;batch-05::home::02-09;batch-05::away::c,01-12;batch-05::third::c,01-11'),
    ('sc-freiburg', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'sc-freiburg', '2026-27', 'jpg', 'bundesliga-batch-03-rebuilt::home::01-05;bundesliga-batch-03-rebuilt::away::c,01-07;bundesliga-batch-03-rebuilt::third::01-03'),
    ('schalke-04', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'schalke-04', '2026-27', 'jpg', 'bundesliga-batch-03-rebuilt::home::c,01-10;bundesliga-batch-03-rebuilt::away::c,01-13;bundesliga-batch-03-rebuilt::third::c,01-07'),
    ('sevilla-fc', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'sevilla-fc', '2026-27', 'jpg', 'batch-03::home::c,01-04;batch-04::home::05-09;batch-04::away::c,01-14;batch-04::third::c,01-14'),
    ('sheffield-united', 'https://assets.footylogos.com/kits/2026-27/', 'efl-championship', 'sheffield-united', '2026-27', 'jpg', 'batch-03::home::c,01-10;batch-03::away::c,01-09;batch-03::third::c,01-09'),
    ('sl-benfica', 'https://assets.footylogos.com/kits/2026-27/', 'uefa-europa-league', 'sl-benfica', '2026-27', 'webp', 'batch-01::home::c,01-07;batch-01::away::c,01-07;batch-01::third::c,01-03'),
    ('sporting-cp', 'https://assets.footylogos.com/kits/2026-27/', 'uefa-champions-league', 'sporting-cp', '2026-27', 'jpg', 'batch-03::home::c,01-06;batch-03::away::c,01-08;batch-03::anniversary::c,01-05'),
    ('stade-rennais', 'https://assets.footylogos.com/kits/2026-27/', 'ligue-1', 'stade-rennais', '2026-27', 'jpg', 'batch-03::away::c,01-08;batch-03::third::c,01-16'),
    ('sunderland', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'sunderland-afc', '2026-27', 'jpg', 'batch-04::home::c;batch-01::home::01-02;batch-02::home::03-05;batch-03::home::06-08;batch-04::home::09-12;batch-04::third::c;batch-01::third::01-02;batch-02::third::03-05;batch-03::third::06-07'),
    ('tigres-uanl', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'tigres-uanl', '2026-27', 'jpg', 'batch-03::home::c,01-13;batch-03::away::c,01-16'),
    ('tijuana', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'club-tijuana', '2026-27', 'jpg', 'batch-02::home::c,01-05;batch-02::away::c,01-04'),
    ('toluca', 'https://assets.footylogos.com/kits/2026-27/', 'liga-mx', 'toluca', '2026-27', 'jpg', 'batch-02::home::c,01-09;batch-02::away::c,01-05;batch-03::away::06-09'),
    ('tottenham-hotspur', 'https://assets.footylogos.com/kits/2026-27/', 'premier-league', 'tottenham-hotspur', '2026-27', 'jpg', 'batch-04::third::c;batch-01::third::01-02;batch-02::third::03-05;batch-03::third::06-08;batch-04::third::09'),
    ('toulouse', 'https://assets.footylogos.com/kits/2026-27/', 'ligue-1', 'toulouse-fc', '2026-27', 'jpg', 'batch-03::home::c,01-05;batch-04::home::06-11;batch-04::away::c,01-14'),
    ('union-berlin', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'union-berlin', '2026-27', 'jpg', 'batch-04::away::c,01-06;batch-04::third::c,01-07'),
    ('valencia-cf', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'valencia-cf', '2026-27', 'jpg', 'batch-04::away::c,01-12;batch-04::third::c,01-09'),
    ('vasco-da-gama', 'https://assets.footylogos.com/kits/2026/', 'brasileirao-serie-a', 'vasco-da-gama', '2026', 'jpg', 'batch-02::home::c,01-11;batch-02::away::c,01-05'),
    ('vfb-stuttgart', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'vfb-stuttgart', '2026-27', 'jpg', 'batch-04::home::c,01-14;batch-04::away::c,01-11;batch-04::third::c,01-12'),
    ('villarreal-cf', 'https://assets.footylogos.com/kits/2026-27/', 'laliga', 'villarreal-cf', '2026-27', 'jpg', 'batch-04::away::c,01-10;batch-04::third::c,01-09'),
    ('werder-bremen', 'https://assets.footylogos.com/kits/2026-27/', 'bundesliga', 'werder-bremen', '2026-27', 'jpg', 'batch-04::home::c,01-10;batch-04::away::c,01-09'),
    ('west-bromwich-albion', 'https://assets.footylogos.com/kits/2026-27/', 'efl-championship', 'west-bromwich-albion', '2026-27', 'jpg', 'batch-04::home::c,01-14;batch-04::away::c,01-12'),
    ('wrexham', 'https://assets.footylogos.com/kits/2026-27/', 'efl-championship', 'wrexham-afc', '2026-27', 'jpg', 'batch-05::home::01-11;batch-05::away::c,01-10')
  ) as v(team_slug, prefix, league, clubfile, season, ext, spec)
  join teams t on t.slug = v.team_slug
 where p.team_id = t.id;

commit;
