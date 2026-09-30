import { describe, it, expect } from 'vitest';
import { PROVINCIAS } from '../lib/provincias';

describe('PROVINCIAS', () => {
  it('has the 52 Spanish provinces', () => {
    expect(PROVINCIAS).toHaveLength(52);
    expect(new Set(PROVINCIAS).size).toBe(52);
  });

  it('includes representative provinces', () => {
    expect(PROVINCIAS).toContain('Madrid');
    expect(PROVINCIAS).toContain('Barcelona');
    expect(PROVINCIAS).toContain('Las Palmas');
  });
});
