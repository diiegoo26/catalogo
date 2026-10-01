import { describe, expect, it } from 'vitest';
import {
  distinctiveTokens, isDistinctiveToken, matchAll, normalizeKey,
  type ExistingProduct, type MatchCandidate,
} from '../lib/sudu/match';

const Nike01: ExistingProduct = { id: 'n1', title: 'Nike 01', slug: 'nike-01', brandKey: 'nike' };
const Nike07: ExistingProduct = { id: 'n7', title: 'Nike 07', slug: 'nike-07', brandKey: 'nike' };
const DslHd08: ExistingProduct = { id: 'd8', title: 'Dyson Supersonic (HD08)', slug: 'dyson-supersonic-hd08', brandKey: 'dyson' };
const TomFord: ExistingProduct = { id: 'tf', title: 'TOM FORD OUD WOOD 100ml', slug: 'tom-ford-oud-wood-100ml', brandKey: 'tom ford' };
const JblCharge: ExistingProduct = { id: 'j6', title: 'JBL CHARGE 6', slug: 'jbl-charge-6', brandKey: 'jbl' };
const EXISTING = [Nike01, Nike07, DslHd08, TomFord, JblCharge];
const BRANDS = new Set(['apple', 'jbl', 'the', 'north', 'face', 'dolce', 'gabbana', 'lululemon', 'dyson', 'nike', 'tom', 'ford']);

const rec = (title: string, brandKey: string): MatchCandidate => ({ title, brandKey });
const opts = { brandTokens: BRANDS };

describe('normalizeKey', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalizeKey('Dyson Supersonic (HD08)')).toBe('dyson supersonic hd08');
    expect(normalizeKey('Chanel N°5  100ml')).toBe('chanel n 5 100ml');
  });
});

describe('isDistinctiveToken', () => {
  it('accepts model tokens', () => {
    for (const t of ['hd08', 'charge6', 'boombox3', '100ml']) {
      expect(isDistinctiveToken(t)).toBe(true);
    }
  });
  it('rejects placeholders, generics and short tokens', () => {
    for (const t of ['01', '07', 'air', 'pro', 'max', 'ultra', 'edition', 'version', 'new', 'mini', 'the']) {
      expect(isDistinctiveToken(t)).toBe(false);
    }
  });
  it('rejects brand words when the brand vocabulary is supplied', () => {
    expect(isDistinctiveToken('stussy')).toBe(true);
    expect(isDistinctiveToken('stussy', new Set(['stussy']))).toBe(false);
  });
});

describe('distinctiveTokens', () => {
  it('deduplicates and drops brand and generic words', () => {
    expect(distinctiveTokens('JBL charge6 SPEAKER', new Set(['jbl', 'speaker'])))
      .toEqual(['charge6']);
  });
});

describe('matchAll', () => {
  it('matches at the safe tier on identical normalized titles', () => {
    const [r] = matchAll([rec('TOM FORD  OUD WOOD 100ml', 'tom ford')], EXISTING, opts);
    expect(r.tier).toBe('safe');
    expect(r.target?.id).toBe('tf');
  });

  it('takes the exact row even when a near-duplicate title exists', () => {
    const dupes: ExistingProduct[] = [
      { id: 'a', title: 'Nike Air Max 97', slug: 'nike-air-max-97', brandKey: 'nike' },
      { id: 'b', title: 'Nike Air Max 97 OG', slug: 'nike-air-max-97-og', brandKey: 'nike' },
    ];
    const [r] = matchAll([rec('Nike Air Max 97', 'nike')], dupes, opts);
    expect(r.tier).toBe('safe');
    expect(r.target?.id).toBe('a');
  });

  it('matches at the probable tier when a distinctive model token is shared', () => {
    const [r] = matchAll([rec('Dyson-HD08 HAIRDRYER', 'dyson')], EXISTING, opts);
    expect(r.tier).toBe('probable');
    expect(r.target?.id).toBe('d8');
    expect(r.reason).toContain('hd08');
  });

  it('does not treat a brand word as the shared token', () => {
    const local: ExistingProduct[] = [
      { id: 's1', title: 'Stussy Tee', slug: 'stussy-tee', brandKey: 'stussy' },
    ];
    const brandTokens = new Set(['stussy']);
    expect(matchAll([rec('Stussy Cap', 'stussy')], local, { brandTokens })[0].tier).toBe('none');
    // without the brand vocabulary the brand word itself would have matched it
    expect(matchAll([rec('Stussy Cap', 'stussy')], local)[0].tier).toBe('probable');
  });

  it('never matches across different brands', () => {
    const [r] = matchAll([rec('Charge6 SPEAKER', 'sony')], EXISTING, opts);
    expect(r.tier).toBe('none');
    expect(r.target).toBeNull();
  });

  it('refuses to guess when the only candidates are placeholder titles', () => {
    const [r] = matchAll([rec('Nike NOCTA Hot Step 2', 'nike')], EXISTING, opts);
    expect(r.tier).toBe('none');
    expect(r.target).toBeNull();
  });

  it('refuses to guess when two candidates qualify, and lists them', () => {
    const dupes: ExistingProduct[] = [
      { id: 'a', title: 'Nike Air Max 97 Retro', slug: 'nike-air-max-97-retro', brandKey: 'nike' },
      { id: 'b', title: 'Nike Air Max 97 Retro OG', slug: 'nike-air-max-97-retro-og', brandKey: 'nike' },
    ];
    const [r] = matchAll([rec('Nike Air Max 97 Retro 2', 'nike')], dupes, opts);
    expect(r.tier).toBe('none');
    expect(r.reason).toContain('2 candidates');
    expect(r.candidates.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('does not match charge6 to a catalog title that spells it charge 6', () => {
    const [r] = matchAll([rec('JBL charge6 SPEAKER', 'jbl')], EXISTING, opts);
    expect(r.tier).toBe('none');
  });

  it('reports nothing to match when the catalog is empty', () => {
    const [r] = matchAll([rec('JBL flip 6', 'jbl')], [], opts);
    expect(r.tier).toBe('none');
  });

  it('returns one result per input record, in input order', () => {
    const records = [rec('JBL flip 6', 'jbl'), rec('CB hoodies', ''), rec('Dyson-HD08 HAIRDRYER', 'dyson')];
    const results = matchAll(records, EXISTING, opts);
    expect(results).toHaveLength(3);
    expect(results[0].record.title).toBe('JBL flip 6');
    expect(results[2].tier).toBe('probable');
  });
});
