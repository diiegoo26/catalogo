// lib/sudu/match.ts
// Decides, for every workbook record, whether it already exists in the catalog.
// The governing rule is that a doubtful match must never be applied: a wrong
// match puts one product's photo on another product. Doubt resolves to 'none'.
//
// The shared evidence is an exact distinctive token, and a brand word is never
// evidence — otherwise any two products of the same one-product brand would
// "match" on the brand name alone.

export type MatchTier = 'safe' | 'probable' | 'none';

export type MatchCandidate = { title: string; brandKey: string };
export type ExistingProduct = { id: string; title: string; slug: string; brandKey: string };

export type MatchResult = {
  record: MatchCandidate;
  tier: MatchTier;
  target: ExistingProduct | null;
  candidates: ExistingProduct[];
  reason: string;
};

export type MatchOptions = { brandTokens?: ReadonlySet<string> };

/** Lowercase, accent-free, punctuation-free comparison key. */
export function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Words that carry no model identity: tier words, generations and generics. */
const STOPWORDS = new Set([
  'pro', 'max', 'mini', 'ultra', 'plus', 'new', 'gen', 'gen1', 'gen2', 'edition',
  'quality', 'version', 'serie', 'series', 'collection', 'type', 'model', 'style',
  'the', 'and', 'for', 'with', 'top', 'best',
]);

export function isDistinctiveToken(token: string, brandTokens: ReadonlySet<string> = new Set()): boolean {
  if (token.length < 4) return false;
  if (STOPWORDS.has(token)) return false;
  if (brandTokens.has(token)) return false;
  if (/^\d+$/.test(token)) return false;
  return true;
}

export function distinctiveTokens(text: string, brandTokens: ReadonlySet<string> = new Set()): string[] {
  return [...new Set(normalizeKey(text).split(' ').filter((t) => isDistinctiveToken(t, brandTokens)))];
}

export function matchAll(
  records: MatchCandidate[],
  existing: ExistingProduct[],
  options: MatchOptions = {},
): MatchResult[] {
  const brandTokens = options.brandTokens ?? new Set<string>();
  const byExact = new Map<string, ExistingProduct>();
  const byToken = new Map<string, ExistingProduct[]>();

  for (const product of existing) {
    const key = normalizeKey(product.title);
    if (key.length === 0) continue;
    // First writer wins, so a duplicated catalog title cannot silently decide
    // which row gets its imagery replaced.
    if (!byExact.has(key)) byExact.set(key, product);
    for (const token of distinctiveTokens(product.title, brandTokens)) {
      const bucket = byToken.get(token);
      if (bucket) bucket.push(product);
      else byToken.set(token, [product]);
    }
  }

  return records.map((record) => {
    const key = normalizeKey(record.title);

    const exact = byExact.get(key);
    if (exact) {
      return {
        record, tier: 'safe', target: exact, candidates: [exact],
        reason: 'identical normalized title',
      };
    }

    const shared: string[] = [];
    const candidates = new Map<string, ExistingProduct>();
    for (const token of distinctiveTokens(record.title, brandTokens)) {
      const bucket = byToken.get(token);
      if (!bucket) continue;
      let sawSameBrand = false;
      for (const product of bucket) {
        if (product.brandKey !== record.brandKey) continue;
        sawSameBrand = true;
        candidates.set(product.id, product);
      }
      if (sawSameBrand) shared.push(token);
    }

    const found = [...candidates.values()];
    if (found.length === 1) {
      return {
        record, tier: 'probable', target: found[0], candidates: found,
        reason: `shared distinctive token(s): ${shared.join(', ')}`,
      };
    }
    if (found.length > 1) {
      return {
        record, tier: 'none', target: null, candidates: found,
        reason: `${found.length} candidates share a token (${found.map((p) => p.slug).join(', ')}) — ambiguous`,
      };
    }
    return {
      record, tier: 'none', target: null, candidates: [],
      reason: 'no distinctive token in common with the catalog',
    };
  });
}
