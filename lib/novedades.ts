/** Producto con la categoría a la que pertenece, para poder repartirlo. */
export type ConCategoria = { category_id: string | null };

/** Los category_id son UUID: cualquier texto que no lo sea sirve de centinela. */
const SIN_CATEGORIA = 'sin-categoria';

/**
 * Reparte los productos de la portada para que no los copen todos la misma
 * categoría. La entrada llega del más nuevo al más viejo y el reparto va por
 * rondas: la primera vuelta pone una categoría distinta en cada hueco y solo la
 * segunda empieza a repetir. Así ocho camisetas subidas de golpe no tapan el
 * resto del catálogo.
 *
 * Dentro de cada categoría se conserva el orden de llegada (lo más nuevo primero).
 */
export function diversificarPorCategoria<T extends ConCategoria>(
  productos: T[],
  { porCategoria = 2, max = 8 }: { porCategoria?: number; max?: number } = {}
): T[] {
  const grupos = new Map<string, T[]>();
  for (const producto of productos) {
    const clave = producto.category_id ?? SIN_CATEGORIA;
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(producto);
    else grupos.set(clave, [producto]);
  }

  const elegidos: T[] = [];
  for (let ronda = 0; ronda < porCategoria; ronda++) {
    for (const grupo of grupos.values()) {
      if (elegidos.length >= max) return elegidos;
      const producto = grupo[ronda];
      if (producto) elegidos.push(producto);
    }
  }
  return elegidos;
}
