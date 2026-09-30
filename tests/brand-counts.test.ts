import { describe, it, expect } from 'vitest';
import { withCounts, withInnerProductTotals } from '../lib/brand-counts';

const row = (over: Partial<Parameters<typeof withCounts>[0][number]> = {}) => ({
  id: 'b1', name: 'Nike', slug: 'nike', logo_url: null, total: [{ count: 9 }], ...over,
});

describe('withCounts', () => {
  it('maps the PostgREST count aggregate onto product_count', () => {
    expect(withCounts([row()])).toEqual([
      { id: 'b1', name: 'Nike', slug: 'nike', logo_url: null, product_count: 9 },
    ]);
  });

  it('drops brands with zero products', () => {
    expect(withCounts([row({ total: [{ count: 0 }] }), row({ id: 'b2', slug: 'adidas', total: [{ count: 0 }] })])).toEqual([]);
  });

  it('treats a missing or empty aggregate as zero', () => {
    expect(withCounts([row({ total: undefined })])).toEqual([]);
    expect(withCounts([row({ total: [] })])).toEqual([]);
  });
});

describe('withInnerProductTotals', () => {
  const base = { id: 'b1', name: 'Nike', slug: 'nike', logo_url: null };

  it('maps the inner join payload length onto the total aggregate', () => {
    expect(withInnerProductTotals([{ ...base, inner_products: [{}, {}, {}] }])).toEqual([
      { ...base, inner_products: [{}, {}, {}], total: [{ count: 3 }] },
    ]);
  });

  it('maps a missing inner join payload to zero', () => {
    expect(withInnerProductTotals([{ ...base, inner_products: null }])).toEqual([
      { ...base, inner_products: null, total: [{ count: 0 }] },
    ]);
  });

  it('drives withCounts end to end through the production path', () => {
    expect(withCounts(withInnerProductTotals([{ ...base, inner_products: [{}, {}] }]))).toEqual([
      { ...base, product_count: 2 },
    ]);
  });
});
