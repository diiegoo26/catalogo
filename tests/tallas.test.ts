import { describe, it, expect } from 'vitest';
import { tallasParaCategoria, tallasParaProducto, TALLAS_ROPA, TALLAS_CALZADO } from '../lib/tallas';

describe('tallasParaCategoria', () => {
  it('offers numeric sizes for footwear', () => {
    expect(tallasParaCategoria('sneakers')).toEqual(TALLAS_CALZADO);
    expect(tallasParaCategoria('chanclas')).toEqual(TALLAS_CALZADO);
  });

  it('offers foot sizes from 32 to 47', () => {
    expect(TALLAS_CALZADO).toHaveLength(16);
    expect(TALLAS_CALZADO[0]).toBe('32');
    expect(TALLAS_CALZADO.at(-1)).toBe('47');
  });

  it('offers a single size for one-size categories', () => {
    for (const slug of ['accesorios', 'relojes', 'gorras', 'bolsos', 'perfumes', 'auriculares', 'altavoces', 'cuidado-personal', 'mandos', 'packs']) {
      expect(tallasParaCategoria(slug)).toEqual(['Única']);
    }
  });

  it('offers clothing sizes by default', () => {
    expect(tallasParaCategoria('equipaciones')).toEqual(TALLAS_ROPA);
    expect(tallasParaCategoria('pantalones')).toEqual(TALLAS_ROPA);
    expect(tallasParaCategoria('desconocida')).toEqual(TALLAS_ROPA);
  });
});

describe('tallasParaProducto', () => {
  it('treats caps as one-size even when their category is streetwear', () => {
    expect(tallasParaProducto('streetwear', 'Gorra 01')).toEqual(['Única']);
    expect(tallasParaProducto('streetwear', 'GORRO 3')).toEqual(['Única']);
  });

  it('does not mistake a team name for a cap', () => {
    expect(tallasParaProducto('equipaciones', 'Equipación de local Vancouver Whitecaps 2026')).toEqual(TALLAS_ROPA);
  });

  it('falls back to the category rule for ordinary streetwear', () => {
    expect(tallasParaProducto('streetwear', 'Camiseta 01')).toEqual(TALLAS_ROPA);
    expect(tallasParaProducto('sneakers', 'Air Maxx 01')).toEqual(TALLAS_CALZADO);
    expect(tallasParaProducto('packs', 'Pack 04')).toEqual(['Única']);
  });
});
