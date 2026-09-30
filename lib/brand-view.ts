/** Regla de los tres casos: rejilla de marcas, cabecera directa, o listado plano. */
export type BrandViewMode = 'grid' | 'single' | 'none';

export function brandViewMode(count: number): BrandViewMode {
  if (count === 0) return 'none';
  if (count === 1) return 'single';
  return 'grid';
}
