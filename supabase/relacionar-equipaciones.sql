-- ============================================================================
-- KOVA catalogo · Relacionar productos (category equipaciones) con su equipo
-- Generado: mapeo de 62 productos a 56 equipos
--   -48 productos -> equipos ya existentes
--   110 equipos nuevos (14 regiones / 19 ligas nuevas)
-- Ejecutar en el SQL Editor de Supabase (o psql) con rol de escritura.
-- Es idempotente: se puede volver a ejecutar sin duplicar.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Regiones nuevas
-- ---------------------------------------------------------------------------
insert into regions (name, slug) values ('paises-bajos', 'paises-bajos') on conflict (slug) do nothing;
insert into regions (name, slug) values ('brasil', 'brasil') on conflict (slug) do nothing;
insert into regions (name, slug) values ('mexico', 'mexico') on conflict (slug) do nothing;
insert into regions (name, slug) values ('argentina', 'argentina') on conflict (slug) do nothing;
insert into regions (name, slug) values ('uruguay', 'uruguay') on conflict (slug) do nothing;
insert into regions (name, slug) values ('chile', 'chile') on conflict (slug) do nothing;
insert into regions (name, slug) values ('colombia', 'colombia') on conflict (slug) do nothing;
insert into regions (name, slug) values ('paraguay', 'paraguay') on conflict (slug) do nothing;
insert into regions (name, slug) values ('japon', 'japon') on conflict (slug) do nothing;
insert into regions (name, slug) values ('noruega', 'noruega') on conflict (slug) do nothing;
insert into regions (name, slug) values ('grecia', 'grecia') on conflict (slug) do nothing;
insert into regions (name, slug) values ('scotland', 'scotland') on conflict (slug) do nothing;
insert into regions (name, slug) values ('serbia', 'serbia') on conflict (slug) do nothing;
insert into regions (name, slug) values ('estados-unidos', 'estados-unidos') on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Ligas nuevas
-- ---------------------------------------------------------------------------
insert into leagues (name, slug, region_id) select 'segunda-division', 'segunda-division', id from regions where slug = 'espana' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'championship', 'championship', id from regions where slug = 'inglaterra' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'bundesliga-2', 'bundesliga-2', id from regions where slug = 'alemania' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'ligue-2', 'ligue-2', id from regions where slug = 'francia' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'serie-b', 'serie-b', id from regions where slug = 'italia' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'eredivisie', 'eredivisie', id from regions where slug = 'paises-bajos' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'serie-a-brasil', 'serie-a-brasil', id from regions where slug = 'brasil' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'liga-mx', 'liga-mx', id from regions where slug = 'mexico' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'liga-profesional', 'liga-profesional', id from regions where slug = 'argentina' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'primera-division', 'primera-division', id from regions where slug = 'uruguay' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'primera-division', 'primera-division', id from regions where slug = 'chile' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'categoria-primera-a', 'categoria-primera-a', id from regions where slug = 'colombia' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'primera-division', 'primera-division', id from regions where slug = 'paraguay' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'j-league', 'j-league', id from regions where slug = 'japon' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'eliteserien', 'eliteserien', id from regions where slug = 'noruega' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'super-league', 'super-league', id from regions where slug = 'grecia' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'scottish-premiership', 'scottish-premiership', id from regions where slug = 'scotland' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'serbian-superliga', 'serbian-superliga', id from regions where slug = 'serbia' on conflict (region_id, slug) do nothing;
insert into leagues (name, slug, region_id) select 'mls', 'mls', id from regions where slug = 'estados-unidos' on conflict (region_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Equipos nuevos
-- ---------------------------------------------------------------------------
insert into teams (name, slug, league_id) select 'Almeria', 'almeria', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Albacete', 'albacete', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Burgos', 'burgos', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Cadiz', 'cadiz', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Cordoba', 'cordoba', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Cultural Leonesa', 'cultural-leonesa', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Granada', 'granada', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Las Palmas', 'las-palmas', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Leganes', 'leganes', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Malaga', 'malaga', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Racing Santander', 'racing-santander', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Sporting Gijon', 'sporting-gijon', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Valladolid', 'valladolid', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Zaragoza', 'zaragoza', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'espana' and l.slug = 'segunda-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Birmingham City', 'birmingham-city', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Blackburn Rovers', 'blackburn-rovers', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Bradford City', 'bradford-city', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Cardiff City', 'cardiff-city', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Coventry City', 'coventry-city', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Derby County', 'derby-county', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Doncaster Rovers', 'doncaster-rovers', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Hull City', 'hull-city', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Ipswich Town', 'ipswich-town', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Leicester City', 'leicester-city', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Middlesbrough', 'middlesbrough', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Preston North End', 'preston-north-end', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Sheffield United', 'sheffield-united', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'West Bromwich Albion', 'west-bromwich-albion', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Wrexham', 'wrexham', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Birmingham', 'birmingham', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'inglaterra' and l.slug = 'championship' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Hannover 96', 'hannover-96', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'alemania' and l.slug = 'bundesliga-2' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'FC Nurnberg', 'fc-nurnberg', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'alemania' and l.slug = 'bundesliga-2' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Schalke 04', 'schalke-04', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'alemania' and l.slug = 'bundesliga-2' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Fortuna Dusseldorf', 'fortuna-dusseldorf', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'alemania' and l.slug = 'bundesliga-2' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Saint-Etienne', 'saint-etienne', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'francia' and l.slug = 'ligue-2' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Palermo', 'palermo', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'italia' and l.slug = 'serie-b' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Ajax', 'ajax', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'paises-bajos' and l.slug = 'eredivisie' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Feyenoord', 'feyenoord', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'paises-bajos' and l.slug = 'eredivisie' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'PSV Eindhoven', 'psv-eindhoven', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'paises-bajos' and l.slug = 'eredivisie' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Bahia', 'bahia', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Botafogo', 'botafogo', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Chapecoense', 'chapecoense', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Corinthians', 'corinthians', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Coritiba', 'coritiba', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Cruzeiro', 'cruzeiro', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Flamengo', 'flamengo', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Fluminense', 'fluminense', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Gremio', 'gremio', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Internacional', 'internacional', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Atletico Mineiro', 'atletico-mineiro', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Nautico', 'nautico', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Palmeiras', 'palmeiras', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Paranaense', 'paranaense', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Sport Recife', 'sport-recife', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Remo', 'remo', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Santos', 'santos', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Sao Paulo', 'sao-paulo', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Vasco da Gama', 'vasco-da-gama', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'brasil' and l.slug = 'serie-a-brasil' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Club America', 'club-america', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Atlas FC', 'atlas-fc', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Atlante', 'atlante', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Chivas Guadalajara', 'chivas-guadalajara', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Cruz Azul', 'cruz-azul', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'FC Monterrey', 'fc-monterrey', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Pumas UNAM', 'pumas-unam', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Santos Laguna', 'santos-laguna', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Tigres UANL', 'tigres-uanl', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Tijuana', 'tijuana', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Toluca', 'toluca', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'mexico' and l.slug = 'liga-mx' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Argentinos Juniors', 'argentinos-juniors', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'argentina' and l.slug = 'liga-profesional' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Boca Juniors', 'boca-juniors', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'argentina' and l.slug = 'liga-profesional' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Estudiantes LP', 'estudiantes-lp', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'argentina' and l.slug = 'liga-profesional' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Racing Avellaneda', 'racing-avellaneda', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'argentina' and l.slug = 'liga-profesional' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'River Plate', 'river-plate', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'argentina' and l.slug = 'liga-profesional' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Velez Sarsfield', 'velez-sarsfield', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'argentina' and l.slug = 'liga-profesional' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Old Boys', 'old-boys', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'argentina' and l.slug = 'liga-profesional' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Nacional', 'nacional', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'uruguay' and l.slug = 'primera-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Montevideo City Torque', 'montevideo-city-torque', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'uruguay' and l.slug = 'primera-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'PENAROL', 'penarol', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'uruguay' and l.slug = 'primera-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Colo Colo', 'colo-colo', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'chile' and l.slug = 'primera-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Universidad Catolica', 'universidad-catolica', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'chile' and l.slug = 'primera-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Universidad de Chile', 'universidad-de-chile', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'chile' and l.slug = 'primera-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'America de Cali', 'america-de-cali', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'colombia' and l.slug = 'categoria-primera-a' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Millonarios', 'millonarios', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'colombia' and l.slug = 'categoria-primera-a' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Atletico Nacional', 'atletico-nacional', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'colombia' and l.slug = 'categoria-primera-a' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Cerro Porteno', 'cerro-porteno', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'paraguay' and l.slug = 'primera-division' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Avispa Fukuoka', 'avispa-fukuoka', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Cerezo Osaka', 'cerezo-osaka', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'FC Tokyo', 'fc-tokyo', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Gamba Osaka', 'gamba-osaka', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Kashima Antlers', 'kashima-antlers', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Kashiwa Reysol', 'kashiwa-reysol', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Kawasaki Frontale', 'kawasaki-frontale', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Kyoto Sanga', 'kyoto-sanga', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Nagoya Grampus', 'nagoya-grampus', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Sanfrecce Hiroshima', 'sanfrecce-hiroshima', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Vissel Kobe', 'vissel-kobe', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Yokohama F. Marinos', 'yokohama-f-marinos', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'japon' and l.slug = 'j-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Rosenborg', 'rosenborg', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'noruega' and l.slug = 'eliteserien' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'FK Bodo/Glimt', 'fk-bodo-glimt', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'noruega' and l.slug = 'eliteserien' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Olympiacos', 'olympiacos', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'grecia' and l.slug = 'super-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Panathinaikos', 'panathinaikos', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'grecia' and l.slug = 'super-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Olimpia', 'olimpia', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'grecia' and l.slug = 'super-league' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Celtic FC', 'celtic-fc', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'scotland' and l.slug = 'scottish-premiership' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Rangers FC', 'rangers-fc', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'scotland' and l.slug = 'scottish-premiership' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Heart of Midlothian', 'heart-of-midlothian', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'scotland' and l.slug = 'scottish-premiership' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Dundee United', 'dundee-united', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'scotland' and l.slug = 'scottish-premiership' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Red Star Belgrade', 'red-star-belgrade', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'serbia' and l.slug = 'serbian-superliga' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'New York City FC', 'new-york-city-fc', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'estados-unidos' and l.slug = 'mls' on conflict (league_id, slug) do nothing;
insert into teams (name, slug, league_id) select 'Inter Miami CF', 'inter-miami-cf', l.id from leagues l join regions r on r.id = l.region_id where r.slug = 'estados-unidos' and l.slug = 'mls' on conflict (league_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Vincular productos -> equipo
-- ---------------------------------------------------------------------------
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'ac-milan' and p.slug in ('camiseta-ac-milan-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'arsenal' and p.slug in ('camiseta-arsenal-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'as-monaco' and p.slug in ('camiseta-as-monaco-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'as-roma' and p.slug in ('camiseta-as-roma-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'aston-villa' and p.slug in ('camiseta-aston-villa-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'atalanta' and p.slug in ('camiseta-atalanta-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'bayer-leverkusen' and p.slug in ('camiseta-leverkusen-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'borussia-monchengladbach' and p.slug in ('camiseta-borussia-monchengladbach-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'brentford' and p.slug in ('camiseta-brentford-2026', 'camiseta-brentford-2026-1');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'brighton' and p.slug in ('camiseta-brighton-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'ca-osasuna' and p.slug in ('camiseta-osasuna-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'chelsea' and p.slug in ('camiseta-chelsea-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'como' and p.slug in ('camiseta-como-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'eintracht-frankfurt' and p.slug in ('camiseta-frankfurt-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'elche-cf' and p.slug in ('camiseta-elche-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'estrasburgo' and p.slug in ('camiseta-strasbourg-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'everton' and p.slug in ('camiseta-everton-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'fc-barcelona' and p.slug in ('player-version-camiseta-fcb-2026', 'camiseta-fcb-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'fc-colonia' and p.slug in ('camiseta-koln-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'fc-porto' and p.slug in ('camiseta-oporto-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'fiorentina' and p.slug in ('camiseta-fiorentina-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'fulham' and p.slug in ('camiseta-fulham-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'getafe-cf' and p.slug in ('camiseta-getafe-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'hamburgo' and p.slug in ('camiseta-hamburgo-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'juventus' and p.slug in ('camiseta-juventus-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'lazio' and p.slug in ('camiseta-lazio-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'leeds-united' and p.slug in ('camiseta-leeds-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'levante-ud' and p.slug in ('camiseta-ud-levante-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'losc-lille' and p.slug in ('camiseta-lille-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'manchester-city' and p.slug in ('camiseta-manchester-city-2026', 'camiseta-manchester-city-2026-1');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'napoli' and p.slug in ('camiseta-napoles-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'newcastle-united' and p.slug in ('camiseta-newcastle-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'nottingham-forest' and p.slug in ('camiseta-nottingham-forest-2026', 'camiseta-reds-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'paris-saint-germain' and p.slug in ('camiseta-paris-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'parma' and p.slug in ('camiseta-parma-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'rayo-vallecano' and p.slug in ('camiseta-rayo-vallecano-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'rc-lens' and p.slug in ('camiseta-lens-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'rcd-espanyol' and p.slug in ('camiseta-espanyol-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'rcd-mallorca' and p.slug in ('camiseta-mallorca-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'real-betis' and p.slug in ('conjunto-deportivo-betis-2026', 'camiseta-betis-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'real-madrid' and p.slug in ('player-version-real-madrid-2026', 'camiseta-real-madrid-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'real-oviedo' and p.slug in ('camiseta-oviedo-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'real-sociedad' and p.slug in ('camiseta-sociedad-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'sc-freiburg' and p.slug in ('camiseta-freiburg-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'sevilla-fc' and p.slug in ('camiseta-sevilla-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'sl-benfica' and p.slug in ('camiseta-benfica-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'stade-rennais' and p.slug in ('camiseta-rennais-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'sunderland' and p.slug in ('camiseta-sunderland-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'tottenham-hotspur' and p.slug in ('camiseta-tottenham-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'toulouse' and p.slug in ('camiseta-toulouse-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'union-berlin' and p.slug in ('camiseta-union-berlin-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'valencia-cf' and p.slug in ('camiseta-valencia-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'vfb-stuttgart' and p.slug in ('camiseta-stuttgart-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'villarreal-cf' and p.slug in ('camiseta-villarreal-cf-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'werder-bremen' and p.slug in ('camiseta-werder-bremen-2026');
update products p set team_id = t.id
  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id
  where t.slug = 'wolverhampton' and p.slug in ('camiseta-wolverhampton-2026');

commit;

-- Verificacion: debe devolver 286 (o el total de productos de equipaciones).
select count(*) as productos_sin_equipo from products where team_id is null;
