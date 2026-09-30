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
