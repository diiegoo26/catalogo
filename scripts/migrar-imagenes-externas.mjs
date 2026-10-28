// Mirrors every remote photo in `products.images` into public/externos/.
//
// The live site used to render those photos straight from Google Drive / FootyLogos /
// Wix through /_next/image. When Vercel's Image Optimization quota ran out every
// remote thumbnail became an HTTP 402, so the catalog now serves local copies.
//
// The local file name is hashExterno(url), the exact same function the render path
// uses (lib/externos.ts). That coupling is the contract: if the two ever disagree,
// every <Image> points at a file that does not exist.
//
// Idempotent on purpose. A full run is ~166 MB over flaky third-party CDNs, so a
// timeout or Ctrl-C must be resumable: files already on disk with data are skipped.
//
// Run: node scripts/migrar-imagenes-externas.mjs
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { hashExterno } from '../lib/externos.ts';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DESTINO = join(RAIZ, 'public', 'externos');
const CONCURRENCIA = 8;
const INTENTOS = 3;
const TIMEOUT_MS = 30_000;
const PAGINA = 1000;

// Browser-ish headers: Google Drive and Wix answer 403 to bare server requests.
const CABECERAS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://kova-zone.vercel.app/',
  Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
};

function leerEnv() {
  const texto = readFileSync(join(RAIZ, '.env.local'), 'utf8');
  const env = {};
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte === -1) continue;
    const clave = limpia.slice(0, corte).replace(/^export\s+/, '').trim();
    const valor = limpia.slice(corte + 1).trim().replace(/^['"]|['"]$/g, '');
    env[clave] = valor;
  }
  for (const clave of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    if (!env[clave]) throw new Error(`missing ${clave} in .env.local`);
  }
  return env;
}

async function traerUrls(env) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cabeceras = { apikey: key, Authorization: `Bearer ${key}` };

  const urls = new Set();
  let offset = 0;
  for (;;) {
    const url = `${base}/rest/v1/products?select=id,slug,images&order=id&limit=${PAGINA}&offset=${offset}`;
    const res = await fetch(url, { headers: cabeceras });
    if (!res.ok) throw new Error(`Supabase responded ${res.status} at offset ${offset}`);
    const filas = await res.json();
    for (const fila of filas) {
      for (const imagen of fila.images ?? []) {
        if (typeof imagen === 'string' && /^https?:\/\//i.test(imagen)) urls.add(imagen);
      }
    }
    if (filas.length < PAGINA) break;
    offset += PAGINA;
  }
  return [...urls];
}

async function descargar(url) {
  let ultimoError;
  for (let intento = 1; intento <= INTENTOS; intento += 1) {
    try {
      const res = await fetch(url, { headers: CABECERAS, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) throw new Error('empty response');
      return buffer;
    } catch (error) {
      ultimoError = error;
      if (intento < INTENTOS) await new Promise((listo) => setTimeout(listo, 500 * intento));
    }
  }
  throw ultimoError;
}

async function bajarUna({ url, destino }) {
  const buffer = await descargar(url);
  // Sharp strips metadata (EXIF/ICC) unless asked not to, which is what we want:
  // these are catalog thumbnails, not archival masters.
  const temporal = `${destino}.tmp`;
  try {
    await sharp(buffer)
      .resize({ width: 1000, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(temporal);
    renameSync(temporal, destino);
  } catch (error) {
    // Never leave a half-written .tmp (or a truncated .webp) behind: the resume
    // check treats any non-empty file as done.
    rmSync(temporal, { force: true });
    throw error;
  }
}

const env = leerEnv();
const urls = await traerUrls(env);
console.log(`unique remote URLs: ${urls.length}`);

mkdirSync(DESTINO, { recursive: true });

const trabajos = urls.map((url) => ({ url, destino: join(DESTINO, `${hashExterno(url)}.webp`) }));

// A collision would silently overwrite one photo with another, and the render
// side has no way to notice. Abort before touching the disk.
const porHash = new Map();
const colisiones = [];
for (const trabajo of trabajos) {
  const id = trabajo.destino.slice(DESTINO.length + 1);
  const previa = porHash.get(id);
  if (previa && previa !== trabajo.url) colisiones.push({ id, a: previa, b: trabajo.url });
  else porHash.set(id, trabajo.url);
}
if (colisiones.length) {
  console.error(`hash collisions: ${colisiones.length}`);
  for (const c of colisiones) console.error(`  ${c.id}\n    ${c.a}\n    ${c.b}`);
  process.exitCode = 1;
  throw new Error('aborting: hash collisions would overwrite files');
}

let descargadas = 0;
let salteadas = 0;
let procesadas = 0;
const fallidas = [];

let cursor = 0;
async function trabajador() {
  for (;;) {
    const indice = cursor;
    cursor += 1;
    if (indice >= trabajos.length) return;

    const trabajo = trabajos[indice];
    const yaEsta = existsSync(trabajo.destino) && statSync(trabajo.destino).size > 0;
    if (yaEsta) {
      salteadas += 1;
    } else {
      try {
        await bajarUna(trabajo);
        descargadas += 1;
      } catch (error) {
        fallidas.push({ url: trabajo.url, motivo: error?.message ?? String(error) });
      }
    }

    procesadas += 1;
    if (procesadas % 25 === 0 || procesadas === trabajos.length) {
      console.log(`  ${procesadas}/${trabajos.length} (downloaded ${descargadas}, skipped ${salteadas}, failed ${fallidas.length})`);
    }
  }
}

await Promise.all(
  Array.from({ length: Math.min(CONCURRENCIA, trabajos.length) }, () => trabajador()),
);

console.log('');
console.log(`unique URLs: ${trabajos.length}`);
console.log(`downloaded:  ${descargadas}`);
console.log(`skipped:     ${salteadas}`);
console.log(`failed:      ${fallidas.length}`);
if (fallidas.length) {
  console.log('');
  console.log('failed URLs:');
  for (const fallo of fallidas) console.log(`  ${fallo.url} -> ${fallo.motivo}`);
  process.exitCode = 1;
}
