// lib/externos.ts
// Las fotos del catálogo viven en hosts externos (Google Drive, FootyLogos, Wix).
// Se descargan una vez a `public/externos/` con scripts/migrar-imagenes-externas.mjs,
// así que el sitio dejó de depender de que esos hosts sigan sirviendo el archivo.
//
// El nombre local NO puede salir de la ruta original: cada host usa rutas
// distintas y algunas traen query strings. Se deriva del hash de la URL completa,
// que es lo único estable entre la migración y el render.
//
// Este módulo lo importan componentes de servidor y de cliente, así que es JS puro:
// nada de `node:crypto`, nada de `fs`. `TextEncoder` es global en Node y en el
// navegador, y `Math.imul` evita el redondeo de la multiplicación en coma flotante.

// Tres bases distintas de FNV-1a. Con una sola base, dos URLs que difieran en los
// últimos bytes podían compartir hash con más facilidad; concatenar tres salidas
// de 32 bits da 96 bits (24 hex) y margen de sobra para unas pocas miles de fotos.
const BASES = [0x811c9dc5, 0x01000193, 0x7f4a7c15] as const;
const PRIMO_FNV = 0x01000193;

function fnv1a(bytes: Uint8Array, base: number): number {
  let hash = base >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    // `Math.imul` replica la multiplicación de 32 bits con desbordamiento, que es
    // lo que define FNV-1a. Con `hash * PRIMO` se perderían bits y el resultado
    // dependería de la precisión del motor.
    hash = Math.imul(hash, PRIMO_FNV) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Identificador determinístico de una URL remota.
 *
 * El script de migración y el render tienen que llegar SIEMPRE al mismo nombre de
 * archivo. Por eso el algoritmo es FNV-1a sobre los bytes UTF-8 de la URL, sin
 * normalizar ni recortar nada: dos cadenas distintas (un `?w=800` de más, una
 * barra final) son dos fotos distintas.
 */
export function hashExterno(url: string): string {
  const bytes = new TextEncoder().encode(url);
  return BASES.map((base) => fnv1a(bytes, base).toString(16).padStart(8, '0')).join('');
}

/**
 * Traduce una URL remota a su copia local en `public/externos/`.
 *
 * Ojo con el orden: esto se aplica al pasar la imagen a `<Image src=…>`, NUNCA
 * sobre el array de `products.images` que después consume `groupKitsByVariant()`
 * (lib/kits.ts). Esa función deduce la variante (local/visitante/tercera) del
 * nombre del archivo remoto; si le llega `/externos/<hash>.webp` ya no reconoce
 * nada y el selector de variantes desaparece.
 *
 * Las rutas que ya son locales (`/productos/…`, `/logo.png`) o cualquier valor
 * no-HTTP se devuelven intactas: no todas las imágenes de la base se migraron
 * (los logos de equipos y las fotos de categoría siguen en su host).
 */
export function localizarImagen(src?: string | null): string | undefined {
  if (src === null || src === undefined) return undefined;
  if (src === '') return src;
  if (!/^https?:\/\//i.test(src)) return src;
  return `/externos/${hashExterno(src)}.webp`;
}
