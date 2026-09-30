# Cart + "Obtener presupuesto" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-product Telegram order with an add-to-cart flow; when the customer presses "Obtener presupuesto" and gives province + locality, the whole cart is delivered to the owner's Telegram (photo album + summary) and the customer sees an on-site confirmation.

**Architecture:** A client cart (`CestaProvider` + `sessionStorage`) is populated from product pages, shown in a header drawer and a `/cesta` page, and submitted to a new `POST /api/presupuesto` route. The route validates with pure helpers in `lib/pedido.ts` and sends via `enviarPresupuesto` in `lib/telegram.ts` (batched `sendMediaGroup` + `sendMessage` summary). The browser never holds the bot token.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Vitest 4 (node env), Telegram Bot API.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-30-cesta-presupuesto-design.md`.
- Test runner: `npm test` (= `vitest run`), tests live in `tests/**/*.test.ts`, node environment — **no DOM, no `window`** in tests.
- Secrets `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` stay server-only. Never `NEXT_PUBLIC_`.
- Keep `NEXT_PUBLIC_TELEGRAM_USERNAME` for the plan-B fallback (clipboard + `t.me`).
- Cart limits: max **20 items**; `cantidad` 1–99; `localidad` ≤ 80 chars; `nombre` ≤ 60; phone must pass `telefonoValido`.
- Province must be one of the 52 in `lib/provincias.ts`.
- Reuse existing helpers: `escapeHtml` (`lib/pedido.ts`), `telefonoValido` / `telegramValido` / `normalizarTelegram` (`lib/cliente.ts`), `permitir` (`lib/rate-limit.ts`), `enviarConReintento` (`lib/telegram.ts`).
- No prices anywhere (shipping is an extra the owner quotes).
- Remove the old single-order path only in the final cleanup task, so the build stays green between tasks.
- Existing UI class tokens: `field`, `chip`, `rounded-card`, `border-line`, `text-muted`, `font-display`, `bg-ink`. Reuse them.

---

### Task 1: Province list

**Files:**
- Create: `lib/provincias.ts`
- Test: `tests/provincias.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PROVINCIAS: readonly string[]` (52 Spanish provinces).

- [ ] **Step 1: Write the failing test**

```ts
// tests/provincias.test.ts
import { describe, it, expect } from 'vitest';
import { PROVINCIAS } from '../lib/provincias';

