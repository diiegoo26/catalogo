import { etiquetaPrecio, precioDe } from '@/lib/precios';

/**
 * Precio de la ficha de producto, para todo lo que no sea equipación.
 *
 * Las equipaciones no pasan por aquí: su precio depende de la calidad elegida
 * (Fans / Jugador), un selector con estado que vive en KitCustomizer porque es
 * quien construye la línea de la cesta.
 */
export default function PrecioProducto({
  categoria,
  precio,
}: {
  categoria: string;
  precio: number | null;
}) {
  const importe = precioDe(categoria, precio);

  if (importe === null) {
    return <p className="text-sm text-muted">Precio a consultar</p>;
  }

  return <p className="font-display text-2xl font-bold text-ink">{etiquetaPrecio(importe)}</p>;
}