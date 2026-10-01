// lib/retro/naming.ts
// Texto puro para el import de equipaciones retro de SoccerPlus (yupoo).
// Sin I/O y sin red: es la parte donde un error silencioso ensuciaría el catálogo.

export type Kit = 'local' | 'visitante' | 'tercera' | 'portero' | 'aniversario';

// Ruido del proveedor. Los títulos llegan con spam SEO en inglés repetido.
// Cada frase lleva `\b` final: sin él, `/retro jersey/` se come el `Jersey` de
// `Jerseys` y deja un `s/` suelto (álbum "Retro Jerseys/Retro").
const RUIDO = [
  /vintage football shirts?\b/gi,
  /retro soccer jerseys?\b/gi,
  /retro jerseys?\b/gi,
  /camiseta de f[uú]tbol\b/gi,
  /\bretro\b/gi,
  // El prefijo hay que quitarlo ANTES que la talla suelta: si no, `4XL` cae
  // primero y deja un `S` huérfano ("Bar 125th retro model S-4XL" -> "Bar 125th S").
  /\bs-[2-4]?x{1,2}l\b/gi,      // S-XXL, S-4XL, S-2XL, S-3XL
  /\b[2-4]?x{1,2}l\b/gi,        // XXL, 4XL…
  /\bsize\b/gi,
  /\bmodel\b/gi,
  /\bjersey\b/gi,
  /\bshirt\b/gi,
];

const COLORES = new Set([
  'blue', 'red', 'white', 'black', 'yellow', 'green', 'pink', 'orange',
  'grey', 'gray', 'purple', 'gold', 'silver',
]);

// Incluye las mismas palabras que limpia `limpiarTitulo`, para que la función
// dé el mismo resultado tanto sobre el título crudo como sobre el ya limpiado.
const CUALIFICADORES = new Set([
  'home', 'away', 'third', 'fourth', 'gk', 'goalkeeper', 'player', 'version',
  'long', 'sleeve', 'sleeves', 'casual', 'street', 'style', 'anniversary',
  '125th', '100', 'year', 'special', 'kit', 'kids', 'kid',
  'model', 'jersey', 'shirt', 'vintage', 'football', 'soccer', 'camiseta',
  'size', 'limited',
]);

