// lib/media.ts
// Las fotos del catálogo de proveedor (/productos/…) son miniaturas de ~100px
// sobre fondo claro. Recortarlas con `object-cover` las amplía y las deja
// borrosas, así que las mostramos completas (`object-contain`) sobre un panel
// suave. El resto de fotos (equipaciones, etc.) siguen a sangre con `cover`.
export function isLocalCatalogImage(src?: string | null): boolean {
  return typeof src === 'string' && src.startsWith('/productos/');
}

// Hosts que rechazan al optimizador de next/image (403 sin User-Agent ni
// Referer de navegador) aunque el archivo sí se sirva a un navegador real.
const HOSTS_QUE_BLOQUEAN_AL_OPTIMIZADOR = new Set(['images.seeklogo.com']);

/**
 * ¿Hay que pedir esta imagen directo al navegador, sin pasar por el optimizador?
 *
 * Dos casos rompen la imagen por completo (`/_next/image` responde 400 y no se
 * ve nada):
 * - SVG: next/image solo los optimiza con `dangerouslyAllowSVG`. No lo activamos:
 *   el SVG se sirve tal cual y el navegador lo escala igual de bien.
 * - Hosts que bloquean las peticiones servidor-a-servidor del optimizador.
 *
 * Con `unoptimized` en `<Image>` el navegador pide el archivo original, que es
 * justo lo que sí funciona en ambos casos.
 */
export function needsDirectImage(src?: string | null): boolean {
  if (typeof src !== 'string' || !src) return false;
  if (/\.svg(?:[?#]|$)/i.test(src)) return true;
  try {
    return HOSTS_QUE_BLOQUEAN_AL_OPTIMIZADOR.has(new URL(src).hostname);
  } catch {
    return false;
  }
}
