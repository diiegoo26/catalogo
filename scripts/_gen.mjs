import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: products } = await sb.from('products').select('id,title,slug');
const { data: teams } = await sb.from('teams').select('name,slug,leagues(slug,regions(slug))');
const { data: leagues } = await sb.from('leagues').select('slug,regions(slug)');

const deacc = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const STOP = new Set(['de','del','la','el','los','las','fc','cd','ud','cf','ac','as','sc','ca','rc','sv','sd','club','atletico','athletic','city','united','sports','1','a','al','the']);
const norm = (s) => deacc(s.toLowerCase()).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter((w)=>w&&!STOP.has(w)).join('');

function extract(title) {
  let t = deacc(title).replace(/\d{4}/g, ' ');
  for (let i = 0; i < 3; i++) t = t.replace(/\b(camiseta|conjunto deportivo|player|versi.n|jersey|playera)\b/gi, ' ');
  return t.split(/\s+/).filter((w) => w && !/^n[io@ñ]{0,2}$/i.test(w) && !/^(infantil|junior)$/i.test(w)).join(' ').trim();
}

const slugify = (s) => deacc(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

// ---------- 1. ALIAS: nombre coloquial -> slug de equipo existente ----------
const ALIAS = {
  'ac milan':'ac-milan','as monaco':'as-monaco','as roma':'as-roma','arsenal':'arsenal',
  'aston villa':'aston-villa','atalanta':'atalanta','atletico madrid':'atletico-de-madrid',
  'borussia monchengladbach':'borussia-monchengladbach','brentford':'brentford','brighton':'brighton',
  'chelsea':'chelsea','como':'como','everton':'everton','fcb':'fc-barcelona','fulham':'fulham',
  'getafe':'getafe-cf','girona':'girona-fc','hoffenheim':'hoffenheim','juventus':'juventus',
  'lazio':'lazio','leeds':'leeds-united','lens':'rc-lens','levante':'levante-ud',
  'leverkusen':'bayer-leverkusen','lille':'losc-lille','manchester city':'manchester-city',
  'nantes':'fc-nantes','napoles':'napoli','newcastle':'newcastle-united','nottingham forest':'nottingham-forest',
  'o. lyon':'olympique-de-lyon','o. marsella':'olympique-de-marsella','osasuna':'ca-osasuna',
  'oviedo':'real-oviedo','parma':'parma','paris':'paris-saint-germain','rb leipzig':'rb-leipzig',
  'rayo vallecano':'rayo-vallecano','real madrid':'real-madrid','rennais':'stade-rennais',
  'sevilla':'sevilla-fc','sociedad':'real-sociedad','strasbourg':'estrasburgo','toulouse':'toulouse',
  'tottenham':'tottenham-hotspur','union berlin':'union-berlin','valencia':'valencia-cf',
  'villarreal':'villarreal-cf','villarreal cf':'villarreal-cf','werder bremen':'werder-bremen',
  'west ham':'west-ham-united','wolverhampton':'wolverhampton','inter milan':'inter-de-milan',
  'freiburg':'sc-freiburg','frankfurt':'eintracht-frankfurt','stuttgart':'vfb-stuttgart',
  'napoli':'napoli','bologna':'bologna','hamburgo':'hamburgo','betis':'real-betis','burnley':'burnley',
  'b. dort.':'borussia-dortmund','athletic bilbao':'athletic-club','atletic bilbao':'athletic-club',
  'espanyol':'rcd-espanyol','mallorca':'rcd-mallorca','elche':'elche-cf','oporto':'fc-porto',
  'benfica':'sl-benfica','sporting braga':'sc-braga','sporting lisboa':'sporting-cp',
  'koln':'fc-colonia','fc koln':'fc-colonia','monaco':'as-monaco','malaga cf':null,
  'die roten':'bayern-de-munich','red devils':'manchester-united','red devil':'manchester-united',
  'hercules':'heracles-almelo',
};

// ---------- 2. NUEVOS equipos: nombre -> [region, liga] ----------
const NEW = {
  espana:['segunda-division',['Almeria','Albacete','Burgos','Cadiz','Cordoba','Cultural Leonesa','Granada','Las Palmas','Leganes','Malaga','Racing Santander','Sporting Gijon','Valladolid','Zaragoza']],
  inglaterra:['championship',['Birmingham City','Blackburn Rovers','Bradford City','Cardiff City','Coventry City','Derby County','Doncaster Rovers','Hull City','Ipswich Town','Leicester City','Middlesbrough','Preston North End','Sheffield United','West Bromwich Albion','Wrexham','Birmingham']],
  alemania:['bundesliga-2',['Hannover 96','FC Nurnberg','Schalke 04','Fortuna Dusseldorf']],
  francia:['ligue-2',['Saint-Etienne']],
  italia:['serie-b',['Palermo']],
  'paises-bajos':['eredivisie',['Ajax','Feyenoord','PSV Eindhoven']],
  brasil:['serie-a-brasil',['Bahia','Botafogo','Chapecoense','Corinthians','Coritiba','Cruzeiro','Flamengo','Fluminense','Gremio','Internacional','Atletico Mineiro','Nautico','Palmeiras','Paranaense','Sport Recife','Remo','Santos','Sao Paulo','Vasco da Gama']],
  mexico:['liga-mx',['Club America','Atlas FC','Atlante','Chivas Guadalajara','Cruz Azul','FC Monterrey','Pumas UNAM','Santos Laguna','Tigres UANL','Tijuana','Toluca']],
  argentina:['liga-profesional',['Argentinos Juniors','Boca Juniors','Estudiantes LP','Racing Avellaneda','River Plate','Velez Sarsfield','Old Boys']],
  uruguay:['primera-division',['Nacional','Montevideo City Torque','PENAROL']],
  chile:['primera-division',['Colo Colo','Universidad Catolica','Universidad de Chile']],
  colombia:['categoria-primera-a',['America de Cali','Millonarios','Atletico Nacional']],
  paraguay:['primera-division',['Cerro Porteno']],
  japon:['j-league',['Avispa Fukuoka','Cerezo Osaka','FC Tokyo','Gamba Osaka','Kashima Antlers','Kashiwa Reysol','Kawasaki Frontale','Kyoto Sanga','Nagoya Grampus','Sanfrecce Hiroshima','Vissel Kobe','Yokohama F. Marinos']],
  noruega:['eliteserien',['Rosenborg','FK Bodo/Glimt']],
  grecia:['super-league',['Olympiacos','Panathinaikos','Olimpia']],
  scotland:['scottish-premiership',['Celtic FC','Rangers FC','Heart of Midlothian','Dundee United']],
  serbia:['serbian-superliga',['Red Star Belgrade']],
  'estados-unidos':['mls',['New York City FC','Inter Miami CF']],
};

// ---------- 3. AMBIGUOS: NO se asignan automaticamente ----------
const AMBIGUOUS = {
  'reds':'Nottingham Forest? Liverpool? (sin decidir)',
  'santa cruz':'Bolivia o Brasil (sin decidir)',
  'nueva incorporacion':'no es un equipo, titulo interno',
  'middlesbrough':'revisa: Championship英Midlesbrough',
};
// mapazos puntuales de la lista ambigua -> equipo existente
const AMBIG_FIX = { reds:'nottingham-forest' };

// ---------- resolver ----------
const existingBySlug = new Map(teams.map((t) => [t.slug, t]));
const newTeams = [];
for (const [region, [league, names]] of Object.entries(NEW))
  for (const name of names) newTeams.push({ name, slug: slugify(name), league, region });

const targets = new Map();
for (const t of newTeams) {
  if (existingBySlug.has(t.slug)) { console.log(`AVISO slug duplicado ignorado: ${t.slug}`); continue; }
  if (targets.has(t.slug)) { console.log(`AVISO slug duplicado en NEW: ${t.slug}`); continue; }
  targets.set(t.slug, t);
}

const rows = [], unassigned = [];
for (const p of products) {
  const base = extract(p.title);
  const k = norm(base);
  if (AMBIG_FIX[k]) { rows.push({ slug: p.slug, team: AMBIG_FIX[k] }); continue; }
  if (AMBIGUOUS[k]) { unassigned.push({ title: p.title, note: AMBIGUOUS[k] }); continue; }
  if (ALIAS[k] === null) { unassigned.push({ title: p.title, note: 'alias explicito a null' }); continue; }
  if (ALIAS[k] && existingBySlug.has(ALIAS[k])) { rows.push({ slug: p.slug, team: ALIAS[k] }); continue; }
  if (existingBySlug.has(slugify(base))) { rows.push({ slug: p.slug, team: slugify(base) }); continue; }
  unassigned.push({ title: p.title, note: 'sin regla' });
}

const errs = rows.filter((r) => !existingBySlug.has(r.team) && !targets.has(r.team));
if (errs.length) { console.log('ERROR: destinos inexistentes', errs.slice(0,10)); process.exit(1); }

// ---------- generar SQL ----------
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const newRegions = [...new Set(newTeams.map((t) => t.region))].filter((r) => !leagues.some((l) => l.regions.slug === r));
const newLeagues = new Set(newTeams.map((t) => `${t.region}/${t.league}`));
const leaguesPresent = new Set(leagues.map((l) => `${l.regions.slug}/${l.slug}`));

const sql = [];
sql.push(`-- ============================================================================`);
sql.push(`-- KOVA catalogo · Relacionar productos (category equipaciones) con su equipo`);
sql.push(`-- Generado: mapeo de ${rows.length} productos a ${new Set(rows.map((r) => r.team)).size} equipos`);
sql.push(`--   ${rows.length - newTeams.length} productos -> equipos ya existentes`);
sql.push(`--   ${newTeams.length} equipos nuevos (${newRegions.length} regiones / ${newLeagues.size} ligas nuevas)`);
sql.push(`-- Ejecutar en el SQL Editor de Supabase (o psql) con rol de escritura.`);
sql.push(`-- Es idempotente: se puede volver a ejecutar sin duplicar.`);
sql.push(`-- ============================================================================`);
sql.push(`begin;`);
sql.push(``);
sql.push(`-- ---------------------------------------------------------------------------`);
sql.push(`-- 1. Regiones nuevas`);
sql.push(`-- ---------------------------------------------------------------------------`);
for (const r of newRegions) sql.push(`insert into regions (name, slug) values (${q(r)}, ${q(r)}) on conflict (slug) do nothing;`);
if (newRegions.length) sql.push(``);
sql.push(`-- ---------------------------------------------------------------------------`);
sql.push(`-- 2. Ligas nuevas`);
sql.push(`-- ---------------------------------------------------------------------------`);
for (const l of newLeagues) if (!leaguesPresent.has(l)) {
  const [r, lg] = l.split('/');
  sql.push(`insert into leagues (name, slug, region_id) select ${q(lg)}, ${q(lg)}, id from regions where slug = ${q(r)} on conflict (region_id, slug) do nothing;`);
}
sql.push(``);
sql.push(`-- ---------------------------------------------------------------------------`);
sql.push(`-- 3. Equipos nuevos`);
sql.push(`-- ---------------------------------------------------------------------------`);
for (const t of newTeams) {
  const line = `insert into teams (name, slug, league_id) select ${q(t.name)}, ${q(t.slug)}, l.id from leagues l join regions r on r.id = l.region_id where r.slug = ${q(t.region)} and l.slug = ${q(t.league)} on conflict (league_id, slug) do nothing;`;
  if (!targets.has(t.slug)) continue;
  sql.push(line);
}
sql.push(``);
sql.push(`-- ---------------------------------------------------------------------------`);
sql.push(`-- 4. Vincular productos -> equipo`);
sql.push(`-- ---------------------------------------------------------------------------`);
const byTeam = new Map();
for (const r of rows) { if (!byTeam.has(r.team)) byTeam.set(r.team, []); byTeam.get(r.team).push(r.slug); }
for (const [team, slugs] of [...byTeam].sort((a, b) => a[0].localeCompare(b[0]))) {
  const list = slugs.map(q).join(', ');
  sql.push(`update products p set team_id = t.id`);
  sql.push(`  from teams t join leagues l on l.id = t.league_id join regions r on r.id = l.region_id`);
  sql.push(`  where t.slug = ${q(team)} and p.slug in (${list});`);
}
sql.push(``);
sql.push(`commit;`);
sql.push(``);
sql.push(`-- Verificacion: debe devolver 286 (o el total de productos de equipaciones).`);
sql.push(`select count(*) as productos_sin_equipo from products where team_id is null;`);

writeFileSync('supabase/relacionar-equipaciones.sql', sql.join('\n') + '\n');

console.log(`\nOK  productos vinculados: ${rows.length}`);
console.log(`    equipos nuevos:        ${newTeams.length}`);
console.log(`    regiones nuevas:       ${newRegions.length}  (${newRegions.join(', ')})`);
console.log(`    ligas nuevas:          ${[...newLeagues].filter((l) => !leaguesPresent.has(l)).length}`);
console.log(`    SIN ASIGNAR:           ${unassigned.length}`);
for (const u of unassigned) console.log(`      - ${u.title}   [${u.note}]`);
console.log(`\nSQL escrito en supabase/relacionar-equipaciones.sql`);
