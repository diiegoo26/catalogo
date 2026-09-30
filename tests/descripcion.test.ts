import { describe, it, expect } from 'vitest';
import { descripcionVisible } from '../lib/descripcion';

describe('descripcionVisible', () => {
  it('hides the import boilerplate line', () => {
    expect(
      descripcionVisible('Producto importado desde https://www.replicascustom.com/product-page/x'),
    ).toBeNull();
  });

  it('returns a normal description trimmed', () => {
    expect(descripcionVisible('  Camiseta oficial 2024  ')).toBe('Camiseta oficial 2024');
  });

  it('returns null for null or empty input', () => {
    expect(descripcionVisible(null)).toBeNull();
    expect(descripcionVisible('')).toBeNull();
    expect(descripcionVisible(undefined)).toBeNull();
  });
});
