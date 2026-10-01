// scripts/retro/extract.mjs
// Extrae las equipaciones retro de la búsqueda "retro" del proveedor SoccerPlus
// (yupoo) y genera:
//   scripts/retro/out/manifest.json   (una entrada por producto)
//   scripts/retro/out/report.md       (informe para la puerta humana)
//   public/productos/retro/<slug>.webp (las portadas, 800x800)
//
// NO escribe en la base de datos. Reanudable: una portada ya descargada se salta.
//
// Uso:
//   node scripts/retro/extract.mjs            # las 5 páginas
//   node scripts/retro/extract.mjs --limit 5  # prueba con 5 álbumes
//
// Las fotos de yupoo exigen `Referer` del proveedor: sin él devuelven 567.

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import {
  limpiarTitulo, detectarTemporada, detectarKit, esNino, esTemporadaReciente,
  candidatosEquipo, renderTitulo, slugRetro, asignarSlugUnico, capitalizarNombre,
} from '../../lib/retro/naming.ts';
import { resolverEquipo } from '../../lib/retro/teams.ts';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) catalogo-retro-import';
const REFERER = 'https://soccerplus.x.yupoo.com/';
const PAGINAS = 5;
const POR_PAGINA = 120;
const BASE = 'https://soccerplus.x.yupoo.com';
const SEARCH = `${BASE}/search/album?uid=1&sort=&q=retro`;
const OUT = 'scripts/retro/out';
const IMG_DIR = 'public/productos/retro';

// OJO: el proveedor mezcla `.jpg`, `.jpeg` y `.png`. El plan original solo
// contemplaba `jpg|png` y descartaba en silencio ~8% de los álbumes
// (15/120 en la página 1); verificado contra la fuente viva: con `jpe?g` casan
// 120/120 en cada una de las 5 páginas, 600 en total.
const ALBUM = /class="album__main"\s+title="([^"]*)"\s+href="\/albums\/(\d+)\?uid=1"[\s\S]*?<img[^>]*src="https:\/\/photo\.yupoo\.com\/soccerplus\/([0-9a-f]+)\/(?:small|medium|big)\.(?:jpe?g|png)"[\s\S]*?album__photonumber">(\d+)</g;

const args = process.argv.slice(2);
const limite = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, referer: REFERER } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

// 1. Crawl
const albumes = [];
for (let page = 1; page <= PAGINAS; page++) {
  const html = await get(`${SEARCH}&page=${page}`);
  const encontrados = [...html.matchAll(ALBUM)].map((m) => ({
    title: m[1], albumId: m[2], hash: m[3], photos: Number(m[4]),
  }));
  if (encontrados.length !== POR_PAGINA) {
    throw new Error(`página ${page}: ${encontrados.length} álbumes, se esperaban ${POR_PAGINA}. Abortado.`);
  }
  albumes.push(...encontrados);
  await dormir(400);
}
console.log(`álbumes: ${albumes.length}`);

// 2. Resolver equipo + slug + título
const equipos = JSON.parse(readFileSync(`${OUT}/teams.json`, 'utf8'));
const usados = new Set();
const filas = [];
const sinEquipo = [];
const sinTemporada = [];
const colisiones = [];
const ilegibles = [];
let ninos = 0;
let recientes = 0;

