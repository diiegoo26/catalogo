import { describe, it, expect } from 'vitest';
import { validarPresupuesto, MAX_ITEMS, construirResumen, construirPieAlbum, repartirAlbumes } from '../lib/pedido';

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

describe('precios en el presupuesto', () => {
  const conPrecios = {
    items: [
      { title: 'Camiseta', productUrl: 'https://x.test/a', talla: 'M', cantidad: 2, precio: 18 },
      { title: 'Bufanda', productUrl: 'https://x.test/b', talla: 'Única', cantidad: 1, precio: 60 },
    ],
    cliente: { nombre: 'Ana', telefono: '612 345 678' },
    provincia: 'Madrid',
    localidad: 'Alcobendas',
  };

  it('accepts and keeps a valid unit price', () => {
    const r = validarPresupuesto({ ...base, items: [{ ...item, precio: 18 }] });
    expect(r).toEqual({ ok: true, presupuesto: { ...base, items: [{ ...item, precio: 18 }] } });
  });

  it('accepts a null price as "a consultar"', () => {
    const r = validarPresupuesto({ ...base, items: [{ ...item, precio: null }] });
    expect(r).toEqual({ ok: true, presupuesto: { ...base, items: [{ ...item, precio: null }] } });
  });

  it('rejects an invalid price', () => {
    for (const precio of ['18', -1, true]) {
      expect(validarPresupuesto({ ...base, items: [{ ...item, precio }] })).toEqual({ ok: false, error: 'precio' });
    }
  });

  it('shows unit price and line total per item', () => {
    const text = construirResumen(conPrecios);
    expect(text).toContain('💶');
    // 18 € × 2 = 36 € (el separador de Intl lleva espacio duro U+00A0)
    expect(text).toMatch(/18\u00A0€ × 2 = 36\u00A0€/);
    expect(text).toMatch(/60\u00A0€/);
  });

  it('shows the numeric total when every line has a price', () => {
    const text = construirResumen(conPrecios);
    expect(text).toMatch(/Total estimado: 96\u00A0€/);
  });

  it('shows "a confirmar" when any line is unpriced', () => {
    const text = construirResumen({
      ...conPrecios,
      items: [...conPrecios.items, { title: 'Gorra', productUrl: 'https://x.test/c', talla: 'Única', cantidad: 1 }],
    });
    expect(text).toContain('Total estimado: a confirmar');
    expect(text).toContain('Precio a consultar');
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