describe('PROVINCIAS', () => {
  it('has the 52 Spanish provinces', () => {
    expect(PROVINCIAS).toHaveLength(52);
    expect(new Set(PROVINCIAS).size).toBe(52);
  });

  it('includes representative provinces', () => {
    expect(PROVINCIAS).toContain('Madrid');
    expect(PROVINCIAS).toContain('Barcelona');
    expect(PROVINCIAS).toContain('Las Palmas');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/provincias.test.ts`
Expected: FAIL — cannot resolve `../lib/provincias`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/provincias.ts
// The 52 Spanish provinces, in alphabetical order. Used to constrain the
// shipping province so the owner always receives a valid value.
// Typed as readonly string[] (not `as const`) so `.includes(string)` type-checks.
export const PROVINCIAS: readonly string[] = [
  'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila',
  'Badajoz', 'Baleares', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria',
  'Castellón', 'Ceuta', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada',
  'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Jaén', 'La Rioja', 'Las Palmas',
  'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Melilla', 'Murcia', 'Navarra',
  'Ourense', 'Palencia', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife',
  'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia',
  'Valladolid', 'Vizcaya', 'Zamora', 'Zaragoza',
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/provincias.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/provincias.ts tests/provincias.test.ts
git commit -m "feat: add Spanish provinces list for shipping"
```

---

### Task 2: Cart domain (`lib/cesta.ts`)

**Files:**
- Create: `lib/cesta.ts`
- Test: `tests/cesta.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces the shared item shape (single source of truth) that Task 3 imports:

```ts
export type ItemPresupuesto = {
  title: string; productUrl: string; imageUrl?: string;
  talla: string; cantidad: number;
  color?: string; personalizacion?: string; parches?: string[]; notas?: string;
};
export type ItemCesta = ItemPresupuesto & { id: string };
export type OpcionesItem = ItemPresupuesto;
```

- Also produces: `CANTIDAD_MAX = 99`, `CLAVE_CESTA = 'cesta:v1'`, `StorageLike`, `nuevoId()`, `claveItem()`, `agregar()`, `quitar()`, `actualizarCantidad()`, `vaciar()`, `contar()`, `serializar()`, `deserializar()`, `cargar()`, `guardar()`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cesta.test.ts
import { describe, it, expect } from 'vitest';
import {
  agregar, quitar, actualizarCantidad, vaciar, contar,
  serializar, deserializar, cargar, guardar, claveItem,
  CANTIDAD_MAX, CLAVE_CESTA, type ItemCesta, type StorageLike,
} from '../lib/cesta';

const base = { title: 'Camiseta', productUrl: 'https://x.test/p', talla: 'M', cantidad: 1 };

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
}

describe('agregar', () => {
  it('appends a new line with the given id', () => {
    const items = agregar([], base, 'a1');
    expect(items).toEqual([{ ...base, id: 'a1' }]);
  });

  it('merges the same product+options and sums the quantity', () => {
    const items = agregar(agregar([], base, 'a1'), { ...base, cantidad: 2 }, 'a2');
    expect(items).toHaveLength(1);
    expect(items[0].cantidad).toBe(3);
  });

  it('clamps the merged quantity at the maximum', () => {
    const items = agregar(agregar([], { ...base, cantidad: 98 }, 'a1'), { ...base, cantidad: 5 }, 'a2');
    expect(items[0].cantidad).toBe(CANTIDAD_MAX);
  });

  it('keeps different options as separate lines', () => {
    const items = agregar(agregar([], base, 'a1'), { ...base, talla: 'L' }, 'a2');
    expect(items).toHaveLength(2);
  });
});

describe('quitar / actualizarCantidad / vaciar / contar', () => {
  it('removes a line by id', () => {
    const items = quitar([{ ...base, id: 'a' }, { ...base, id: 'b', talla: 'L' }], 'a');
    expect(items.map((i) => i.id)).toEqual(['b']);
  });
  it('updates a quantity and clamps it', () => {
    expect(actualizarCantidad([{ ...base, id: 'a' }], 'a', 4)[0].cantidad).toBe(4);
    expect(actualizarCantidad([{ ...base, id: 'a' }], 'a', 0)[0].cantidad).toBe(1);
    expect(actualizarCantidad([{ ...base, id: 'a' }], 'a', 999)[0].cantidad).toBe(CANTIDAD_MAX);
  });
  it('empties the cart', () => {
    expect(vaciar()).toEqual([]);
  });
  it('sums quantities', () => {
    expect(contar([{ ...base, id: 'a', cantidad: 2 }, { ...base, id: 'b', talla: 'L', cantidad: 3 }])).toBe(5);
  });
});

describe('claveItem', () => {
  it('ignores quantity and image but distinguishes options', () => {
    expect(claveItem(base)).toBe(claveItem({ ...base, cantidad: 9, imageUrl: 'https://x.test/a.jpg' }));
    expect(claveItem(base)).not.toBe(claveItem({ ...base, talla: 'L' }));
  });
});

describe('serialize/deserialize + storage', () => {
  it('round-trips through a storage-like object', () => {
    const s = fakeStorage();
    const items: ItemCesta[] = [{ ...base, id: 'a' }];
    guardar(s, items);
    expect(s.data[CLAVE_CESTA]).toBe(serializar(items));
    expect(cargar(s)).toEqual(items);
  });
  it('returns an empty cart for a corrupt blob', () => {
    expect(deserializar('{not json')).toEqual([]);
    expect(deserializar(null)).toEqual([]);
    expect(deserializar(JSON.stringify({ items: 'nope' }))).toEqual([]);
  });
  it('returns an empty cart when storage is empty', () => {
    expect(cargar(fakeStorage())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cesta.test.ts`
Expected: FAIL — cannot resolve `../lib/cesta`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/cesta.ts
// Client-side cart: pure transformations + sessionStorage (de)serialization.
export type ItemPresupuesto = {
  title: string;
  productUrl: string;
  imageUrl?: string;
  talla: string;
  cantidad: number;
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

/** Two items merge when every option except quantity/image matches. */
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
      return typeof o.id === 'string' && typeof o.title === 'string' && typeof o.productUrl === 'string'
        && typeof o.talla === 'string' && typeof o.cantidad === 'number';
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cesta.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/cesta.ts tests/cesta.test.ts
git commit -m "feat: cart domain helpers and sessionStorage codec"
```

---

### Task 3: Presupuesto validation (`lib/pedido.ts`)

**Files:**
- Modify: `lib/pedido.ts` (add exports; keep existing `validarPedido`/`construirMensaje`/`escapeHtml` untouched for now)
- Test: `tests/presupuesto.test.ts`

**Interfaces:**
- Consumes: `ItemPresupuesto` from `./cesta`; `PROVINCIAS` from `./provincias`; `escapeHtml`, `texto`, `esUrl` existing in `lib/pedido.ts`; `telefonoValido`, `telegramValido`, `normalizarTelegram` from `./cliente`.
- Produces:
  - `type Cliente = { nombre: string; telefono: string; telegram?: string }`
  - `type PresupuestoPayload = { items: ItemPresupuesto[]; cliente: Cliente; provincia: string; localidad: string }`
  - `const MAX_ITEMS = 20`
  - `validarPresupuesto(raw: unknown): { ok: true; presupuesto: PresupuestoPayload } | { ok: false; error: string }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/presupuesto.test.ts
import { describe, it, expect } from 'vitest';
import { validarPresupuesto, MAX_ITEMS } from '../lib/pedido';

const item = { title: 'Camiseta', productUrl: 'https://x.test/p', talla: 'M', cantidad: 2 };
const base = {
  items: [item],
  cliente: { nombre: 'Diego', telefono: '612 345 678' },
  provincia: 'Madrid',
  localidad: 'Alcobendas',
};

describe('validarPresupuesto', () => {
  it('accepts a valid payload', () => {
    const r = validarPresupuesto(base);
    expect(r).toEqual({ ok: true, presupuesto: base });
  });

  it('rejects a non-object', () => {
    expect(validarPresupuesto(null)).toEqual({ ok: false, error: 'payload' });
    expect(validarPresupuesto([1])).toEqual({ ok: false, error: 'payload' });
  });

  it('rejects an empty or oversized cart', () => {
    expect(validarPresupuesto({ ...base, items: [] })).toEqual({ ok: false, error: 'items' });
    expect(validarPresupuesto({ ...base, items: Array.from({ length: MAX_ITEMS + 1 }, () => item) })).toEqual({ ok: false, error: 'items' });
  });

  it('rejects a bad item', () => {
    expect(validarPresupuesto({ ...base, items: [{ ...item, title: '' }] })).toEqual({ ok: false, error: 'title' });
    expect(validarPresupuesto({ ...base, items: [{ ...item, productUrl: 'javascript:alert(1)' }] })).toEqual({ ok: false, error: 'productUrl' });
    expect(validarPresupuesto({ ...base, items: [{ ...item, talla: '' }] })).toEqual({ ok: false, error: 'talla' });
    expect(validarPresupuesto({ ...base, items: [{ ...item, cantidad: 0 }] })).toEqual({ ok: false, error: 'cantidad' });
  });

  it('rejects bad customer data', () => {
    expect(validarPresupuesto({ ...base, cliente: { telefono: '612345678' } })).toEqual({ ok: false, error: 'nombre' });
    expect(validarPresupuesto({ ...base, cliente: { nombre: 'Diego', telefono: '123' } })).toEqual({ ok: false, error: 'telefono' });
    expect(validarPresupuesto({ ...base, cliente: { nombre: 'Diego', telefono: '612345678', telegram: '@x' } })).toEqual({ ok: false, error: 'telegram' });
  });

  it('normalises an optional telegram username', () => {
    const r = validarPresupuesto({ ...base, cliente: { nombre: 'Diego', telefono: '612345678', telegram: '@DiegoCorral' } });
    expect(r).toEqual({ ok: true, presupuesto: { ...base, cliente: { nombre: 'Diego', telefono: '612345678', telegram: 'DiegoCorral' } } });
  });

  it('rejects an unknown province and a missing locality', () => {
    expect(validarPresupuesto({ ...base, provincia: 'Narnia' })).toEqual({ ok: false, error: 'provincia' });
    expect(validarPresupuesto({ ...base, localidad: '   ' })).toEqual({ ok: false, error: 'localidad' });
  });

  it('rejects a filled honeypot', () => {
    expect(validarPresupuesto({ ...base, hp: 'bot' })).toEqual({ ok: false, error: 'spam' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/presupuesto.test.ts`
Expected: FAIL — `validarPresupuesto` is not exported.

- [ ] **Step 3: Write the implementation**

Add to the **top** of `lib/pedido.ts` (after the existing `cliente` import):

```ts
import { PROVINCIAS } from './provincias';
import type { ItemPresupuesto } from './cesta';
```

Then append at the **end** of `lib/pedido.ts`:

```ts
export const MAX_ITEMS = 20;

export type Cliente = { nombre: string; telefono: string; telegram?: string };

export type PresupuestoPayload = {
  items: ItemPresupuesto[];
  cliente: Cliente;
  provincia: string;
  localidad: string;
};

export type ValidacionPresupuesto =
  | { ok: true; presupuesto: PresupuestoPayload }
  | { ok: false; error: string };

function validarItem(raw: unknown): { ok: true; item: ItemPresupuesto } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'items' };
  const o = raw as Record<string, unknown>;

  const title = texto(o.title, 200);
  if (!title) return { ok: false, error: 'title' };
  const productUrl = texto(o.productUrl, 500);
  if (!productUrl || !esUrl(productUrl)) return { ok: false, error: 'productUrl' };
  const talla = texto(o.talla, 60);
  if (!talla) return { ok: false, error: 'talla' };

  const cantidad = o.cantidad;
  if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
    return { ok: false, error: 'cantidad' };
  }

  const item: ItemPresupuesto = { title, productUrl, talla, cantidad };

  if (o.imageUrl !== undefined) {
    const imageUrl = texto(o.imageUrl, 500);
    if (!imageUrl || !esUrl(imageUrl)) return { ok: false, error: 'imageUrl' };
    item.imageUrl = imageUrl;
  }
  if (o.color !== undefined) {
    const color = texto(o.color, 60);
    if (!color) return { ok: false, error: 'color' };
    item.color = color;
  }
  if (o.personalizacion !== undefined) {
    const personalizacion = texto(o.personalizacion, 80);
    if (!personalizacion) return { ok: false, error: 'personalizacion' };
    item.personalizacion = personalizacion;
  }
  if (o.parches !== undefined) {
    if (!Array.isArray(o.parches) || o.parches.length > 10) return { ok: false, error: 'parches' };
    const parches: string[] = [];
    for (const x of o.parches) {
      const p = texto(x, 60);
      if (!p) return { ok: false, error: 'parches' };
      parches.push(p);
    }
    item.parches = parches;
  }
  if (o.notas !== undefined && o.notas !== '') {
    const notas = texto(o.notas, 300);
    if (!notas) return { ok: false, error: 'notas' };
    item.notas = notas;
  }
  return { ok: true, item };
}

export function validarPresupuesto(raw: unknown): ValidacionPresupuesto {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'payload' };
  const o = raw as Record<string, unknown>;

  if (o.hp !== undefined && o.hp !== '') return { ok: false, error: 'spam' };

  if (!Array.isArray(o.items) || o.items.length < 1 || o.items.length > MAX_ITEMS) {
    return { ok: false, error: 'items' };
  }
  const items: ItemPresupuesto[] = [];
  for (const rawItem of o.items) {
    const r = validarItem(rawItem);
    if (!r.ok) return r;
    items.push(r.item);
  }

  const c = o.cliente;
  if (typeof c !== 'object' || c === null || Array.isArray(c)) return { ok: false, error: 'cliente' };
  const co = c as Record<string, unknown>;
  const nombre = texto(co.nombre, 60);
  if (!nombre) return { ok: false, error: 'nombre' };
  const telefono = texto(co.telefono, 30);
  if (!telefono || !telefonoValido(telefono)) return { ok: false, error: 'telefono' };
  const cliente: Cliente = { nombre, telefono };
  if (co.telegram !== undefined && co.telegram !== '') {
    const telegram = texto(co.telegram, 40);
    if (!telegram || !telegramValido(telegram)) return { ok: false, error: 'telegram' };
    cliente.telegram = normalizarTelegram(telegram);
  }

  const provincia = texto(o.provincia, 60);
  if (!provincia || !PROVINCIAS.includes(provincia)) return { ok: false, error: 'provincia' };
  const localidad = texto(o.localidad, 80);
  if (!localidad) return { ok: false, error: 'localidad' };

  return { ok: true, presupuesto: { items, cliente, provincia, localidad } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/presupuesto.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pedido.ts tests/presupuesto.test.ts
git commit -m "feat: validate presupuesto payload (cart + shipping)"
```

---

### Task 4: Summary + album partition (`lib/pedido.ts`)

**Files:**
- Modify: `lib/pedido.ts` (append)
- Test: `tests/presupuesto.test.ts` (append)

**Interfaces:**
- Consumes: `PresupuestoPayload`, `escapeHtml` (same module).
- Produces:
  - `construirResumen(p: PresupuestoPayload): string`
  - `construirPieAlbum(total: number): string`
  - `repartirAlbumes(urls: string[], max = 10): string[][]` — chunks of 2..10, never a 1-item trailing chunk when there is more than one URL.

- [ ] **Step 1: Write the failing test** (append to `tests/presupuesto.test.ts`)

```ts
import { construirResumen, construirPieAlbum, repartirAlbumes } from '../lib/pedido';

describe('construirResumen', () => {
  const p = {
    items: [
      { title: 'A & B', productUrl: 'https://x.test/a', talla: 'M', cantidad: 2, color: 'Negro', personalizacion: 'GARCÍA 10', parches: ['LaLiga'], notas: 'Sin prisa' },
      { title: 'Bufanda', productUrl: 'https://x.test/b', talla: 'Única', cantidad: 1 },
    ],
    cliente: { nombre: 'Ana', telefono: '612 345 678', telegram: 'AnaP' },
    provincia: 'Madrid',
    localidad: 'Alcobendas',
  };

  it('lists every item with its options and a link', () => {
    const text = construirResumen(p);
    expect(text).toContain('Nuevo presupuesto (2 artículos)');
    expect(text).toContain('📦 <b>A &amp; B</b>');
    expect(text).toContain('Talla: M · Cantidad: 2 · Color: Negro');
    expect(text).toContain('Personalización: GARCÍA 10');
    expect(text).toContain('Parches: LaLiga');
    expect(text).toContain('📝 Notas: Sin prisa');
    expect(text).toContain('<a href="https://x.test/a">Ver producto</a>');
    expect(text).toContain('2. 📦 <b>Bufanda</b>');
  });

  it('includes the customer and the shipping line', () => {
    const text = construirResumen(p);
    expect(text).toContain('👤 Cliente: Ana');
    expect(text).toContain('<a href="tel:612345678">612 345 678</a>');
    expect(text).toContain('<a href="https://t.me/AnaP">@AnaP</a>');
    expect(text).toContain('📍 Envío: Alcobendas (Madrid) — el envío es un extra');
  });

  it('uses the singular for one item and no telegram line when absent', () => {
    const text = construirResumen({ ...p, items: [p.items[1]], cliente: { nombre: 'Ana', telefono: '612345678' } });
    expect(text).toContain('(1 artículo)');
    expect(text).not.toContain('t.me/');
  });
});

describe('repartirAlbumes', () => {
  const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://x.test/${i}.jpg`);
  it('returns nothing for no URLs', () => {
    expect(repartirAlbumes([])).toEqual([]);
  });
  it('returns a single 1-item chunk for one URL (caller uses sendPhoto)', () => {
    expect(repartirAlbumes(urls(1))).toEqual([urls(1)]);
  });
  it('batches 12 into 10 + 2', () => {
    const g = repartirAlbumes(urls(12));
    expect(g.map((c) => c.length)).toEqual([10, 2]);
  });
  it('never leaves a 1-item trailing chunk (11 -> 9 + 2)', () => {
    expect(repartirAlbumes(urls(11)).map((c) => c.length)).toEqual([9, 2]);
    expect(repartirAlbumes(urls(21)).map((c) => c.length)).toEqual([10, 9, 2]);
    expect(repartirAlbumes(urls(20)).map((c) => c.length)).toEqual([10, 10]);
  });
  it('builds the album caption', () => {
    expect(construirPieAlbum(1)).toContain('1 artículo');
    expect(construirPieAlbum(3)).toContain('3 artículos');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/presupuesto.test.ts`
Expected: FAIL — `construirResumen` is not exported.

- [ ] **Step 3: Write the implementation** (append to `lib/pedido.ts`)

```ts
export function construirPieAlbum(total: number): string {
  return `🛒 <b>Presupuesto</b> — ${total} ${total === 1 ? 'artículo' : 'artículos'}`;
}

export function construirResumen(p: PresupuestoPayload): string {
  const n = p.items.length;
  const lineas: string[] = [`🛒 <b>Nuevo presupuesto (${n} ${n === 1 ? 'artículo' : 'artículos'})</b>`];

  p.items.forEach((it, i) => {
    lineas.push('');
    lineas.push(`${i + 1}. 📦 <b>${escapeHtml(it.title)}</b>`);
    const opciones = [
      `Talla: ${escapeHtml(it.talla)}`,
      it.cantidad ? `Cantidad: ${it.cantidad}` : null,
      it.color ? `Color: ${escapeHtml(it.color)}` : null,
    ].filter(Boolean) as string[];
    if (opciones.length) lineas.push(opciones.join(' · '));
    if (it.personalizacion) lineas.push(`Personalización: ${escapeHtml(it.personalizacion)}`);
    if (it.parches?.length) lineas.push(`Parches: ${escapeHtml(it.parches.join(', '))}`);
    if (it.notas) lineas.push(`📝 Notas: ${escapeHtml(it.notas)}`);
    lineas.push(`🔗 <a href="${escapeHtml(it.productUrl)}">Ver producto</a>`);
  });

  lineas.push('');
  lineas.push(`👤 Cliente: ${escapeHtml(p.cliente.nombre)}`);
  lineas.push(`📞 <a href="tel:${escapeHtml(p.cliente.telefono.replace(/[^\d+]/g, ''))}">${escapeHtml(p.cliente.telefono)}</a>`);
  if (p.cliente.telegram) {
    lineas.push(`✈️ <a href="https://t.me/${escapeHtml(p.cliente.telegram)}">@${escapeHtml(p.cliente.telegram)}</a>`);
  }
  lineas.push(`📍 Envío: ${escapeHtml(p.localidad)} (${escapeHtml(p.provincia)}) — el envío es un extra`);
  return lineas.join('\n');
}

/** Chunk image URLs into Telegram media groups (2-10 each). A single URL is
 * returned as a 1-item chunk so the caller can use sendPhoto instead. */
export function repartirAlbumes(urls: string[], max = 10): string[][] {
  const grupos: string[][] = [];
  for (let i = 0; i < urls.length; i += max) grupos.push(urls.slice(i, i + max));
  const ultimo = grupos[grupos.length - 1];
  if (grupos.length > 1 && ultimo.length < 2) {
    const previo = grupos[grupos.length - 2];
    ultimo.unshift(previo.pop() as string);
  }
  return grupos;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/presupuesto.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pedido.ts tests/presupuesto.test.ts
git commit -m "feat: build presupuesto summary and album batches"
```

---

### Task 5: Telegram sender (`lib/telegram.ts`)

**Files:**
- Modify: `lib/telegram.ts` (add `enviarPresupuesto`; keep `enviarPedido`/`enviarMensaje` for now)
- Test: `tests/enviar-presupuesto.test.ts`

**Interfaces:**
- Consumes: `construirResumen`, `construirPieAlbum`, `repartirAlbumes`, `PresupuestoPayload` from `./pedido`; `enviarConReintento` + `Opciones` already in `lib/telegram.ts`.
- Produces: `enviarPresupuesto(p: PresupuestoPayload, opts?: Opciones): Promise<EnvioResult>` — best-effort album, **always** sends the summary; the summary result is the return value.

- [ ] **Step 1: Write the failing test**

```ts
// tests/enviar-presupuesto.test.ts
import { describe, it, expect, vi } from 'vitest';
import { enviarPresupuesto } from '../lib/telegram';

const base = {
  items: [{ title: 'Camiseta', productUrl: 'https://x.test/p', talla: 'M', cantidad: 1 }],
  cliente: { nombre: 'Diego', telefono: '612 345 678' },
  provincia: 'Madrid',
  localidad: 'Alcobendas',
};
const res = (ok: boolean, status: number) => ({ ok, status } as Response);

describe('enviarPresupuesto', () => {
  it('fails fast without token/chat id', async () => {
    const fetchImpl = vi.fn();
    const r = await enviarPresupuesto(base, { fetchImpl: fetchImpl as unknown as typeof fetch, token: '', chatId: '' });
    expect(r).toEqual({ ok: false, error: 'no_config' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends only the summary when there are no photos', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200));
    const r = await enviarPresupuesto(base, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(r).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain('/sendMessage');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).text).toContain('Nuevo presupuesto');
  });

  it('sends sendPhoto for one image, then the summary', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200));
    const p = { ...base, items: [{ ...base.items[0], imageUrl: 'https://x.test/a.jpg' }] };
    await enviarPresupuesto(p, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(fetchImpl.mock.calls[0][0]).toContain('/sendPhoto');
    expect(fetchImpl.mock.calls[1][0]).toContain('/sendMessage');
  });

  it('sends sendMediaGroup for two images, then the summary', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200));
    const p = {
      ...base,
      items: [
        { ...base.items[0], imageUrl: 'https://x.test/a.jpg' },
        { ...base.items[0], title: 'Bufanda', imageUrl: 'https://x.test/b.jpg' },
      ],
    };
    await enviarPresupuesto(p, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(fetchImpl.mock.calls[0][0]).toContain('/sendMediaGroup');
    const media = JSON.parse(fetchImpl.mock.calls[0][1].body).media;
    expect(media).toHaveLength(2);
    expect(media[0].caption).toContain('Presupuesto');
    expect(fetchImpl.mock.calls[1][0]).toContain('/sendMessage');
  });

  it('batches more than 10 images into 9 + 2, then the summary', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200));
    const items = Array.from({ length: 11 }, (_, i) => ({ ...base.items[0], title: `P${i}`, imageUrl: `https://x.test/${i}.jpg` }));
    await enviarPresupuesto({ ...base, items }, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    const albumCalls = fetchImpl.mock.calls.filter((c) => String(c[0]).includes('/sendMediaGroup'));
    expect(albumCalls).toHaveLength(2);
    expect(JSON.parse(albumCalls[0][1].body).media).toHaveLength(9);
    expect(JSON.parse(albumCalls[1][1].body).media).toHaveLength(2);
  });

  it('still reports ok when the album fails but the summary succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(false, 400)) // sendMediaGroup fails immediately (4xx)
      .mockResolvedValueOnce(res(true, 200));  // summary ok
    const p = {
      ...base,
      items: [
        { ...base.items[0], imageUrl: 'https://x.test/a.jpg' },
        { ...base.items[0], title: 'Bufanda', imageUrl: 'https://x.test/b.jpg' },
      ],
    };
    const r = await enviarPresupuesto(p, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(r).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/enviar-presupuesto.test.ts`
Expected: FAIL — `enviarPresupuesto` is not exported.

- [ ] **Step 3: Write the implementation** (append to `lib/telegram.ts` and extend its import)

Change the first import line of `lib/telegram.ts` to:

```ts
import { construirMensaje, construirPieAlbum, construirResumen, repartirAlbumes, type PedidoPayload, type PresupuestoPayload } from './pedido';
```

Append:

```ts
/** Sends a whole cart to the owner: best-effort photo album, always a summary.
 * The summary result is authoritative — a failed album never masks a sent quote. */
export async function enviarPresupuesto(p: PresupuestoPayload, opts: Opciones = {}): Promise<EnvioResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = opts.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID ?? '';
  const intentos = opts.intentos ?? 2;
  if (!token || !chatId) return { ok: false, error: 'no_config' };

  const urls = p.items.map((it) => it.imageUrl).filter((u): u is string => Boolean(u));
  const pie = construirPieAlbum(p.items.length);

  for (const grupo of repartirAlbumes(urls)) {
    if (grupo.length === 1) {
      await enviarConReintento(fetchImpl, token, 'sendPhoto',
        { chat_id: chatId, photo: grupo[0], caption: pie, parse_mode: 'HTML' }, intentos);
    } else {
      await enviarConReintento(fetchImpl, token, 'sendMediaGroup', {
        chat_id: chatId,
        media: grupo.map((url, i) => (i === 0
          ? { type: 'photo', media: url, caption: pie, parse_mode: 'HTML' }
          : { type: 'photo', media: url })),
      }, intentos);
    }
  }

  return enviarConReintento(fetchImpl, token, 'sendMessage',
    { chat_id: chatId, text: construirResumen(p), parse_mode: 'HTML', disable_web_page_preview: false }, intentos);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/enviar-presupuesto.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/telegram.ts tests/enviar-presupuesto.test.ts
git commit -m "feat: send presupuesto as album + summary"
```

---

### Task 6: API route (`app/api/presupuesto/route.ts`)

**Files:**
- Create: `app/api/presupuesto/route.ts`
- Reference: `app/api/pedido/route.ts` (same shape)
- Test: none new (matches the repo pattern — routes are thin and untested). Manual verification below.

**Interfaces:**
- Consumes: `validarPresupuesto` (`lib/pedido`), `enviarPresupuesto` (`lib/telegram`), `permitir` (`lib/rate-limit`).
- Produces: `POST /api/presupuesto` → `200 { ok: true }` | `400 { ok, error }` | `413` | `429` | `502`.

- [ ] **Step 1: Write the implementation**

```ts
// app/api/presupuesto/route.ts
import { NextResponse } from 'next/server';
import { validarPresupuesto } from '@/lib/pedido';
import { enviarPresupuesto } from '@/lib/telegram';
import { permitir } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocido';
  if (!permitir(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const MAX_BODY = 20_000; // carts are larger than a single order but still small
  const declarado = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declarado) && declarado > MAX_BODY) {
    return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });
  }

  const texto = await req.text();
  if (texto.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(texto);
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const v = validarPresupuesto(raw);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const r = await enviarPresupuesto(v.presupuesto);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify it compiles and the route is registered**

Run: `npm run build`
Expected: build succeeds; route `/api/presupuesto` appears in the output.

- [ ] **Step 3: Manual smoke (no bot configured → graceful 502)**

Run: `npm run dev`, then in another shell:
`curl -s -X POST http://localhost:3000/api/presupuesto -H "content-type: application/json" -d "{\"items\":[{\"title\":\"x\",\"productUrl\":\"https://x.test/p\",\"talla\":\"M\",\"cantidad\":1}],\"cliente\":{\"nombre\":\"Diego\",\"telefono\":\"612345678\"},\"provincia\":\"Madrid\",\"localidad\":\"Alcobendas\"}"`
Expected: `{"ok":false,"error":"no_config"}` with HTTP 502 when no token is set (proves validation passed and the sender was reached).

- [ ] **Step 4: Commit**

```bash
git add app/api/presupuesto/route.ts
git commit -m "feat: /api/presupuesto route for cart quotes"
```

---

### Task 7: Cart provider + header drawer

**Files:**
- Create: `components/CestaProvider.tsx`, `components/CestaDrawer.tsx`, `components/BotonCesta.tsx`
- Modify: `app/layout.tsx` (wrap in provider), `components/Header.tsx` (mount `<BotonCesta />`)
- Test: manual (client UI). Logic is already covered by `tests/cesta.test.ts`.

**Interfaces:**
- Consumes: `lib/cesta` helpers; `next/image`, `next/link`.
- Produces:
  - `CestaProvider({ children })` and `useCesta()` returning `{ items, total, abierto, abrir, cerrar, agregarItem(o: OpcionesItem), quitarItem(id), cambiarCantidad(id, n), vaciarCesta() }`.
  - `BotonCesta`, `CestaDrawer`.

- [ ] **Step 1: Create `components/CestaProvider.tsx`**

```tsx
'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { agregar, actualizarCantidad, cargar, contar, guardar, quitar, vaciar, type ItemCesta, type OpcionesItem } from '@/lib/cesta';

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
  const [items, setItems] = useState<ItemCesta[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setItems(cargar(window.sessionStorage));
    setMontado(true);
  }, []);

  useEffect(() => {
    if (montado) guardar(window.sessionStorage, items);
  }, [items, montado]);

  const value = useMemo<CestaCtx>(() => ({
    items,
    total: contar(items),
    abierto,
    abrir: () => setAbierto(true),
    cerrar: () => setAbierto(false),
    agregarItem: (o) => { setItems((prev) => agregar(prev, o)); setAbierto(true); },
    quitarItem: (id) => setItems((prev) => quitar(prev, id)),
    cambiarCantidad: (id, n) => setItems((prev) => actualizarCantidad(prev, id, n)),
    vaciarCesta: () => setItems(vaciar()),
  }), [items, abierto]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCesta(): CestaCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCesta debe usarse dentro de CestaProvider');
  return c;
}
```

- [ ] **Step 2: Create `components/CestaDrawer.tsx`**

```tsx
'use client';
import Image from 'next/image';
import Link from 'next/link';
import { CANTIDAD_MAX } from '@/lib/cesta';
import { useCesta } from './CestaProvider';

export default function CestaDrawer() {
  const { items, abierto, cerrar, quitarItem, cambiarCantidad, total } = useCesta();
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={cerrar} aria-hidden />
      <aside role="dialog" aria-label="Cesta" className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-display font-bold">Tu cesta ({total})</p>
          <button type="button" onClick={cerrar} className="text-sm text-muted hover:text-ink">Cerrar</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">Tu cesta está vacía.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.id} className="flex gap-3 border-b border-line pb-3 last:border-0">
                  {it.imageUrl && (
                    <Image src={it.imageUrl} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.title}</p>
                    <p className="text-xs text-muted">{it.talla}{it.color ? ` · ${it.color}` : ''}</p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <input
                        type="number" min={1} max={CANTIDAD_MAX} value={it.cantidad}
                        onChange={(e) => cambiarCantidad(it.id, Number(e.target.value))}
                        className="w-16 rounded border border-line px-2 py-1 text-sm"
                      />
                      <button type="button" onClick={() => quitarItem(it.id)} className="text-xs text-red-500 hover:underline">Quitar</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line p-4">
          <Link href="/cesta" onClick={cerrar} className="flex w-full items-center justify-center rounded-full bg-ink py-3 font-semibold text-white">
            Ver cesta completa
          </Link>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/BotonCesta.tsx`**

```tsx
'use client';
import { useCesta } from './CestaProvider';
import CestaDrawer from './CestaDrawer';

export default function BotonCesta() {
  const { total, abrir } = useCesta();
  return (
    <>
      <button
        type="button" onClick={abrir} aria-label="Abrir cesta"
        className="relative inline-flex h-10 shrink-0 items-center rounded-full border border-white/15 px-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        Cesta
        {total > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2E7BFF] px-1 font-mono text-[10px] font-bold text-white">
            {total}
          </span>
        )}
      </button>
      <CestaDrawer />
    </>
  );
}
```

- [ ] **Step 4: Wrap `app/layout.tsx` in the provider**

Import and wrap the header + main + footer:

```tsx
import { CestaProvider } from '@/components/CestaProvider';
// ...
<body className="min-h-screen bg-canvas font-sans text-ink antialiased">
  <a href="#contenido" className="...">Saltar al contenido</a>
  <CestaProvider>
    <Header />
    <main id="contenido" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    <Footer />
  </CestaProvider>
</body>
```

- [ ] **Step 5: Mount the cart button in `components/Header.tsx`**

Add the import and place it after the Catálogo link:

```tsx
import BotonCesta from './BotonCesta';
// ...
<Link href="/catalogo" className="btn btn-light hidden shrink-0 md:inline-flex">Catálogo (PDF)</Link>
<BotonCesta />
```

- [ ] **Step 6: Verify**

Run: `npm run lint` then `npm run build`
Expected: both pass. Then `npm run dev`, open any page, confirm the "Cesta" button shows in the header and clicking it opens the drawer.

- [ ] **Step 7: Commit**

```bash
git add components/CestaProvider.tsx components/CestaDrawer.tsx components/BotonCesta.tsx app/layout.tsx components/Header.tsx
git commit -m "feat: cart provider, header button and drawer"
```

---

### Task 8: Product pages add to cart

**Files:**
- Create: `components/BotonAgregar.tsx`
- Modify: `components/ProductPurchase.tsx`, `components/KitCustomizer.tsx`
- Delete: `components/BotonTelegram.tsx`
- Test: manual (client UI). Cart logic already covered.

**Interfaces:**
- Consumes: `useCesta()`; `OpcionesItem` type; existing `OpcionesPedido`, `tallasParaCategoria`, `telefonoValido` (only for nothing now — remove if unused), `LIMITE_NOMBRE`, player/patch logic.
- Produces: `BotonAgregar({ onAgregar, disabled, label? })`.

- [ ] **Step 1: Create `components/BotonAgregar.tsx`**

```tsx
'use client';
import { useState } from 'react';

type Props = { onAgregar: () => void; disabled?: boolean; label?: string };

export default function BotonAgregar({ onAgregar, disabled = false, label = 'Agregar a la cesta' }: Props) {
  const [anadido, setAnadido] = useState(false);
  const pulsar = () => {
    onAgregar();
    setAnadido(true);
    window.setTimeout(() => setAnadido(false), 2000);
  };
  return (
    <button
      type="button" onClick={pulsar} disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 font-semibold text-white shadow-[0_12px_26px_-14px_rgba(11,16,48,0.7)] transition hover:bg-ink/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
    >
      {anadido ? 'Añadido a la cesta ✓' : label}
    </button>
  );
}
```

- [ ] **Step 2: Rewrite `components/ProductPurchase.tsx`**

Remove `BotonTelegram`, `DatosCliente`, `telefonoValido`, `aviso`, `pedir`, `TELEGRAM_USER`. Keep `OpcionesPedido` + color + notes. Use `useCesta`.

```tsx
'use client';
import { useMemo, useState } from 'react';
import BotonAgregar from './BotonAgregar';
import { useCesta } from './CestaProvider';
import OpcionesPedido, { OPCIONES_INICIALES, type Opciones } from './OpcionesPedido';
import { tallasParaCategoria } from '@/lib/tallas';
import type { Variant } from '@/lib/types';

export default function ProductPurchase({ title, variants, imageUrl, categoria }: {
  title: string; variants: Variant[]; imageUrl?: string; categoria: string;
}) {
  const tallas = useMemo(() => tallasParaCategoria(categoria), [categoria]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const [color, setColor] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<Opciones>(OPCIONES_INICIALES);
  const { agregarItem } = useCesta();

  const listo = Boolean(opciones.talla);

  const agregar = () => {
    agregarItem({
      title,
      productUrl: window.location.href,
      imageUrl,
      talla: opciones.talla ?? '',
      cantidad: opciones.cantidad,
      color: color ?? undefined,
      notas: opciones.notas.trim() || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <OpcionesPedido tallas={tallas} valor={opciones} onChange={setOpciones} />
      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button key={c} type="button" data-active={color === c} onClick={() => setColor(c)} className="chip">{c}</button>
            ))}
          </div>
        </div>
      )}
      <BotonAgregar onAgregar={agregar} disabled={!listo} label={listo ? 'Agregar a la cesta' : 'Elige una talla'} />
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `components/KitCustomizer.tsx`**

Same idea, keeping personalization/patches/players. Replace the bottom block:

```tsx
'use client';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import BotonAgregar from './BotonAgregar';
import { useCesta } from './CestaProvider';
import OpcionesPedido, { OPCIONES_INICIALES, type Opciones } from './OpcionesPedido';
import { LIMITE_NOMBRE } from '@/lib/personalizacion';
import { tallasParaCategoria } from '@/lib/tallas';
import type { PatchBadge, Player, Variant } from '@/lib/types';

const limpiarNombre = (v: string) =>
  v.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ\s'’-]/g, '').slice(0, LIMITE_NOMBRE);
const limpiarNumero = (v: string) => v.replace(/\D/g, '').slice(0, 2);

type Props = {
  title: string;
  variants: Variant[];
  players: Player[];
  patches: PatchBadge[];
  imageUrl?: string;
  categoria: string;
};

export default function KitCustomizer({ title, variants, players, patches, imageUrl, categoria }: Props) {
  const tallas = useMemo(() => tallasParaCategoria(categoria), [categoria]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const [opciones, setOpciones] = useState<Opciones>(OPCIONES_INICIALES);
  const [color, setColor] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [jugadorId, setJugadorId] = useState('');
  const [parchesSel, setParchesSel] = useState<string[]>([]);
  const { agregarItem } = useCesta();

  const numeroValido = numero === '' || (Number(numero) >= 1 && Number(numero) <= 99);
  const conImpresion = (nombre.trim() !== '' || numero !== '') && numeroValido;
  const listo = Boolean(opciones.talla) && numeroValido;

  const elegirJugador = (id: string) => {
    setJugadorId(id);
    if (!id) return;
    const p = players.find((x) => x.id === id);
    if (p) { setNombre(limpiarNombre(p.name)); setNumero(String(p.number)); }
  };

  const agregar = () => {
    const personalizacion = conImpresion
      ? [nombre, numero, jugadorId ? '(plantilla)' : ''].filter(Boolean).join(' ')
      : undefined;
    agregarItem({
      title,
      productUrl: window.location.href,
      imageUrl,
      talla: opciones.talla ?? '',
      cantidad: opciones.cantidad,
      color: color ?? undefined,
      personalizacion,
      parches: parchesSel.length ? parchesSel : undefined,
      notas: opciones.notas.trim() || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <OpcionesPedido tallas={tallas} valor={opciones} onChange={setOpciones} />
      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button key={c} type="button" data-active={color === c} onClick={() => setColor(c)} className="chip">{c}</button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line p-4">
        <p className="mb-3 font-display text-sm font-bold">Personaliza tu equipación</p>

        {players.length > 0 && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs text-muted">Plantilla</span>
            <select value={jugadorId} onChange={(e) => elegirJugador(e.target.value)} className="field">
              <option value="">Personalizado (yo escribo el nombre)</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.number} · {p.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2">
            <span className="mb-1 block text-xs text-muted">Nombre (máx. {LIMITE_NOMBRE})</span>
            <input value={nombre} onChange={(e) => setNombre(limpiarNombre(e.target.value))} placeholder="TU NOMBRE" className="field" />
          </label>
          <label>
            <span className="mb-1 block text-xs text-muted">Número</span>
            <input value={numero} inputMode="numeric" onChange={(e) => setNumero(limpiarNumero(e.target.value))}
              placeholder="10" className={`field ${numeroValido ? '' : 'border-red-400'}`} />
          </label>
        </div>
        {!numeroValido && <p className="mt-1 text-xs text-red-500">El número debe estar entre 1 y 99.</p>}

        {patches.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted">Parches de competiciones (opcional)</p>
            <ul className="flex flex-wrap gap-2">
              {patches.map((p) => {
                const activo = parchesSel.includes(p.name);
                return (
                  <li key={p.name}>
                    <button type="button" data-active={activo}
                      onClick={() => setParchesSel((s) => activo ? s.filter((n) => n !== p.name) : [...s, p.name])}
                      className="chip">
                      {p.logo_url && <Image src={p.logo_url} alt="" width={16} height={16} className="mr-1.5 h-4 w-4 object-contain" />}
                      {p.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <BotonAgregar onAgregar={agregar} disabled={!listo} label={listo ? 'Agregar a la cesta' : 'Elige una talla'} />
    </div>
  );
}
```

- [ ] **Step 4: Delete the obsolete button**

```bash
git rm components/BotonTelegram.tsx
```

- [ ] **Step 5: Verify**

Run: `npm run lint` then `npm run build`
Expected: pass. Then in `npm run dev`, add a product from a product page → the drawer opens with the item and the header counter updates.

- [ ] **Step 6: Commit**

```bash
git add components/BotonAgregar.tsx components/ProductPurchase.tsx components/KitCustomizer.tsx
git commit -m "feat: add-to-cart on product pages"
```

---

### Task 9: `/cesta` page + checkout

**Files:**
- Create: `app/cesta/page.tsx`, `components/CestaCheckout.tsx`
- Test: manual.

**Interfaces:**
- Consumes: `useCesta()`, `DatosCliente`/`Datos`, `PROVINCIAS`, `telefonoValido`, `NEXT_PUBLIC_TELEGRAM_USERNAME`.
- Produces: the checkout form + confirmation + plan B.

- [ ] **Step 1: Create `components/CestaCheckout.tsx`**

```tsx
'use client';
import { useState } from 'react';
import DatosCliente, { type Datos } from './DatosCliente';
import { useCesta } from './CestaProvider';
import { telefonoValido } from '@/lib/cliente';
import { PROVINCIAS } from '@/lib/provincias';

const DATOS_VACIOS: Datos = { nombre: '', telefono: '', telegram: '' };
const TELEGRAM_USER = process.env.NEXT_PUBLIC_TELEGRAM_USERNAME;

export default function CestaCheckout() {
  const { items, vaciarCesta } = useCesta();
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS);
  const [provincia, setProvincia] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle');
  const [copiado, setCopiado] = useState(false);

  const listo = items.length > 0 && datos.nombre.trim() !== '' && telefonoValido(datos.telefono)
    && provincia !== '' && localidad.trim() !== '';

  const copiarPlanB = async () => {
    const texto = [
      'Presupuesto:',
      ...items.map((i, n) => `${n + 1}. ${i.title} — Talla ${i.talla}${i.color ? ` · ${i.color}` : ''} x${i.cantidad}`),
      `Nombre: ${datos.nombre}`,
      `Teléfono: ${datos.telefono}`,
      `Envío: ${localidad} (${provincia})`,
    ].join('\n');
    try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { /* ignore */ }
  };

  const enviar = async () => {
    setEstado('enviando');
    setCopiado(false);
    try {
      const r = await fetch('/api/presupuesto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items,
          cliente: {
            nombre: datos.nombre.trim(),
            telefono: datos.telefono.trim(),
            telegram: datos.telegram.trim() || undefined,
          },
          provincia,
          localidad: localidad.trim(),
          hp: '',
        }),
      });
      if (r.ok) { vaciarCesta(); setEstado('enviado'); return; }
    } catch { /* plan B */ }
    await copiarPlanB();
    setEstado('error');
  };

  if (estado === 'enviado') {
    return (
      <div className="rounded-2xl border border-line bg-mist p-8 text-center">
        <p className="font-display text-lg font-bold">¡Gracias! Te atenderemos lo antes posible</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Hemos recibido tu presupuesto. Te responderemos con el precio final y, si hay envío, con su coste.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DatosCliente valor={datos} onChange={setDatos} />

      <div className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Provincia *</span>
          <select value={provincia} onChange={(e) => setProvincia(e.target.value)} className="field">
            <option value="">Elige provincia</option>
            {PROVINCIAS.map((prov) => <option key={prov} value={prov}>{prov}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Localidad *</span>
          <input value={localidad} maxLength={80} onChange={(e) => setLocalidad(e.target.value)}
            placeholder="Tu localidad" className="field" />
        </label>
        <p className="text-xs text-muted sm:col-span-2">El envío es un extra; lo añadimos al presupuesto.</p>
      </div>

      <button
        type="button" onClick={enviar} disabled={!listo || estado === 'enviando'}
        className="flex w-full items-center justify-center rounded-full bg-ink py-3.5 font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {estado === 'enviando' ? 'Enviando…' : 'Obtener presupuesto'}
      </button>

      {estado === 'error' && (
        <p className="text-center text-xs text-muted">
          No se pudo enviar. {copiado ? 'Presupuesto copiado: ' : ''}
          {TELEGRAM_USER && (
            <a className="underline" href={`https://t.me/${TELEGRAM_USER}`} target="_blank" rel="noreferrer">escríbenos por Telegram</a>
          )}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/cesta/page.tsx` (client page)**

```tsx
'use client';
import Image from 'next/image';
import Link from 'next/link';
import CestaCheckout from '@/components/CestaCheckout';
import { useCesta } from '@/components/CestaProvider';
import { CANTIDAD_MAX } from '@/lib/cesta';

export default function CestaPage() {
  const { items, quitarItem, cambiarCantidad, total } = useCesta();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold tracking-tight">Tu cesta</h1>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-mist px-6 py-16 text-center">
          <p className="font-display text-lg font-bold">La cesta está vacía</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">Añade productos desde el catálogo para pedir un presupuesto.</p>
          <Link href="/catalogo" className="btn btn-light mt-5 inline-flex">Ver catálogo</Link>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-4">
            {items.map((it) => (
              <li key={it.id} className="flex gap-4 border-b border-line pb-4 last:border-0">
                {it.imageUrl && <Image src={it.imageUrl} alt="" width={80} height={80} className="h-20 w-20 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{it.title}</p>
                  <p className="text-xs text-muted">
                    {it.talla}{it.color ? ` · ${it.color}` : ''}{it.personalizacion ? ` · ${it.personalizacion}` : ''}
                    {it.parches?.length ? ` · ${it.parches.join(', ')}` : ''}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <input type="number" min={1} max={CANTIDAD_MAX} value={it.cantidad}
                      onChange={(e) => cambiarCantidad(it.id, Number(e.target.value))}
                      className="w-16 rounded border border-line px-2 py-1 text-sm" />
                    <button type="button" onClick={() => quitarItem(it.id)} className="text-xs text-red-500 hover:underline">Quitar</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-right text-sm text-muted">Total: {total} {total === 1 ? 'artículo' : 'artículos'}</p>
          <div className="mt-6"><CestaCheckout /></div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint` then `npm run build`
Expected: pass. In `npm run dev`, add two items, open `/cesta`, confirm the list, the province/localidad fields and the disabled-until-complete "Obtener presupuesto" button.

- [ ] **Step 4: Commit**

```bash
git add app/cesta/page.tsx components/CestaCheckout.tsx
git commit -m "feat: cart page and presupuesto checkout"
```

---

### Task 10: Cleanup old single-order path + final verification

**Files:**
- Delete: `app/api/pedido/route.ts`, `tests/telegram.test.ts`
- Modify: `lib/pedido.ts` (remove `validarPedido`, `construirMensaje`, `PedidoPayload`, `Validacion`; keep `escapeHtml`, `texto`, `esUrl`), `lib/telegram.ts` (remove `enviarPedido`), `tests/pedido.test.ts` (remove the `validarPedido`/`construirMensaje` describes; keep `escapeHtml` + `cliente helpers`)
- Check: nothing else imports the removed symbols.

**Interfaces:**
- Consumes: nothing new.
- Produces: a repo with a single order path (`/api/presupuesto`).

- [ ] **Step 1: Confirm the removed symbols are unused**

Run: `rg -n "validarPedido|construirMensaje|enviarPedido|PedidoPayload|api/pedido" app components lib tests --glob '!tests/pedido.test.ts' --glob '!tests/telegram.test.ts'`
Expected: no matches outside the files being deleted/edited.

- [ ] **Step 2: Delete the old route and its test**

```bash
git rm app/api/pedido/route.ts tests/telegram.test.ts
```

- [ ] **Step 3: Trim `lib/pedido.ts` and `lib/telegram.ts`**

Remove `PedidoPayload`, `Validacion`, `validarPedido`, `construirMensaje` from `lib/pedido.ts` (keep `escapeHtml`, `texto`, `esUrl` — still used by `validarItem`/`construirResumen`). Remove `enviarPedido` from `lib/telegram.ts` and drop `construirMensaje`/`PedidoPayload` from its import line.

- [ ] **Step 4: Trim `tests/pedido.test.ts`**

Delete the `describe('validarPedido', ...)` and `describe('construirMensaje', ...)` blocks. Keep `escapeHtml` and `cliente helpers`. Rename is optional; the file now only covers `lib/pedido`'s escaping and `lib/cliente`'s helpers.

- [ ] **Step 5: Run the full suite, lint and build**

Run: `npm test`
Expected: all suites pass (provincias, cesta, presupuesto, enviar-presupuesto, pedido (trimmed), resenas, brand-*, rate-limit).

Run: `npm run lint` then `npm run build`
Expected: both pass.

- [ ] **Step 6: End-to-end manual check**

With `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` set in `.env.local` and `npm run dev`: add 2 products with different options, open `/cesta`, fill name/phone/province/locality, press "Obtener presupuesto". Expect in Telegram: an album (or two photos) followed by the summary message; on the site: "¡Gracias! Te atenderemos lo antes posible" and an empty cart.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove the single-order Telegram path"
```

---

## Self-Review

**Spec coverage:**
- Add-to-cart from product pages → Task 8. ✅
- Drawe + `/cesta` page → Tasks 7 & 9. ✅
- Province dropdown + locality → Tasks 1, 3, 9. ✅
- Customer data only in the cart → Task 8 (removes `DatosCliente` from products) + Task 9. ✅
- sessionStorage persistence → Task 2 + Task 7. ✅
- Album + summary, batching, no-photo fallback → Tasks 4 & 5. ✅
- On-site confirmation "Te atenderemos lo antes posible" → Task 9. ✅
- Plan B (clipboard + `t.me`) → Task 9. ✅
- Validation/limits/honeypot/rate limit → Tasks 3 & 6. ✅
- Remove the old path → Task 10. ✅

**Placeholder scan:** none — every step has real code or an exact command.

**Type consistency:** `ItemPresupuesto` (Task 2) → `PresupuestoPayload`/`Cliente`/`validarPresupuesto` (Task 3) → `construirResumen`/`repartirAlbumes`/`construirPieAlbum` (Task 4) → `enviarPresupuesto` (Task 5) → route (Task 6) → `useCesta().agregarItem(OpcionesItem)` (Task 7) → product components (Task 8) → checkout (Task 9). Names match across tasks.

**Note on size:** this is a sizeable change (cart UI + new endpoint + sender). If you prefer review-sized PRs, split after Task 6 (backend: domain + sender + route, testable standalone) and Tasks 7–10 (frontend + cleanup).
