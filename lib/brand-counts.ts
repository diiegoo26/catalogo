import type { BrandWithCount } from './types';

/** Fila cruda de PostgREST. `total:products(count)` llega como array de un objeto;
 * `inner_products` es el join `products!inner(category_id)`, con una entrada por
 * producto coincidente. */
export type RawBrandRow = {
  id: string; name: string; slug: string; logo_url: string | null;
  total?: { count: number }[] | null;
  inner_products?: unknown[] | null;
};

/** Normaliza el payload del join `!inner` a la forma del agregado `total`, para que
 * produccion y tests recorran exactamente la misma rama de conteo. */
export function withInnerProductTotals(rows: RawBrandRow[]): RawBrandRow[] {
  return rows.map((r) => ({ ...r, total: [{ count: r.inner_products?.length ?? 0 }] }));
}

/** Descarta las marcas sin productos y expone el total como numero plano. */
export function withCounts(rows: RawBrandRow[]): BrandWithCount[] {
  return rows
    .map((r) => ({
      id: r.id, name: r.name, slug: r.slug, logo_url: r.logo_url,
      product_count: r.total?.[0]?.count ?? 0,
    }))
    .filter((b) => b.product_count > 0);
}
