import { describe, it, expect } from 'vitest';
import { diversificarPorCategoria } from '../lib/novedades';

/** Input arrives newest-first, exactly as the query returns it. */
const p = (id: string, category_id: string | null) => ({ id, category_id });

describe('diversificarPorCategoria', () => {
  it('draws from every category instead of flooding the list with the newest one', () => {
    const entrada = [
      p('a1', 'equipaciones'),
      p('a2', 'equipaciones'),
      p('a3', 'equipaciones'),
      p('b1', 'sneakers'),
      p('c1', 'relojes'),
    ];

    const salida = diversificarPorCategoria(entrada, { porCategoria: 2, max: 4 });

    expect(salida.map((x) => x.id)).toEqual(['a1', 'b1', 'c1', 'a2']);
  });

  it('takes at most porCategoria from any single category', () => {
    const entrada = [
      p('a1', 'equipaciones'),
      p('a2', 'equipaciones'),
      p('a3', 'equipaciones'),
      p('b1', 'sneakers'),
    ];

    const salida = diversificarPorCategoria(entrada, { porCategoria: 1, max: 10 });

    expect(salida.map((x) => x.id)).toEqual(['a1', 'b1']);
  });

  it('never returns more than max, even when more categories have products', () => {
    const entrada = [p('a1', 'a'), p('b1', 'b'), p('c1', 'c'), p('d1', 'd')];

    const salida = diversificarPorCategoria(entrada, { porCategoria: 2, max: 2 });

    expect(salida.map((x) => x.id)).toEqual(['a1', 'b1']);
  });

  it('keeps the newest product first', () => {
    const entrada = [p('nuevo', 'equipaciones'), p('viejo', 'sneakers')];

    const salida = diversificarPorCategoria(entrada, { porCategoria: 1, max: 2 });

    expect(salida[0].id).toBe('nuevo');
  });

  it('groups products with no category together instead of dropping them', () => {
    const entrada = [p('x1', null), p('y1', 'sneakers'), p('x2', null)];

    const salida = diversificarPorCategoria(entrada, { porCategoria: 2, max: 2 });

    expect(salida.map((x) => x.id)).toEqual(['x1', 'y1']);
  });

  it('returns an empty list for an empty input', () => {
    expect(diversificarPorCategoria([], { porCategoria: 2, max: 8 })).toEqual([]);
  });
});
