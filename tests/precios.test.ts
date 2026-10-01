import { describe, expect, it } from 'vitest';
import {
  CALIDADES, ETIQUETA_CONSULTAR, PRECIO_FANS, PRECIO_JUGADOR, etiquetaPrecio, precioDe,
} from '../lib/precios';

describe('precioDe', () => {
  it('usa la calidad en las equipaciones, ignorando el precio propio', () => {
    expect(precioDe('equipaciones', null, 'fans')).toBe(PRECIO_FANS);
    expect(precioDe('equipaciones', null, 'jugador')).toBe(PRECIO_JUGADOR);
    // Aunque el producto traiga precio propio, la calidad manda en equipaciones.
    expect(precioDe('equipaciones', 99, 'fans')).toBe(PRECIO_FANS);
  });

  it('no devuelve precio de equipaciones sin calidad elegida', () => {
    // Nunca se llama así desde la UI (la calidad siempre está), pero evita que
    // el precio propio se cuele en una equipación si alguien lo usa mal.
    expect(precioDe('equipaciones', 99)).toBeNull();
  });

  it('el precio propio del producto gana sobre la regla de categoría', () => {
    expect(precioDe('sneakers', 45)).toBe(45);
  });

  it('aplica la regla de categoría cuando el producto no tiene precio', () => {
    expect(precioDe('sneakers', null)).toBe(60);
  });

  it('devuelve null en categorías sin precio ni regla', () => {
    for (const c of ['relojes', 'perfumes', 'packs', 'bolsos', 'accesorios', 'mandos']) {
      expect(precioDe(c, null)).toBeNull();
    }
  });

  it('ignora precios no finitos', () => {
    expect(precioDe('sneakers', NaN)).toBe(60);
    expect(precioDe('relojes', NaN)).toBeNull();
    expect(precioDe('relojes', Infinity)).toBeNull();
  });

  it('acepta precio 0 como precio real', () => {
    expect(precioDe('sneakers', 0)).toBe(0);
  });
});

describe('etiquetaPrecio', () => {
  it('formatea los importes en euros sin decimales', () => {
    // Intl usa espacio duro (U+00A0) antes del símbolo: se compara por puntos de código.
    const esperado = (n: number) => `60 €`.replace('60', String(n));
    expect(etiquetaPrecio(60)).toBe(esperado(60));
    expect(etiquetaPrecio(18)).toBe(esperado(18));
    // es-ES no agrupa los millares de cuatro dígitos (minimumGroupingDigits: 2).
    expect(etiquetaPrecio(1_234)).toBe(esperado(1234));
    expect(etiquetaPrecio(12_345)).toBe('12.345 €');
  });

  it('usa espacio duro antes del símbolo de euro', () => {
    const etiqueta = etiquetaPrecio(18);
    expect(etiqueta).toHaveLength(4);
    expect(etiqueta.charCodeAt(2)).toBe(0x00a0);
    expect(etiqueta.charAt(3)).toBe('€');
  });

  it('indica que hay que consultar cuando no hay precio', () => {
    expect(etiquetaPrecio(null)).toBe(ETIQUETA_CONSULTAR);
  });
});

describe('CALIDADES', () => {
  it('expone Fans y Jugador con su precio', () => {
    expect(CALIDADES).toEqual([
      { id: 'fans', label: 'Fans', precio: PRECIO_FANS },
      { id: 'jugador', label: 'Jugador', precio: PRECIO_JUGADOR },
    ]);
  });
});