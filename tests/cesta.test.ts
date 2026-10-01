import { describe, it, expect } from 'vitest';
import {
  agregar, quitar, actualizarCantidad, vaciar, contar, totalEuros, hayPrecioPendiente,
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

  it('does not split lines on price, so the same item keeps merging', () => {
    expect(claveItem(base)).toBe(claveItem({ ...base, precio: 18 }));
    expect(claveItem({ ...base, precio: 18 })).toBe(claveItem({ ...base, precio: 25 }));
  });
});

describe('totalEuros / hayPrecioPendiente', () => {
  it('sums price × quantity across lines', () => {
    const items: ItemCesta[] = [
      { ...base, id: 'a', precio: 18, cantidad: 2 },
      { ...base, id: 'b', talla: 'L', precio: 60, cantidad: 1 },
    ];
    expect(totalEuros(items)).toBe(96);
    expect(hayPrecioPendiente(items)).toBe(false);
  });

  it('excludes null prices instead of counting them as 0', () => {
    const items: ItemCesta[] = [
      { ...base, id: 'a', precio: 18, cantidad: 2 },
      { ...base, id: 'b', talla: 'L', precio: null, cantidad: 1 },
    ];
    expect(totalEuros(items)).toBe(36);
    expect(hayPrecioPendiente(items)).toBe(true);
  });

  it('treats a missing price as pending', () => {
    const sinPrecio: ItemCesta[] = [{ ...base, id: 'a' }];
    expect(hayPrecioPendiente(sinPrecio)).toBe(true);
  });

  it('is zero and not pending on an empty cart', () => {
    expect(totalEuros([])).toBe(0);
    expect(hayPrecioPendiente([])).toBe(false);
  });
});

describe('serialize/deserialize + storage', () => {
  it('round-trips through a storage-like object', () => {
    const s = fakeStorage();
    const items: ItemCesta[] = [{ ...base, id: 'a', precio: 18 }];
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
  it('keeps a null price and a missing price', () => {
    const raw = JSON.stringify({ items: [
      { ...base, id: 'a', precio: null },
      { ...base, id: 'b', talla: 'L' },
    ] });
    expect(deserializar(raw)).toHaveLength(2);
  });
  it('drops lines with an invalid price instead of trusting stored data', () => {
    // NaN/Infinity no llegan aquí: JSON.stringify los convierte en null, que es
    // un valor válido ("a consultar"). Solo strings y negativos son inválidos.
    for (const precio of ['18', -1, true]) {
      const raw = JSON.stringify({ items: [{ ...base, id: 'a', precio }] });
      expect(deserializar(raw)).toEqual([]);
    }
  });
});
