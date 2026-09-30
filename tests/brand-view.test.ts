import { describe, it, expect } from 'vitest';
import { brandViewMode } from '../lib/brand-view';

describe('brandViewMode', () => {
  it('renders the brand grid when there are two or more brands', () => {
    expect(brandViewMode(2)).toBe('grid');
    expect(brandViewMode(15)).toBe('grid');
  });

  it('skips the grid when there is exactly one brand', () => {
    expect(brandViewMode(1)).toBe('single');
  });

  it('falls back to the flat grid when there are no brands', () => {
    expect(brandViewMode(0)).toBe('none');
  });
});
