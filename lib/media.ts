// lib/media.ts
// Las fotos del catálogo de proveedor (/productos/…) son miniaturas de ~100px
// sobre fondo claro. Recortarlas con `object-cover` las amplía y las deja
// borrosas, así que las mostramos completas (`object-contain`) sobre un panel
// suave. El resto de fotos (equipaciones, etc.) siguen a sangre con `cover`.
export function isLocalCatalogImage(src?: string | null): boolean {
  return typeof src === 'string' && src.startsWith('/productos/');
}