for (const album of albumes) {
  const limpio = limpiarTitulo(album.title);
  if (esNino(limpio)) { ninos++; continue; }

  const temporada = detectarTemporada(limpio);

  // Un kit de la temporada en curso no es retro (y rompería el flujo de compra
  // y las páginas de equipo): se descarta, igual que los de niño.
  if (esTemporadaReciente(temporada)) { recientes++; continue; }

  const { kit, mangaLarga, versionJugador } = detectarKit(limpio);

  // Un título del que no sale ni año ni equipo no da un producto usable
  // (p. ej. el álbum-índice "Retro Jerseys/Retro").
  const candidatos = candidatosEquipo(limpio, temporada);
  if (!temporada && candidatos.length === 0) {
    ilegibles.push({ albumId: album.albumId, origen: album.title });
    continue;
  }

  let equipo = null;
  let candidato = null;
  for (const c of candidatos) {
    // Se recuerda el candidato más largo aunque no resuelva: es mejor nombre de
    // respaldo que el título limpio entero (que repite la temporada y deja el color).
    if (candidato === null) candidato = c;
    const r = resolverEquipo(c, equipos);
    if (r.estado === 'ok') { equipo = r.equipo; break; }
  }
  if (!equipo) sinEquipo.push({ albumId: album.albumId, origen: album.title, candidato });

  // Sin equipo resuelto se usa el candidato, sin los guiones con que el proveedor
  // ofusca el nombre ('Zara-goza' -> 'Zara goza') y capitalizado, porque si no el
  // título sale con el país en minúscula ('colombia' -> 'Colombia'). El álbum
  // queda igualmente listado en el informe.
  const respaldo = capitalizarNombre((candidato ?? limpio).replace(/-+/g, ' '));
  const nombreEquipo = equipo ? equipo.name : respaldo;
  const title = renderTitulo({ kit, equipo: nombreEquipo, temporada, mangaLarga, versionJugador });
  // Sin equipo, `slugRetro` cae al título. Se le quita el prefijo
  // "Equipación retro <kit> " para no repetirlo en el slug
  // ("retro-equipacion-retro-local-inter" -> "retro-inter").
  const tituloSlug = title.replace(/^Equipación retro \S+ /, '');
  const base = slugRetro({ equipoSlug: equipo ? equipo.slug : null, titulo: tituloSlug, temporada, kit });
  const slug = asignarSlugUnico(base, usados);
  if (slug !== base) colisiones.push({ slug, base, origen: album.title });
  if (!temporada) sinTemporada.push({ slug, title });

  filas.push({
    albumId: album.albumId, hash: album.hash, title, slug,
    team_id: equipo ? equipo.id : null, season: temporada,
    gender: 'unisex', image: `/productos/retro/${slug}.webp`,
    origen: album.title, photos: album.photos,
  });
}

// 3. Portadas
mkdirSync(IMG_DIR, { recursive: true });
mkdirSync(OUT, { recursive: true });
const fallos = [];
const aDescargar = filas.slice(0, limite === Infinity ? filas.length : limite);
for (const [i, fila] of aDescargar.entries()) {
  const destino = `${IMG_DIR}/${fila.slug}.webp`;
  if (existsSync(destino)) continue;
  const url = `https://photo.yupoo.com/soccerplus/${fila.hash}/big.jpg`;
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, referer: REFERER } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf).resize(800, 800, { fit: 'cover' }).webp({ quality: 82 }).toFile(destino);
  } catch (err) {
    fallos.push({ slug: fila.slug, url, error: String(err.message ?? err) });
  }
  if ((i + 1) % 25 === 0) console.log(`  portadas ${i + 1}/${aDescargar.length}`);
  await dormir(120);
}

// 4. Emitir (el manifest omite `hash`, que es solo de descarga)
const manifest = filas.map(({ hash, photos, ...resto }) => resto);
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));

const lineas = [
  '# Informe de extracción — Retro Equipaciones (SoccerPlus)',
  '',
  `- Álbumes vistos: **${albumes.length}**`,
  `- Descartados por ser de niño: **${ninos}**`,
  `- Descartados por ser de temporada reciente: **${recientes}**`,
  `- Descartados por ilegibles: **${ilegibles.length}**`,
  `- Productos en el manifest: **${filas.length}**`,
  `- Portadas descargadas ahora: **${aDescargar.length - fallos.length}** de ${aDescargar.length}`,
  `- Fallos de descarga: **${fallos.length}**`,
  '',
  `## Ilegibles: ni año ni equipo (${ilegibles.length})`,
  ...ilegibles.map((s) => `- ${s.origen}`),
  '',
  `## Sin equipo resuelto (${sinEquipo.length}) — team_id = NULL`,
  ...sinEquipo.map((s) => `- \`${s.candidato ?? '(nada)'}\` ← ${s.origen}`),
  '',
  `## Sin año (${sinTemporada.length}) — season = NULL`,
  ...sinTemporada.map((s) => `- ${s.title}`),
  '',
  `## Slugs desambiguados (${colisiones.length})`,
  ...colisiones.map((c) => `- \`${c.slug}\` ← ${c.origen}`),
  '',
  '## Fallos de descarga',
  ...fallos.map((f) => `- \`${f.slug}\`: ${f.error} — ${f.url}`),
  '',
];
writeFileSync(`${OUT}/report.md`, lineas.join('\n'));
console.log(`manifest: ${filas.length} productos | ilegibles: ${ilegibles.length} | sin equipo: ${sinEquipo.length} | fallos: ${fallos.length}`);
console.log(`descartados: niños ${ninos} | temporada reciente ${recientes}`);