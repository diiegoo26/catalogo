// scripts/retro/check-images.mjs
// Comprueba el manifest contra el disco: slug único, portada presente, ruta
// coherente y — importante — que no queden portadas huérfanas de pasadas
// anteriores (el extractor es resumable y no borra las de slugs obsoletos).
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('scripts/retro/out/manifest.json', 'utf8'));
const vistos = new Set();
let fallos = 0;

for (const m of manifest) {
  if (vistos.has(m.slug)) { console.log(`FAIL slug duplicado: ${m.slug}`); fallos++; }
  vistos.add(m.slug);

  if (!m.image.startsWith('/productos/retro/') || !m.image.endsWith('.webp')) {
    console.log(`FAIL ruta rara: ${m.slug} -> ${m.image}`); fallos++;
  }
  const disco = m.image.replace(/^\//, 'public/');
  if (!existsSync(disco)) { console.log(`FAIL falta la portada: ${disco}`); fallos++; }

  if (!m.title.startsWith('Equipación retro ')) {
    console.log(`FAIL título inesperado: ${m.title}`); fallos++;
  }
}

const DIR = 'public/productos/retro';
const esperadas = new Set(manifest.map((m) => m.image.split('/').pop()));
for (const archivo of readdirSync(DIR).filter((f) => f.endsWith('.webp'))) {
  if (!esperadas.has(archivo)) { console.log(`FAIL portada huérfana: ${archivo}`); fallos++; }
}

console.log(`${fallos === 0 ? 'PASS' : 'FAIL'} — ${manifest.length} productos, ${fallos} fallos`);
process.exit(fallos === 0 ? 0 : 1);
