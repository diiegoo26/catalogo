import { describe, it, expect } from 'vitest';
import { RECOMENDACIONES, TABLAS_TALLAS } from '../lib/guia-tallas';

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/u;

describe('RECOMENDACIONES', () => {
  it('has a recommendation per garment with copy and an icon', () => {
    expect(RECOMENDACIONES.length).toBeGreaterThan(0);
    for (const r of RECOMENDACIONES) {
      expect(r.prenda.trim()).not.toBe('');
      expect(r.resumen.trim()).not.toBe('');
      expect(r.detalle.length).toBeGreaterThan(0);
      expect(r.detalle.every((d) => d.trim() !== '')).toBe(true);
      expect(r.icono.trim()).not.toBe('');
    }
  });

  it('uses a unique garment name per recommendation', () => {
    const nombres = RECOMENDACIONES.map((r) => r.prenda);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});

describe('TABLAS_TALLAS', () => {
  it('has one cell per column in every row', () => {
    for (const t of TABLAS_TALLAS) {
      expect(t.columnas.length).toBeGreaterThan(0);
      expect(t.unidades).toHaveLength(t.columnas.length);
      for (const fila of t.filas) {
        expect(fila).toHaveLength(t.columnas.length);
      }
    }
  });

  it('covers the three tables shown to the owner', () => {
    expect(TABLAS_TALLAS.map((t) => t.titulo)).toEqual([
      'Versión jugador',
      'Versión aficionado',
      'Talla infantil',
    ]);
  });
});

describe('copy', () => {
  it('contains no emoji', () => {
    const texto = JSON.stringify({ RECOMENDACIONES, TABLAS_TALLAS });
    expect(EMOJI.test(texto)).toBe(false);
  });
});
