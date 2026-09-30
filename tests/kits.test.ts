import { describe, it, expect } from 'vitest';
import { groupKitsByVariant, kitTitleFor } from '../lib/kits';

describe('groupKitsByVariant', () => {
  it('adds a full title to each variant', () => {
    const [home] = groupKitsByVariant(['13-barcelona-2024-home-kit-footylogos.webp']);
    expect(home.title).toBe('Equipación de local');

    const [away] = groupKitsByVariant(['13-barcelona-2024-away-kit-footylogos.webp']);
    expect(away.title).toBe('Equipación de visitante');
  });
});

describe('kitTitleFor', () => {
  it('maps known kinds to their full title', () => {
    expect(kitTitleFor('third')).toBe('Equipación de tercera');
  });
});
