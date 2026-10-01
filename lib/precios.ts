// Precios del catálogo.
//
// Precedencia (primero que gana):
//   1. products.price      — precio propio del producto, si tiene valor
//   2. PRECIOS_POR_CATEGORIA — regla por categoría (sneakers)
//   3. null                — sin precio: se muestra "Precio a consultar"
//
// Las equipaciones no salen de aquí: su precio depende de la calidad elegida
// (Fans / Jugador), que es un eje independiente de la variante del kit.

/** Calidad de la equipación: la que lleva los jugadores es "jugador". */
export type Calidad = 'fans' | 'jugador';

export const PRECIO_FANS = 18;
export const PRECIO_JUGADOR = 25;

/** Categorías con precio fijo conocido. El resto se muestra "a consultar". */
export const PRECIOS_POR_CATEGORIA: Record<string, number> = {
  sneakers: 60,
};

const NUMERO = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const ETIQUETA_CONSULTAR = 'Precio a consultar';

/** Precio en euros, o null si hay que consultar. */
export function precioDe(categoria: string, price: number | null, calidad?: Calidad): number | null {
  // En equipaciones manda la calidad: el precio propio del producto no aplica,
  // porque el mismo kit se vende en Fans o en Jugador.
  if (categoria === 'equipaciones') {
    return calidad ? (calidad === 'fans' ? PRECIO_FANS : PRECIO_JUGADOR) : null;
  }
  if (typeof price === 'number' && Number.isFinite(price)) return price;
  return PRECIOS_POR_CATEGORIA[categoria] ?? null;
}

/** Texto listo para pintar: "60 €" o "Precio a consultar". */
export function etiquetaPrecio(precio: number | null): string {
  return precio === null ? ETIQUETA_CONSULTAR : NUMERO.format(precio);
}

/** Las dos calidades con su precio, para pintar el selector. */
export const CALIDADES: { id: Calidad; label: string; precio: number }[] = [
  { id: 'fans', label: 'Fans', precio: PRECIO_FANS },
  { id: 'jugador', label: 'Jugador', precio: PRECIO_JUGADOR },
];