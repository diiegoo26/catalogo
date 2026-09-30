'use client';
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import {
  CLAVE_CESTA, agregar, actualizarCantidad, contar, deserializar, quitar, serializar, vaciar,
  type ItemCesta, type OpcionesItem,
} from '@/lib/cesta';

// sessionStorage is an external store: read it through useSyncExternalStore so
// the server render and the first client (hydration) render agree, and no
// setState-in-effect cascades occur.
const VACIO: ItemCesta[] = [];
let cache: ItemCesta[] = VACIO;
let cacheRaw: string | null = '\u0000';
const oyentes = new Set<() => void>();

function leer(): ItemCesta[] {
  if (typeof window === 'undefined') return VACIO;
  const raw = window.sessionStorage.getItem(CLAVE_CESTA);
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = deserializar(raw);
  }
  return cache;
}

function escribir(items: ItemCesta[]): void {
  cache = items;
  cacheRaw = serializar(items);
  try {
    window.sessionStorage.setItem(CLAVE_CESTA, cacheRaw);
  } catch {
    /* sessionStorage may be unavailable (private mode): keep the in-memory cart */
  }
  for (const cb of oyentes) cb();
}

function suscribir(cb: () => void): () => void {
  oyentes.add(cb);
  return () => { oyentes.delete(cb); };
}

function obtenerServidor(): ItemCesta[] {
  return VACIO;
}

type CestaCtx = {
  items: ItemCesta[];
  total: number;
  abierto: boolean;
  abrir(): void;
  cerrar(): void;
  agregarItem(o: OpcionesItem): void;
  quitarItem(id: string): void;
  cambiarCantidad(id: string, cantidad: number): void;
  vaciarCesta(): void;
};

const Ctx = createContext<CestaCtx | null>(null);

export function CestaProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(suscribir, leer, obtenerServidor);
  const [abierto, setAbierto] = useState(false);

  const agregarItem = useCallback((o: OpcionesItem) => {
    escribir(agregar(leer(), o));
    setAbierto(true);
  }, []);

  const value = useMemo<CestaCtx>(() => ({
    items,
    total: contar(items),
    abierto,
    abrir: () => setAbierto(true),
    cerrar: () => setAbierto(false),
    agregarItem,
    quitarItem: (id) => escribir(quitar(leer(), id)),
    cambiarCantidad: (id, n) => escribir(actualizarCantidad(leer(), id, n)),
    vaciarCesta: () => escribir(vaciar()),
  }), [items, abierto, agregarItem]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCesta(): CestaCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCesta debe usarse dentro de CestaProvider');
  return c;
}
