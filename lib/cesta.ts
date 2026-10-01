// lib/cesta.ts
// Client-side cart: pure transformations + sessionStorage (de)serialization.
export type ItemPresupuesto = {
  title: string;
  productUrl: string;
  imageUrl?: string;
  talla: string;
  cantidad: number;
  /** Precio unitario en euros al añadir el artículo. null/undefined = a consultar. */
  precio?: number | null;
  color?: string;
  personalizacion?: string;
  parches?: string[];
  notas?: string;
};

export type ItemCesta = ItemPresupuesto & { id: string };
export type OpcionesItem = ItemPresupuesto;

export const CANTIDAD_MAX = 99;
export const CLAVE_CESTA = 'cesta:v1';

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

/** Stable id for a new cart line. */
export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `l${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Two items merge when every option except quantity/image matches.
 *
 * `precio` no entra en la clave: es una consecuencia de las opciones (la calidad
 * ya va en el título), no una elección del cliente. Si el precio cambiase entre
 * dos additions, las líneas deben seguir siendo la misma referencia.
 */
export function claveItem(o: OpcionesItem): string {
  return [o.title, o.productUrl, o.talla, o.color ?? '', o.personalizacion ?? '', (o.parches ?? []).join('|'), o.notas ?? ''].join('\u0001');
}

export function agregar(items: ItemCesta[], o: OpcionesItem, id: string = nuevoId()): ItemCesta[] {
  const clave = claveItem(o);
  const i = items.findIndex((it) => claveItem(it) === clave);
  if (i === -1) return [...items, { ...o, id }];
  const copia = items.slice();
  copia[i] = { ...copia[i], cantidad: Math.min(CANTIDAD_MAX, copia[i].cantidad + o.cantidad) };
  return copia;
}

export function quitar(items: ItemCesta[], id: string): ItemCesta[] {
  return items.filter((it) => it.id !== id);
}

export function actualizarCantidad(items: ItemCesta[], id: string, cantidad: number): ItemCesta[] {
  const n = Math.min(CANTIDAD_MAX, Math.max(1, Math.trunc(Number.isFinite(cantidad) ? cantidad : 1)));
  return items.map((it) => (it.id === id ? { ...it, cantidad: n } : it));
}

export function vaciar(): ItemCesta[] {
  return [];
}

export function contar(items: ItemCesta[]): number {
  return items.reduce((t, it) => t + it.cantidad, 0);
}

/** Sum of known unit prices x quantity. A null price means "a consultar" and is
 * deliberately excluded rather than treated as 0 — see `hayPrecioPendiente`.
 * Accepts ItemPresupuesto so the Telegram quote uses the same rule. */
export function totalEuros(items: ItemPresupuesto[]): number {
  return items.reduce((t, it) => t + (typeof it.precio === 'number' ? it.precio * it.cantidad : 0), 0);
}

/** True when any line has no price, i.e. the total cannot be stated as a figure. */
export function hayPrecioPendiente(items: ItemPresupuesto[]): boolean {
  return items.some((it) => typeof it.precio !== 'number');
}

export function serializar(items: ItemCesta[]): string {
  return JSON.stringify({ items });
}

export function deserializar(raw: string | null): ItemCesta[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { items?: unknown };
    if (!parsed || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter((it): it is ItemCesta => {
      if (typeof it !== 'object' || it === null) return false;
      const o = it as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.title !== 'string' || typeof o.productUrl !== 'string') return false;
      if (typeof o.talla !== 'string' || typeof o.cantidad !== 'number') return false;
      // precio is optional, but when present it must be a finite number or null.
      if (o.precio !== undefined && o.precio !== null
        && (typeof o.precio !== 'number' || !Number.isFinite(o.precio) || o.precio < 0)) return false;
      return true;
    });
  } catch {
    return [];
  }
}

export function cargar(storage: StorageLike): ItemCesta[] {
  return deserializar(storage.getItem(CLAVE_CESTA));
}

export function guardar(storage: StorageLike, items: ItemCesta[]): void {
  storage.setItem(CLAVE_CESTA, serializar(items));
}
