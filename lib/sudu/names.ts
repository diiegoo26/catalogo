// lib/sudu/names.ts
// Pure text handling for the SUDU-Gadgets import: no I/O, no Supabase.
// Keeping this side-effect free is what makes the risky decisions
// (which brand, which category, which slug) exhaustively testable.

/** Zero-width and soft-hyphen characters scattered through the workbook. */
const INVISIBLE = /[\u200B-\u200F\uFEFF\u00AD]/g;

export type KnownBrand = { id: string; name: string; slug: string };
export type BrandHit = { brand: KnownBrand; rest: string } | null;
/** A brand candidate found in the name but absent from the database. Never auto-applied. */
export type ProposedBrand = { key: string; name: string; rest: string };

/** Supplier misspellings, keyed on the whole token so nothing is half-substituted. */
const BRAND_FIXES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bairpods\b/gi, 'AirPods'],
  [/\bboes\b/gi, 'Bose'],
  [/\bmashall\b/gi, 'Marshall'],
  [/\bmarshalll\b/gi, 'Marshall'],
  [/\bsnoy\b/gi, 'Sony'],
  [/\bluluemon\b/gi, 'lululemon'],
  [/\bcoetiz\b/gi, 'Corteiz'],
  [/\bgalleyr dept\b/gi, 'Gallery Dept'],
  [/\bphilp\b/gi, 'Philips'],
  [/\bbeffon\b/gi, 'Boffon'],
  [/\bsuperme\b/gi, 'Supreme'],
  [/\bpalkech\b/gi, 'Palace'],
];

/** Collapse invisible characters, newlines and repeated spaces. */
export function cleanName(raw: string): string {
  return raw.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

export function fixBrandSpellings(text: string): string {
  return BRAND_FIXES.reduce((acc, [re, to]) => acc.replace(re, to), text);
}

/** URL-safe slug. Accents stripped, everything non-alphanumeric becomes a hyphen. */
export function slugify(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base.slice(0, 80) : 'producto';
}

/** Allocate a free slug, recording it so later calls in the same run avoid it. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  taken.add(candidate);
  return candidate;
}

/** Brand names sorted longest-first so "The North Face" wins over a shorter prefix. */
function brandPrefixes(known: KnownBrand[]): Array<{ key: string; brand: KnownBrand }> {
  return known
    .filter((b) => b.name.trim().length > 0)
    .map((b) => ({ key: b.name.trim().toLowerCase(), brand: b }))
    .sort((a, b) => b.key.length - a.key.length);
}

/**
 * A brand counts as detected only when it *leads* the name. "High quality
 * Ralph Lauren Jacket" keeps no brand, because the supplier text starts with a
 * qualifier and guessing there would mislabel the product.
 */
export function detectBrand(cleaned: string, known: KnownBrand[]): BrandHit {
  const lower = cleaned.toLowerCase();
  for (const { key, brand } of brandPrefixes(known)) {
    if (lower === key) return { brand, rest: '' };
    if (lower.startsWith(`${key} `) || lower.startsWith(`${key}-`)) {
      return { brand, rest: cleaned.slice(brand.name.length).replace(/^[\s-]+/, '') };
    }
  }
  return null;
}

/**
 * Product-line hints, used only when no brand leads the name. These are lines
 * whose brand is unambiguous from the product name alone.
 */
const BRAND_HINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bairpods?\b/i, 'Apple'],
  [/\bip(hone|ad)\b/i, 'Apple'],
  [/\bmagsafe\b/i, 'Apple'],
  [/\bsamsung\b/i, 'Samsung'],
  [/\bgalaxy\b/i, 'Samsung'],
];

