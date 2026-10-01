// lib/tallas.ts
// 'calzado' se renombró a 'sneakers' en la reclasificación de 2026-09.
const CALZADO = new Set(['sneakers', 'chanclas']);
const UNICA = new Set([
  'accesorios', 'relojes', 'gorras', 'bolsos', 'perfumes',
  'auriculares', 'altavoces', 'cuidado-personal', 'mandos', 'packs',
]);

/**
 * Prendas sin talla de ropa que, tras la reclasificación de 2026-09, caen en
 * una categoría con tallas (p. ej. las gorras viven en `streetwear`). El nombre
 * del producto es lo único que las distingue a nivel de ficha. Se exige que la
 * palabra sea completa para no confundir "Whitecaps" (Vancouver) con una gorra.
 */
const TALLA_UNICA_POR_TITULO = /\b(gorras?|gorros?|sombreros?|buckets?|caps?)\b/i;

export const TALLAS_ROPA = [
  '18-24M', '2-3A', '4-5A', '6-7A', '8-9A', '10-11A', '12-13A',
  'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL',
];
export const TALLAS_CALZADO = Array.from({ length: 16 }, (_, i) => String(i + 32)); // 32–47

/** Size options offered on a product page, chosen by the category slug. */
export function tallasParaCategoria(slug: string): string[] {
  if (CALZADO.has(slug)) return TALLAS_CALZADO;
  if (UNICA.has(slug)) return ['Única'];
  return TALLAS_ROPA;
}

/**
 * Size options for a concrete product: the product's own name can override the
 * category rule (a cap inside `streetwear` is still one-size).
 */
export function tallasParaProducto(slug: string, titulo: string): string[] {
  if (TALLA_UNICA_POR_TITULO.test(titulo)) return ['Única'];
  return tallasParaCategoria(slug);
}
