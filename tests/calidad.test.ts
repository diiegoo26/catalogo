import { describe, expect, it } from 'vitest';
import { conCalidad } from '../lib/calidad';

describe('conCalidad', () => {
  it('antepone la marca de la calidad al título', () => {
    expect(conCalidad('Equipación de local AC Milan 2026', 'fans'))
      .toBe('[Fans] Equipación de local AC Milan 2026');
    expect(conCalidad('Equipación de local AC Milan 2026', 'jugador'))
      .toBe('[Jugador] Equipación de local AC Milan 2026');
  });

  it('produce títulos distintos por calidad, para que no se fusionen en la cesta', () => {
    const base = 'Equipación de local AC Milan 2026';
    expect(conCalidad(base, 'fans')).not.toBe(conCalidad(base, 'jugador'));
  });
});