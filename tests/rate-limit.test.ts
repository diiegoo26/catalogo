import { describe, it, expect, beforeEach } from 'vitest';
import { permitir, limpiarRateLimit } from '../lib/rate-limit';

beforeEach(() => limpiarRateLimit());

describe('permitir', () => {
  it('allows up to max hits in a window', () => {
    const t = 1_000_000;
    expect(permitir('ip', t, 3, 1000)).toBe(true);
    expect(permitir('ip', t + 1, 3, 1000)).toBe(true);
    expect(permitir('ip', t + 2, 3, 1000)).toBe(true);
    expect(permitir('ip', t + 3, 3, 1000)).toBe(false);
  });

  it('forgets hits older than the window', () => {
    expect(permitir('ip', 0, 1, 1000)).toBe(true);
    expect(permitir('ip', 500, 1, 1000)).toBe(false);
    expect(permitir('ip', 1001, 1, 1000)).toBe(true);
  });

  it('tracks keys independently', () => {
    expect(permitir('a', 0, 1, 1000)).toBe(true);
    expect(permitir('b', 0, 1, 1000)).toBe(true);
  });
});