export function inferBrand(cleaned: string, known: KnownBrand[]): KnownBrand | null {
  const byName = new Map(known.map((b) => [b.name.trim().toLowerCase(), b]));
  for (const [re, brandName] of BRAND_HINTS) {
    if (!re.test(cleaned)) continue;
    const hit = byName.get(brandName.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/** Words that never name a brand: product lines, marketing grades and generics. */
const GENERIC_WORDS = new Set([
  // product lines already claimed by BRAND_HINTS
  'airpods', 'airpod', 'iphone', 'ipad', 'magsafe', 'galaxy', 'samsung',
  // marketing / grading
  'new', 'hot', 'sale', 'hot sale', 'top', 'best', 'premium', 'original', 'oem',
  'quality', 'high', 'luxury', 'fashion', 'casual', 'custom', 'wholesale', 'retail',
  'upgrade', 'latest', 'super', 'smart', 'digital', 'electronic', 'portable',
  'wireless', 'bluetooth', 'rechargeable', 'lithium',
  // grade / packaging
  'set', 'pack', 'gift', 'gift box', 'box', 'piece', 'pieces', 'pair',
  // apparel generics
  'shirt', 'tshirt', 't shirt', 'hoodie', 'sweater', 'jacket', 'coat', 'pants',
  'jeans', 'shorts', 'dress', 'skirt', 'socks', 'cap', 'hat', 'belt', 'wallet',
  'bag', 'backpack', 'sunglasses', 'glasses', 'boots', 'shoes', 'sneaker',
  'sneakers', 'slippers', 'jersey', 'cloth', 'clothes', 'clothing', 'outfit',
  'apparel', 'streetwear',
  // tech generics
  'speaker', 'speakers', 'earbuds', 'earpod', 'earphone', 'earphones', 'headphone',
  'headphones', 'watch', 'watches', 'phone', 'charger', 'adapter', 'cable', 'case',
  'cover', 'strap', 'band', 'holder', 'stand', 'mouse', 'pencil', 'keyboard',
  'vacuum', 'dryer', 'dryers', 'iron', 'brush', 'comb', 'trimmer', 'shaver',
  'perfume', 'cologne', 'parfum',
  // people / seasons / colours / fits
  'men', 'mens', 'women', 'womens', 'unisex', 'kids', 'adult', 'boy', 'girl',
  'summer', 'winter', 'spring', 'autumn', 'fall',
  'black', 'white', 'blue', 'red', 'green', 'pink', 'grey', 'gray', 'brown', 'beige',
  'large', 'small', 'mini', 'oversize', 'oversized', 'loose', 'slim', 'regular', 'fit',
  'print', 'printed', 'solid', 'plain', 'basic', 'classic', 'vintage', 'retro', 'trendy',
  'type', 'style', 'model', 'version', 'edition', 'collection', 'serie', 'series',
  'the', 'and', 'for', 'with',
]);

/**
 * A leading token that is not a known brand and not a generic word is a brand
 * *candidate*. It is never adopted automatically: build-plan.mjs lists it for
 * the owner to approve or rename in brand-approvals.json. Returns null when the
 * name cannot yield one — a one- or two-letter prefix is not enough evidence.
 */
export function proposeBrand(cleaned: string): ProposedBrand | null {
  const match = /^([A-Za-z][A-Za-z&.']{2,})([\s-].*)?$/.exec(cleaned.trim());
  if (!match) return null;
  const name = match[1];
  const rest = (match[2] ?? '').replace(/^[\s-]+/, '');
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!key || GENERIC_WORDS.has(key) || /^\d/.test(key)) return null;
  return { key, name, rest };
}

/** Workbook section → `categories.slug`. Sections not listed here must not be guessed. */
const SECTION_CATEGORY: Readonly<Record<string, string>> = {
  earbuds: 'auriculares',
  watches: 'relojes',
  speakers: 'altavoces',
  'mobile phones': 'moviles',
  'hair tools': 'cuidado-personal',
  'other accsessories': 'accesorios',
  perfumes: 'perfumes',
  't shirts': 'streetwear',
  'hoodies sweater jacket': 'streetwear',
  pants: 'streetwear',
  jersey: 'equipaciones',
  coats: 'streetwear',
  shoes: 'sneakers',
};

/** A name containing any of these words is a bag; everything else is not. */
const BAG_WORDS = ['bag', 'backpack', 'shoulder', 'tote', 'crossbody', 'duffle', 'satchel'] as const;

/** Lowercase and collapse every run of non-alphanumerics to one space. */
export function sectionKey(section: string): string {
  return section.replace(INVISIBLE, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function sectionToCategory(section: string, cleanedName: string): string | null {
  const key = sectionKey(section);
  if (key === 'bags and accessioes') {
    const words = cleanedName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
    return BAG_WORDS.some((w) => words.includes(w)) ? 'bolsos' : 'accesorios';
  }
  return SECTION_CATEGORY[key] ?? null;
}

/** Every header name the workbook uses, plus the `bags` split and the top-level grouping. */
export const SECTION_VOCABULARY: ReadonlySet<string> = new Set([
  'electronics',
  ...Object.keys(SECTION_CATEGORY),
  'bags and accessioes',
]);

/**
 * Keep the supplier's name. The brand is prepended only when it was *inferred*
 * (it does not lead the name already); when it was detected or proposed, the
 * name already starts with it and must not be duplicated.
 */
export function renderTitle(hit: BrandHit, inferred: KnownBrand | null, cleaned: string): string {
  if (hit || !inferred) return cleaned;
  const lead = cleaned.split(/[\s-]+/, 1)[0]?.toLowerCase() ?? '';
  if (lead === inferred.name.toLowerCase()) return cleaned;
  return `${inferred.name} ${cleaned}`;
}
