import { describe, it, expect } from 'vitest';
import { tallasParaCategoria, TALLAS_ROPA, TALLAS_CALZADO } from '../lib/tallas';

describe('tallasParaCategoria', () => {
  it('offers numeric sizes for footwear', () => {
    expect(tallasParaCategoria('calzado')).toEqual(TALLAS_CALZADO);
    expect(tallasParaCategoria('chanclas')).toEqual(TALLAS_CALZADO);
  });

  it('offers a single size for one-size categories', () => {
    for (const slug of ['accesorios', 'relojes', 'gorras', 'bolsos', 'perfumes']) {
      expect(tallasParaCategoria(slug)).toEqual(['Única']);
    }
  });

  it('offers clothing sizes by default', () => {
    expect(tallasParaCategoria('equipaciones')).toEqual(TALLAS_ROPA);
    expect(tallasParaCategoria('pantalones')).toEqual(TALLAS_ROPA);
    expect(tallasParaCategoria('desconocida')).toEqual(TALLAS_ROPA);
  });
});
