// lib/tallas.ts
const CALZADO = new Set(['calzado', 'chanclas']);
const UNICA = new Set(['accesorios', 'relojes', 'gorras', 'bolsos', 'perfumes']);

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