/** Quita el spam SEO, los tallajes y colapsa el espaciado. */
export function limpiarTitulo(original: string): string {
  let out = ` ${original} `;
  for (const re of RUIDO) out = out.replace(re, ' ');
  // Ojo: los guiones NO se tocan. El separador de temporada ('05-06') y los
  // nombres ofuscados ('Cel-ta', 'M-U') dependen de ellos; `candidatosEquipo`
  // ya limpia los guiones por palabra.
  return out.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Los retro llegan hasta los 70-80, así que el corte del siglo no puede ser 90:
// con `>= 90` el álbum "86/87 Napoles home" salía como 2086-87.
// 30-99 => 19xx (1930-1999); 00-29 => 20xx (2000-2029).
function expandirAnio(dos: string): string {
  return Number(dos) >= 30 ? `19${dos}` : `20${dos}`;
}

/** '2002' | '2005-06' | '1997-99' | null */
export function detectarTemporada(texto: string): string | null {
  const cuatro = /\b((?:19|20)\d{2})\b/.exec(texto);
  if (cuatro) return cuatro[1];
  const par = /\b(\d{2})\s*[-\/]\s*(\d{2})\b/.exec(texto);
  if (par) return `${expandirAnio(par[1])}-${expandirAnio(par[2]).slice(2)}`;
  const corto = /^\s*(\d{2})\b/.exec(texto);
  if (corto) return expandirAnio(corto[1]);
  return null;
}

/** Kit y matices. Sin coincidencia explícita, 'local'. */
export function detectarKit(texto: string): { kit: Kit; mangaLarga: boolean; versionJugador: boolean } {
  const t = ` ${texto.toLowerCase()} `;
  let kit: Kit = 'local';
  if (/\baway\b/.test(t)) kit = 'visitante';
  else if (/\bthird\b/.test(t)) kit = 'tercera';
  else if (/\bgk\b|\bgoalkeeper\b/.test(t)) kit = 'portero';
  else if (/anniversary|\b125th\b|\b100 year\b/.test(t)) kit = 'aniversario';
  else if (/\bhome\b/.test(t)) kit = 'local';
  return {
    kit,
    mangaLarga: /long\s?sleeves?/.test(t),
    versionJugador: /\bplayer version\b/.test(t),
  };
}

/** Equipaciones de niño: fuera de alcance. */
export function esNino(texto: string): boolean {
  return /\b(kid|kids|youth|junior)\b|ni[ñn]o/i.test(texto);
}

// Temporada actual (2026-27) y la inmediatamente anterior (2025-26). Un kit de
// la temporada en curso no es un clásico: además de no serlo, su ficha tomaría
// el flujo KitCustomizer en vez de CompraEquipacion (esKitTemporada en
// app/producto/[slug]/page.tsx) y aparecería en las páginas de equipo, que
// filtran season = '2026-27'.
const TEMPORADAS_RECIENTES = /^(2025|2026)\b/;

/** true para la temporada actual o la anterior: no entran en la sección retro. */
export function esTemporadaReciente(temporada: string | null): boolean {
  return temporada !== null && TEMPORADAS_RECIENTES.test(temporada);
}

/** Candidatos a equipo, del más largo al más corto. NUNCA decide: solo propone. */
export function candidatosEquipo(texto: string, temporada: string | null): string[] {
  let t = ` ${texto} `;
  if (temporada) t = t.replace(temporada, ' ');
  t = t.replace(/^\s*\d{2}\b/, ' ');
  const palabras = t.trim().split(/\s+/);
  const utiles: string[] = [];
  for (const palabra of palabras) {
    const limpia = palabra.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (limpia.length < 2) continue;   // descarta restos de tallaje ('S') y ruido de 1 letra
    const baja = limpia.toLowerCase();
    if (CUALIFICADORES.has(baja) || COLORES.has(baja)) continue;
    if (/^\d+$/.test(limpia)) continue;
    utiles.push(limpia);
  }
  const out: string[] = [];
  for (let n = Math.min(3, utiles.length); n >= 1; n--) {
    out.push(utiles.slice(0, n).join(' '));
  }
  return out;
}

const LABEL_KIT: Record<Kit, string> = {
  local: 'local',
  visitante: 'visitante',
  tercera: 'tercera',
  portero: 'portero',
  aniversario: 'aniversario',
};

/** 'Equipación retro visitante Borussia Dortmund 2002 (manga larga)' */
export function renderTitulo(r: {
  kit: Kit; equipo: string; temporada: string | null;
  mangaLarga: boolean; versionJugador: boolean;
}): string {
  const partes = [`Equipación retro ${LABEL_KIT[r.kit]}`, r.equipo];
  if (r.temporada) partes.push(r.temporada);
  const sufijos: string[] = [];
  if (r.mangaLarga) sufijos.push('manga larga');
  if (r.versionJugador) sufijos.push('versión jugador');
  const base = partes.join(' ');
  return sufijos.length ? `${base} (${sufijos.join(', ')})` : base;
}

/** ASCII, minúsculas, guiones. 'Cádiz' -> 'cadiz'. */
export function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugRetro(r: {
  equipoSlug: string | null; titulo: string; temporada: string | null; kit: Kit;
}): string {
  const base = r.equipoSlug
    ? `retro-${r.equipoSlug}-${r.temporada ?? ''}-${r.kit}`
    : `retro-${slugify(r.titulo)}`;
  return base.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
}

/** `slug` es unique en la base de datos: desambigua con -2, -3… */
export function asignarSlugUnico(base: string, usados: Set<string>): string {
  if (!usados.has(base)) {
    usados.add(base);
    return base;
  }
  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  const slug = `${base}-${n}`;
  usados.add(slug);
  return slug;
}
