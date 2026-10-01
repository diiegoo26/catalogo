# SUDU-Gadgets 2026-9 Catalog Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the 2026-9 supplier workbook into the Supabase catalog — creating the products that do not exist yet and refreshing the imagery of the ones that do — without importing prices.

**Architecture:** Three phases with a human gate. (1) A Python extractor reads the workbook's OOXML parts directly and emits a raw `manifest.json` plus the photo bytes. (2) Pure TypeScript modules decide names, brands, categories and duplicate matching; this is where silent data corruption would live, so it is the only part with unit tests. (3) A Node script combines the manifest with a read-only database snapshot into `apply.sql`, a human-readable `report.md`, and the WebP assets. Nothing touches the database until that report is approved, and the SQL is then executed over the Supabase MCP channel.

**Tech Stack:** Python 3.13 standard library (`zipfile` + `xml.etree.ElementTree`; **no openpyxl**), TypeScript + vitest 4.1 (`environment: 'node'`), Node 24 native `.ts` type-stripping, `sharp` (JPEG/PNG → WebP), Supabase MCP SQL channel (all writes).

## Global Constraints

- **No prices, ever.** `lib/precios.ts` and any price columns are out of scope. The `products` table has no price column in the database.
- **Existing products are never rewritten.** For a matched product the only columns written are `images` and `is_featured`. `title`, `slug`, `brand_id`, `category_id`, `description`, `gender` and `season` are never modified on an existing row.
- **An existing product's images are never replaced with an empty array.** If asset conversion produced zero files, that row is skipped and reported — never updated.
- **New rows get `description = NULL`, `gender = NULL`, `season = NULL`.** No "Producto importado desde …" text; an earlier import wrote that into 288 descriptions and it later had to be hidden.
- **A workbook record is written exactly once.** No two workbook rows may target the same existing product; conflicting rows are reported and skipped.
- **Brands are never invented automatically.** A leading token that is not an existing brand becomes a *proposal* listed in `report.md`. Only brands present in `scripts/sudu/out/brand-approvals.json` are created.
- **Writes go through the Supabase MCP SQL channel only.** The anon key in `.env.local` cannot write: `products`, `categories` and `brands` each have exactly one `SELECT` policy for role `public` and no INSERT/UPDATE/DELETE policy. Scripts that use `.env.local` stay strictly read-only.
- **The working tree is already dirty** with unrelated in-progress price work (`lib/precios.ts`, `lib/calidad.ts`, `components/PrecioProducto.tsx`, `components/PrecioSelector.tsx`, `components/CompraEquipacion.tsx`, `tests/precios.test.ts`, `tests/calidad.test.ts`, `scripts/_captura-prod.mjs`, `scripts/_verifica-precios.mjs`, plus modifications to `app/producto/[slug]/page.tsx`, `components/KitCustomizer.tsx`, `components/ProductCard.tsx`, `components/ProductPurchase.tsx`, `lib/types.ts`, and untracked `.prod-desktop.png` / `.prod-mobile.png`). **Every `git add` names exact paths. Never use `git add .`, `git add -A` or `git commit -a`.**
- **Tests import with relative paths.** `tsconfig.json` has `"@/*": ["./*"]` but `vitest.config.ts` has no path-alias plugin, and every existing test uses `../lib/...`. Test files must use `../lib/sudu/...`.
- Tests are `tests/**/*.test.ts` only, `environment: 'node'` — no JSX, no DOM APIs.
- Source workbook path: `C:\Users\corra\Desktop\sudu-gadgets 2026-9.xlsx` (outside the repo; read-only, never modified).
- Images land in `public/productos/sudu/<slug>-<n>.webp`, matching the existing `public/productos/alice/` convention.

## The workbook census (authoritative)

Measured by reading `xl/worksheets/sheet1.xml`, `sheet2.xml`, `xl/sharedStrings.xml` and the two drawing parts directly. These numbers are the extraction contract:

| Fact | Value |
|---|---|
| Product rows (non-empty column A **and** a Weidian link) | **413** |
| Section-header rows | **15** (row 2 `Electronics` is a top-level grouping) |
| Rows skipped and reported | **4** — r1 sheet title, r3 `HOT SALE list !!!`, r5 `Modle` column header, r365 URL with no model name |
| Product rows with ≥ 1 embedded photo | **376** |
| Product rows with no photo | **37** (created with `images = []`) |
| Products carrying two photos | 6 — r109, r128, r166, r189, r200, r243 |
| Anchors in `drawing1.xml` | 384 (382 on product rows; 2 on section-header rows, ignored) |
| Distinct media files | **381** (374 `.jpg`, 7 `.png`), all referenced, 6.2 MiB total |
| `HOT SALE` rows | **41**, all `itemID`s already present in the main sheet; used only to set `is_featured` |
| Existing catalog | 2,180 products, 13 categories (`moviles` absent), 114 brands |

Two traps this census corrects, both of which silently corrupted earlier drafts:

1. **"Section header = no URL" is false.** r104 `Other accsessories` has no URL *and* carries a stray image anchor, and the sheet spells the hoodies header both `Hoodies & Sweater & Jacket` (r198) and `Hoodies & Sweater& jacket` (the column row). Using the wrong rule leaves `T-shirts` (r153) unset, and every product from r154 to r197 is then mis-categorised as `perfumes`. Sections come from a **fixed vocabulary**, never from a heuristic.
2. **The link is not always a hyperlink relationship.** 394 rows carry an `r:id` hyperlink, but 414 rows carry an `http` string in column F. A row is a product if *either* is present.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/sudu/names.ts` | Pure text: cleanup, brand spellings, brand detection/inference/proposal, section → category, title rendering, slugify + unique slug allocation |
| `tests/sudu-names.test.ts` | Unit tests for every function above |
| `lib/sudu/match.ts` | Pure matching: normalization key, distinctive-token test, three-tier assignment over the whole record set |
| `tests/sudu-match.test.ts` | Unit tests for the tiers, the ambiguity guard and the brand-token exclusion |
| `scripts/sudu/extract.py` | Workbook → `out/manifest.json` + `out/media/*`. No database access, stdlib only |
| `scripts/sudu/build-plan.mjs` | Manifest + DB snapshot → `out/report.md`, `out/apply.sql`, `out/apply-plan.json`, `out/brand-proposals.json`, and WebP assets |
| `scripts/sudu/verify.mjs` | Read-only post-apply assertions printed as PASS/FAIL |
| `scripts/sudu/out/` | Git-ignored scratch: manifest, media, report, SQL, plan JSON |
| `.gitignore` | Ignore `scripts/sudu/out/` |

---

### Task 1: Name, brand and category logic

Pure functions only. No I/O, no Supabase — which is what makes them cheap to test exhaustively.

**Files:**
- Create: `lib/sudu/names.ts`
- Test: `tests/sudu-names.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  ```ts
  export type KnownBrand = { id: string; name: string; slug: string };
  export type BrandHit = { brand: KnownBrand; rest: string } | null;
  export type ProposedBrand = { key: string; name: string; rest: string };
  export function cleanName(raw: string): string
  export function fixBrandSpellings(text: string): string
  export function slugify(text: string): string
  export function uniqueSlug(base: string, taken: Set<string>): string
  export function detectBrand(cleaned: string, known: KnownBrand[]): BrandHit
  export function inferBrand(cleaned: string, known: KnownBrand[]): KnownBrand | null
  export function proposeBrand(cleaned: string): ProposedBrand | null
  export function sectionKey(section: string): string
  export function sectionToCategory(section: string, cleanedName: string): string | null
  export const SECTION_VOCABULARY: ReadonlySet<string>
  export function renderTitle(hit: BrandHit, inferred: KnownBrand | null, cleaned: string): string
  ```
  `sectionToCategory` returns a `categories.slug` or `null` when the section is unrecognised (the caller reports, never guesses). `SECTION_VOCABULARY` is the 15 header names, already normalised, used by the extractor's classification tests.

- [ ] **Step 1: Write the failing test**

Create `tests/sudu-names.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  cleanName, detectBrand, fixBrandSpellings, inferBrand, proposeBrand,
  renderTitle, sectionKey, sectionToCategory, slugify, uniqueSlug,
  SECTION_VOCABULARY,
  type KnownBrand,
} from '../lib/sudu/names';

const KNOWN: KnownBrand[] = [
  { id: '1', name: 'Apple', slug: 'apple' },
  { id: '2', name: 'JBL', slug: 'jbl' },
  { id: '3', name: 'The North Face', slug: 'the-north-face' },
  { id: '4', name: 'Dolce & Gabbana', slug: 'dolce-gabbana' },
  { id: '5', name: 'lululemon', slug: 'lululemon' },
  { id: '6', name: 'Dyson', slug: 'dyson' },
];

describe('cleanName', () => {
  it('strips zero-width characters the workbook is full of', () => {
    expect(cleanName('\u200bDolce & Gabbana')).toBe('Dolce & Gabbana');
  });
  it('collapses embedded newlines and runs of spaces into single spaces', () => {
    expect(cleanName('Ralph Lauren \n round neck short sleeved shirt'))
      .toBe('Ralph Lauren round neck short sleeved shirt');
    expect(cleanName('Ralph Lauren \n(linen fabric)\n long sleeved'))
      .toBe('Ralph Lauren (linen fabric) long sleeved');
  });
  it('trims surrounding whitespace', () => {
    expect(cleanName('  HERMES  ')).toBe('HERMES');
  });
  it('returns an empty string for a blank cell', () => {
    expect(cleanName('   ')).toBe('');
  });
});

describe('fixBrandSpellings', () => {
  it.each([
    ['Airpods pro 3', 'AirPods pro 3'],
    ['Boes quietcomfort urtra', 'Bose quietcomfort urtra'],
    ['Mashall motif anc', 'Marshall motif anc'],
    ['Marshall MAJORV 5', 'Marshall MAJORV 5'],
    ['Snoy Ps5  controller', 'Sony Ps5  controller'],
    ['Luluemon yoga pants', 'lululemon yoga pants'],
    ['Coetiz Island Hoodie', 'Corteiz Island Hoodie'],
    ['Galleyr Dept jeans', 'Gallery Dept jeans'],
    ['Philp S9000', 'Philips S9000'],
    ['BEFFON slippersv', 'Boffon slippersv'],
    ['Superme bag', 'Supreme bag'],
    ['Palkech pants', 'Palace pants'],
  ])('corrects %s', (input, expected) => {
    expect(fixBrandSpellings(input)).toBe(expected);
  });
  it('leaves an already-correct name untouched', () => {
    expect(fixBrandSpellings('Nike Air Max 95 OG Neon')).toBe('Nike Air Max 95 OG Neon');
  });
});

describe('slugify', () => {
  it('lowercases, strips accents and joins words with hyphens', () => {
    expect(slugify('Dyson Supersonic (HD08)')).toBe('dyson-supersonic-hd08');
  });
  it('never returns an empty string', () => {
    expect(slugify('!!!').length).toBeGreaterThan(0);
  });
});

describe('uniqueSlug', () => {
  it('returns the base when free', () => {
    const taken = new Set<string>();
    expect(uniqueSlug('jbl-flip-7', taken)).toBe('jbl-flip-7');
  });
  it('suffixes -2, -3 until free and records each allocation', () => {
    const taken = new Set<string>(['jbl-flip-7', 'jbl-flip-7-2']);
    expect(uniqueSlug('jbl-flip-7', taken)).toBe('jbl-flip-7-3');
    expect(taken.has('jbl-flip-7-3')).toBe(true);
  });
});

describe('detectBrand', () => {
  it('detects a single-word brand prefix and returns the remainder', () => {
    expect(detectBrand('JBL charge6 SPEAKER', KNOWN)).toEqual({
      brand: KNOWN[1], rest: 'charge6 SPEAKER',
    });
  });
  it('detects a multi-word brand prefix', () => {
    expect(detectBrand('The North Face vest', KNOWN)?.brand).toEqual(KNOWN[2]);
  });
  it('matches case-insensitively', () => {
    expect(detectBrand('jbl flip 6', KNOWN)?.brand.slug).toBe('jbl');
  });
  it('returns null when the name starts with no known brand', () => {
    expect(detectBrand('AirPods Pro 3', KNOWN)).toBeNull();
  });
  it('does not treat a mid-name brand word as the prefix brand', () => {
    expect(detectBrand('High quality Ralph Lauren Jacket', KNOWN)).toBeNull();
  });
});

describe('inferBrand', () => {
  it('infers Apple from AirPods when no brand token leads the name', () => {
    expect(inferBrand('AirPods pro 3 (ANC/NO ANC)', KNOWN)?.slug).toBe('apple');
  });
  it('infers Apple from iPhone and iPad', () => {
    expect(inferBrand('iphone 18 pro max', KNOWN)?.slug).toBe('apple');
    expect(inferBrand('Apple Pencil Pro', KNOWN)).toBeNull();
  });
  it('infers nothing from a name it does not recognise', () => {
    expect(inferBrand('CB hoodies', KNOWN)).toBeNull();
  });
});

describe('proposeBrand', () => {
  it('proposes an unknown leading word', () => {
    expect(proposeBrand('Stussy Wallet')).toEqual({ key: 'stussy', name: 'Stussy', rest: 'Wallet' });
    expect(proposeBrand('XERJOFF')).toEqual({ key: 'xerjoff', name: 'XERJOFF', rest: '' });
  });
  it('refuses generic leading words', () => {
    for (const name of ['Wireless Bluetooth Speaker', 'New Style Hoodie', 'Hot Sale Bag', 'Gift Box']) {
      expect(proposeBrand(name)).toBeNull();
    }
  });
  it('refuses product lines that are handled by inferBrand instead', () => {
    for (const name of ['iphone 18 pro max', 'AirPods pro 3', 'Samsung Buds3 pro']) {
      expect(proposeBrand(name)).toBeNull();
    }
  });
  it('refuses tokens shorter than three letters or starting with a digit', () => {
    expect(proposeBrand('CB hoodies')).toBeNull();
    expect(proposeBrand('LV black crossbody shoulder bag')).toBeNull();
  });
});

describe('sectionToCategory', () => {
  it.each([
    ['Earbuds', 'Airpods pro 3', 'auriculares'],
    ['Watches', 'Apple watch S11', 'relojes'],
    ['Speakers', 'JBL G03 SPEAKER', 'altavoces'],
    ['Mobile phones', 'iphone 18 pro max', 'moviles'],
    ['Hair tools', 'Dyson-HD08 HAIRDRYER', 'cuidado-personal'],
    ['Other accsessories', 'Magsafe 15W charger', 'accesorios'],
    ['Perfumes', 'Chanel No. 5 100ml', 'perfumes'],
    ['T-shirts', 'Ralph Lauren City Series', 'streetwear'],
    ['Hoodies & Sweater & Jacket', 'Stussy hoodie', 'streetwear'],
    ['Pants', 'AMIRI jeans', 'streetwear'],
    ['Jersey', '24-25 Real Madrid Club player football jersey', 'equipaciones'],
    ['Coats', 'Canada Goose Cotton Coat', 'streetwear'],
    ['Shoes', 'Nike Air Max 95 OG Neon', 'sneakers'],
  ])('maps section %s to %s', (section, name, expected) => {
    expect(sectionToCategory(section, name)).toBe(expected);
  });

  it('normalises the section spelling the workbook actually uses', () => {
    expect(sectionToCategory('Hoodies & Sweater& jacket', 'x')).toBe('streetwear');
    expect(sectionToCategory('T Shirts', 'x')).toBe('streetwear');
    expect(sectionToCategory('t-shirts', 'x')).toBe('streetwear');
    expect(sectionToCategory('Other accsessories', 'x')).toBe('accesorios');
  });

  it('sends a bag to bolsos and everything else in the section to accesorios', () => {
    expect(sectionToCategory('Bags and accessioes', 'LV black crossbody shoulder bag')).toBe('bolsos');
    expect(sectionToCategory('Bags and accessioes', 'Nike NOCTA backpack')).toBe('bolsos');
    expect(sectionToCategory('Bags and accessioes', 'Stussy Wallet')).toBe('accesorios');
    expect(sectionToCategory('Bags and accessioes', 'RayBan sunglasses')).toBe('accesorios');
    expect(sectionToCategory('Bags and accessioes', 'Carhartt belt')).toBe('accesorios');
  });

  it('returns null for a top-level grouping or an unrecognised section', () => {
    expect(sectionToCategory('Electronics', 'whatever')).toBeNull();
    expect(sectionToCategory('Mystery Bin', 'whatever')).toBeNull();
    expect(sectionToCategory('', 'whatever')).toBeNull();
  });

  it('knows exactly the fifteen header names the workbook uses', () => {
    expect(SECTION_VOCABULARY.size).toBe(15);
    for (const name of ['electronics', 'earbuds', 't shirts', 'hoodies sweater jacket', 'bags and accessioes']) {
      expect(SECTION_VOCABULARY.has(name)).toBe(true);
    }
  });
});

describe('sectionKey', () => {
  it('lowercases and collapses every non-alphanumeric run to one space', () => {
    expect(sectionKey('Hoodies & Sweater& jacket')).toBe('hoodies sweater jacket');
    expect(sectionKey('T-shirts')).toBe('t shirts');
    expect(sectionKey('  Other   accsessories ')).toBe('other accsessories');
  });
});

describe('renderTitle', () => {
  it('leaves the name alone when the brand leads it already', () => {
    expect(renderTitle(detectBrand('JBL flip 6', KNOWN), null, 'JBL flip 6')).toBe('JBL flip 6');
  });
  it('returns the cleaned name when no brand was found', () => {
    expect(renderTitle(null, null, 'CB hoodies')).toBe('CB hoodies');
  });
  it('prepends the inferred brand when the brand does not lead the name', () => {
    expect(renderTitle(null, KNOWN[0], 'AirPods pro 3 (ANC/NO ANC)'))
      .toBe('Apple AirPods pro 3 (ANC/NO ANC)');
  });
  it('does not prepend a brand that already leads the name', () => {
    expect(renderTitle(null, { id: '9', name: 'Stussy', slug: 'stussy' }, 'Stussy Wallet'))
      .toBe('Stussy Wallet');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sudu-names.test.ts`
Expected: FAIL — cannot resolve `../lib/sudu/names`.

- [ ] **Step 3: Write the implementation**

Create `lib/sudu/names.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/sudu-names.test.ts`
Expected: PASS, all tests green.

If `proposeBrand('iphone 18 pro max')` returns an object, `iphone` is missing from `GENERIC_WORDS` — add it rather than loosening the test.

- [ ] **Step 5: Commit**

```bash
git add -- lib/sudu/names.ts tests/sudu-names.test.ts
git commit -m "feat: add SUDU import name, brand and category logic"
```

---

### Task 2: Three-tier duplicate matching

The safety property under test: when the existing catalog holds placeholder titles (`Nike 01`), the matcher must refuse to guess, and a brand word must never be the evidence that two products are the same.

**Files:**
- Create: `lib/sudu/match.ts`
- Test: `tests/sudu-match.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (intentionally independent — matching must not inherit normalization mistakes).
- Produces:
  ```ts
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
  export function normalizeKey(text: string): string
  export function isDistinctiveToken(token: string, brandTokens?: ReadonlySet<string>): boolean
  export function distinctiveTokens(text: string, brandTokens?: ReadonlySet<string>): string[]
  export function matchAll(records: MatchCandidate[], existing: ExistingProduct[], options?: MatchOptions): MatchResult[]
  ```
  Matching is **exact token equality after normalization** — the design's rule. `charge6` does *not* match `charge 6`; that pair is reported as unmatched for a human to rule on, never guessed.

- [ ] **Step 1: Write the failing test**

Create `tests/sudu-match.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sudu-match.test.ts`
Expected: FAIL — cannot resolve `../lib/sudu/match`.

- [ ] **Step 3: Write the implementation**

Create `lib/sudu/match.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/sudu-match.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add -- lib/sudu/match.ts tests/sudu-match.test.ts
git commit -m "feat: add three-tier duplicate matching for the SUDU import"
```

---

### Task 3: Workbook extractor

Reads the OOXML parts directly with the standard library. Touches no database — running it is always safe. It deliberately avoids `openpyxl`: the previous draft's `openpyxl` + "no URL means section header" approach both missed 21 content rows and mis-categorised every `T-shirts` product.

**Files:**
- Create: `scripts/sudu/extract.py`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `scripts/sudu/out/manifest.json`:
    ```json
    {
      "source": "sudu-gadgets 2026-9.xlsx",
      "hot_sale_weidian_ids": ["7574430064"],
      "records": [
        { "row": 7, "section": "Earbuds", "raw_name": "Airpods pro 3（ANC/NO Anc）",
          "weidian_id": "7574430064", "images": ["image35.jpg"] }
      ],
      "skipped": [
        { "row": 365, "reason": "url but no model name in column A" },
        { "row": 1, "reason": "not a section header and not a product row" }
      ]
    }
    ```
  - `scripts/sudu/out/media/<name>.jpg|.png` — the raw photo bytes for every anchored image.

- [ ] **Step 1: Add the ignore rule**

Append to `.gitignore`:

```gitignore
# SUDU import scratch (regenerated by scripts/sudu/extract.py)
scripts/sudu/out/
```

- [ ] **Step 2: Write the extractor**

Create `scripts/sudu/extract.py`:

```python
"""Extract the SUDU-Gadgets workbook into a manifest plus raw photo bytes.

Reads the OOXML package directly with the standard library: cell values through
sharedStrings, Weidian links through the sheet's hyperlink relationships, and the
embedded photos through the drawing anchors mapped to their owning row. Standard
library only, no database access, no third-party dependency.
"""

from __future__ import annotations

import json
import posixpath
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

SOURCE = Path(r"C:\Users\corra\Desktop\sudu-gadgets 2026-9.xlsx")
OUT_DIR = Path(__file__).resolve().parent / "out"
MEDIA_DIR = OUT_DIR / "media"

MAIN_SHEET = "xl/worksheets/sheet1.xml"
MAIN_DRAWING = "xl/drawings/drawing1.xml"
HOT_SHEET = "xl/worksheets/sheet2.xml"

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
XDR = "{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"

# The fixed section vocabulary, already normalised (lowercase, non-alphanumeric
# runs collapsed to one space). Derived by inspection of both header spellings
# the workbook uses; never inferred from "this row has no URL".
SECTIONS = {
    "electronics", "earbuds", "watches", "speakers", "mobile phones", "hair tools",
    "other accsessories", "perfumes", "t shirts", "hoodies sweater jacket", "pants",
    "jersey", "coats", "bags and accessioes", "shoes",
}

ITEM_ID = re.compile(r"itemID=(\d+)")


def section_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.replace("\u200b", "").lower()).strip()


def col_index(ref: str) -> int | None:
    match = re.match(r"([A-Z]+)", ref or "")
    if not match:
        return None
    n = 0
    for ch in match.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n


def part_rels(zf: zipfile.ZipFile, part: str) -> dict[str, str]:
    directory, base = posixpath.split(part)
    path = f"{directory}/_rels/{base}.rels" if directory else f"_rels/{base}.rels"
    if path not in zf.namelist():
        return {}
    root = ET.fromstring(zf.read(path))
    return {e.get("Id"): e.get("Target") for e in root}


def anchors_by_row(zf: zipfile.ZipFile, drawing_part: str) -> dict[int, list[str]]:
    """Map 1-based sheet row -> media file names anchored to it."""
    if drawing_part not in zf.namelist():
        return {}
    rels = part_rels(zf, drawing_part)
    id_to_media = {k: v.split("/")[-1] for k, v in rels.items() if "media/" in v}
    out: dict[int, list[str]] = {}
    for anchor in ET.fromstring(zf.read(drawing_part)).iter(XDR + "oneCellAnchor"):
        origin = anchor.find(XDR + "from")
        if origin is None:
            continue
        row_el = origin.find(XDR + "row")
        if row_el is None or row_el.text is None:
            continue
        row = int(row_el.text) + 1
        for blip in anchor.iter(A + "blip"):
            media = id_to_media.get(blip.get(R + "embed"))
            if media:
                out.setdefault(row, []).append(media)
    return out


class Sheet:
    """Resolved cell values and hyperlink targets for one worksheet."""

    def __init__(self, zf: zipfile.ZipFile, part: str, shared: list[str]) -> None:
        self.part = part
        self.shared = shared
        self.values: dict[int, dict[int, str]] = {}
        self.links: dict[int, str] = {}
        root = ET.fromstring(zf.read(part))
        rels = part_rels(zf, part)
        for row in root.iter(M + "row"):
            number = int(row.get("r"))
            cells: dict[int, str] = {}
            for cell in row.findall(M + "c"):
                index = col_index(cell.get("r"))
                if index is not None:
                    cells[index] = self._value(cell)
            self.values[number] = cells
        for link in root.iter(M + "hyperlink"):
            target = rels.get(link.get(R + "id"))
            match = re.match(r"([A-Z]+)(\d+)", link.get("ref") or "")
            if target and target.startswith("http") and match:
                self.links[int(match.group(2))] = target

    def _value(self, cell: ET.Element) -> str:
        kind = cell.get("t")
        if kind == "s":
            v = cell.find(M + "v")
            return self.shared[int(v.text)] if v is not None and v.text is not None else ""
        if kind == "inlineStr":
            return "".join(t.text or "" for t in cell.iter(M + "t"))
        v = cell.find(M + "v")
        return v.text if v is not None and v.text is not None else ""

    def text(self, row: int, col: int) -> str:
        return (self.values.get(row, {}).get(col) or "").strip()

    def url(self, row: int) -> str | None:
        cell = self.text(row, 6)
        if cell.startswith("http"):
            return cell
        return self.links.get(row)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if not SOURCE.exists():
        raise SystemExit(f"Workbook not found: {SOURCE}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(SOURCE) as zf:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            for si in ET.fromstring(zf.read("xl/sharedStrings.xml")).findall(M + "si"):
                shared.append("".join(t.text or "" for t in si.iter(M + "t")))

        main = Sheet(zf, MAIN_SHEET, shared)
        hot = Sheet(zf, HOT_SHEET, shared)
        anchors = anchors_by_row(zf, MAIN_DRAWING)

        records: list[dict] = []
        skipped: list[dict] = []
        section = ""

        for row in sorted(main.values):
            name = main.text(row, 1)
            url = main.url(row)
            if not name:
                if url:
                    skipped.append({"row": row, "reason": "url but no model name in column A"})
                continue
            if not url:
                # A no-URL row is a section header only when it is in the fixed
                # vocabulary. Rows 1/3/5 (sheet title, "HOT SALE list !!!", the
                # "Modle" column header) are neither: they are expected, and they
                # are reported in `skipped` for the human to confirm.
                if section_key(name) in SECTIONS:
                    section = name
                else:
                    skipped.append({"row": row, "reason": "not a section header and not a product row"})
                continue
            match = ITEM_ID.search(url)
            records.append({
                "row": row,
                "section": section,
                "raw_name": name,
                "weidian_id": match.group(1) if match else None,
                "images": anchors.get(row, []),
            })

        hot_ids: list[str] = []
        for row in sorted(hot.values):
            url = hot.url(row)
            match = ITEM_ID.search(url) if url else None
            if match:
                hot_ids.append(match.group(1))

        needed = {m for media in anchors.values() for m in media}
        for name in sorted(needed):
            (MEDIA_DIR / name).write_bytes(zf.read(f"xl/media/{name}"))

    manifest = {
        "source": SOURCE.name,
        "hot_sale_weidian_ids": sorted(set(hot_ids)),
        "records": records,
        "skipped": skipped,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    with_image = sum(1 for r in records if r["images"])
    multi = sum(1 for r in records if len(r["images"]) > 1)
    print(f"records            : {len(records)}")
    print(f"  with >=1 image   : {with_image}")
    print(f"  with 2 images    : {multi}")
    print(f"  without image    : {len(records) - with_image}")
    print(f"skipped            : {len(skipped)}")
    print(f"hot sale entries   : {len(set(hot_ids))}")
    print(f"media written      : {len(needed)} -> {MEDIA_DIR}")
    counts = Counter(r["section"] for r in records)
    print(f"product sections   : {len(counts)}")
    for name in sorted(counts):
        print(f"  {counts[name]:>3}  {name}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the extractor**

Run: `python scripts/sudu/extract.py`
Expected output — these numbers are the contract:

```
records            : 413
  with >=1 image   : 376
  with 2 images    : 6
  without image    : 37
skipped            : 4
hot sale entries   : 41
media written      : 381 -> ...\scripts\sudu\out\media
product sections   : 14
   19  Bags and accessioes
   12  Coats
   42  Earbuds
   18  Hair tools
   87  Hoodies & Sweater & Jacket
   18  Jersey
    8  Mobile phones
   26  Other accsessories
   26  Pants
   21  Perfumes
   67  Shoes
   16  Speakers
   44  T-shirts
    9  Watches
```

The per-section lines are right-aligned in three columns; compare the counts, not the spacing.

Rows 1, 3 and 5 (sheet title, `HOT SALE list !!!`, the `Modle` column header) are expected skips and appear in the manifest `skipped` array alongside row 365. **If `records` is not 413, or `product sections` is not 14, stop and investigate before continuing.** A section name missing from the fixed vocabulary makes every later product silently inherit the previous section — that is exactly how the earlier draft sent the 44 `T-shirts` products to `perfumes`.

- [ ] **Step 4: Verify the manifest shape**

Run:

```powershell
python -c "import json;d=json.load(open(r'scripts/sudu/out/manifest.json',encoding='utf-8'));print(len(d['records']));print(d['records'][0]);print(len({r['section'] for r in d['records']}));print(d['skipped'])"
```

Expected: `413`, a row-7 record under section `Earbuds` carrying `image35.jpg`, `14` distinct product sections (the 15th header, `Electronics`, has no products of its own), and 4 skipped rows.

- [ ] **Step 5: Commit**

```bash
git add -- .gitignore scripts/sudu/extract.py
git commit -m "feat: extract the SUDU-Gadgets workbook into a manifest"
```

---

### Task 4: Plan builder — assets, report and SQL

The reviewable output. Produces the SQL; does not run it.

**Files:**
- Create: `scripts/sudu/build-plan.mjs`
- Create (git-ignored): `scripts/sudu/out/report.md`, `scripts/sudu/out/apply.sql`, `scripts/sudu/out/apply-plan.json`, `scripts/sudu/out/brand-proposals.json`
- Create (generated assets): `public/productos/sudu/*.webp`

**Interfaces:**
- Consumes: `cleanName`, `fixBrandSpellings`, `slugify`, `uniqueSlug`, `detectBrand`, `inferBrand`, `proposeBrand`, `sectionToCategory`, `renderTitle` from `lib/sudu/names.ts`; `normalizeKey`, `matchAll` from `lib/sudu/match.ts`; `scripts/sudu/out/manifest.json`; `.env.local`; optionally `scripts/sudu/out/brand-approvals.json`.
- Produces: `out/report.md`, `out/apply.sql`, `out/apply-plan.json`, `out/brand-proposals.json`, `public/productos/sudu/<slug>-<n>.webp`.

Every record lands in exactly one bucket, and the buckets must sum to 413:

| Bucket | Meaning |
|---|---|
| `updated` | safe/probable match, photo converted, `images` (and `is_featured`) written |
| `matchedNoPhoto` | matched, but the workbook has no photo for it — **no write** |
| `assetFailed` | matched, but no WebP could be produced — **no write** (never wipe images) |
| `conflict` | two or more workbook rows target this same existing product — **no write** |
| `inserted` | unmatched, category resolved — new product |
| `unresolvedSection` | unmatched, section mapped to `null` — **no write**, reported |
| `skipped-row` | rows the extractor dropped (title/legend/column header/nameless) |

- [ ] **Step 1: Write the builder**

Create `scripts/sudu/build-plan.mjs`:

```javascript
// Reads the workbook manifest plus a read-only snapshot of the catalog and
// produces report.md / apply.sql / apply-plan.json. Writes no database rows:
// the SQL is executed separately, over the Supabase MCP channel, after review.
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  cleanName, detectBrand, fixBrandSpellings, inferBrand, proposeBrand,
  renderTitle, sectionToCategory, slugify, uniqueSlug,
} from '../../lib/sudu/names.ts';
import { matchAll, normalizeKey } from '../../lib/sudu/match.ts';

const OUT = new URL('./out/', import.meta.url);
const MEDIA = new URL('./out/media/', import.meta.url);
const IMAGE_DIR = new URL('../../public/productos/sudu/', import.meta.url);
const MANIFEST = new URL('manifest.json', OUT);
const APPROVALS = new URL('brand-approvals.json', OUT);

// ---------------------------------------------------------------- env + state
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [
      line.slice(0, line.indexOf('=')).trim(),
      line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''),
    ]),
);
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('.env.local is missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// PostgREST truncates a bare select at the project max-rows (1,000 here): a
// single call silently matched against less than half a 2,180-row catalog and
// seeded a slug set that could collide on insert. Page through explicitly.
async function selectAll(table, columns) {
  const page = 1000;
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(table).select(columns).order('id').range(from, from + page - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < page) return rows;
  }
}

const categories = await selectAll('categories', 'id,slug,name,sort_order');
const brands = await selectAll('brands', 'id,name,slug');
const products = await selectAll('products', 'id,title,slug,brand_id,category_id,is_featured');
console.log(`catalog: ${products.length} products, ${categories.length} categories, ${brands.length} brands`);

const MOVILES = { name: 'Móviles', slug: 'moviles', sort_order: 14 };
const categorySlugs = new Set(categories.map((c) => c.slug));
const brandBySlug = new Map(brands.map((b) => [b.slug, b]));

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const hotSale = new Set(manifest.hot_sale_weidian_ids);

// ------------------------------------------------------------ decide shapes
const prepared = manifest.records.map((rec) => {
  const cleaned = fixBrandSpellings(cleanName(rec.raw_name));
  const hit = detectBrand(cleaned, brands);
  const inferred = hit ? null : inferBrand(cleaned, brands);
  const proposed = hit || inferred ? null : proposeBrand(cleaned);
  return {
    ...rec,
    cleaned,
    title: renderTitle(hit, inferred, cleaned),
    knownBrandSlug: hit?.brand.slug ?? null,
    inferredBrandSlug: inferred?.slug ?? null,
    brandKey: hit
      ? normalizeKey(hit.brand.name)
      : inferred
        ? normalizeKey(inferred.name)
        : proposed
          ? proposed.key
          : '',
    proposedKey: proposed?.key ?? null,
    proposedName: proposed?.name ?? null,
    categorySlug: sectionToCategory(rec.section, cleaned),
    featured: hotSale.has(rec.weidian_id),
  };
});

// ------------------------------------------------- brand proposals + approvals
const proposals = new Map();
for (const p of prepared) {
  if (!p.proposedKey) continue;
  const entry = proposals.get(p.proposedKey)
    ?? { from: p.proposedKey, proposedName: p.proposedName, count: 0, samples: [] };
  entry.count += 1;
  if (entry.samples.length < 3) entry.samples.push(p.cleaned);
  proposals.set(p.proposedKey, entry);
}

const approvalsFile = existsSync(APPROVALS)
  ? JSON.parse(readFileSync(APPROVALS, 'utf8'))
  : { approve: [] };
const approvedSlugByKey = new Map();
const brandsToCreate = [];
for (const approval of approvalsFile.approve ?? []) {
  const proposal = proposals.get(approval.from);
  if (!proposal) continue;
  const name = approval.name ?? proposal.proposedName;
  const slug = slugify(approval.slug ?? name);
  approvedSlugByKey.set(approval.from, slug);
  brandsToCreate.push({ from: approval.from, name, slug });
}
const uniqueBrandsToCreate = [...new Map(brandsToCreate.map((b) => [b.slug, b])).values()];

const resolved = prepared.map((p) => ({
  ...p,
  brandSlug: p.knownBrandSlug
    ?? p.inferredBrandSlug
    ?? (p.proposedKey ? approvedSlugByKey.get(p.proposedKey) ?? null : null),
}));

// --------------------------------------------------------------- matching
const brandTokens = new Set(
  brands.flatMap((b) => normalizeKey(b.name).split(' ')).filter(Boolean),
);
const brandKeyById = new Map(brands.map((b) => [b.id, normalizeKey(b.name)]));
const categorySlugById = new Map(categories.map((c) => [c.id, c.slug]));
const existing = products.map((p) => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  brandKey: brandKeyById.get(p.brand_id) ?? '',
  categorySlug: categorySlugById.get(p.category_id) ?? '',
}));

const matches = matchAll(
  resolved.map((p) => ({ title: p.title, brandKey: p.brandKey })),
  existing,
  { brandTokens },
).map((result, i) => ({ ...result, prepared: resolved[i] }));

// Two workbook rows must never fight over the same existing product.
const byTarget = new Map();
for (const m of matches) {
  if (m.tier === 'none' || !m.target) continue;
  const list = byTarget.get(m.target.id) ?? [];
  list.push(m);
  byTarget.set(m.target.id, list);
}
const conflicted = new Set();
const conflicts = [];
for (const list of byTarget.values()) {
  if (list.length < 2) continue;
  for (const m of list) conflicted.add(m);
  conflicts.push({ target: list[0].target, rows: list.map((m) => m.prepared.row) });
}

// ----------------------------------------------------------------- assets
mkdirSync(IMAGE_DIR, { recursive: true });
const takenSlugs = new Set(products.map((p) => p.slug));
const toPath = (u) => fileURLToPath(u);

async function convert(sourceName, targetName) {
  const source = toPath(new URL(sourceName, MEDIA));
  if (!existsSync(source)) return false;
  await sharp(source)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(toPath(new URL(targetName, IMAGE_DIR)));
  return true;
}

const inserted = [];
const unresolvedSection = [];
for (const m of matches) {
  if (m.tier !== 'none') continue;
  const p = m.prepared;
  if (p.categorySlug === null) {
    unresolvedSection.push(p);
    continue;
  }
  const slug = uniqueSlug(slugify(p.title), takenSlugs);
  const images = [];
  for (const media of p.images) {
    const name = `${slug}-${images.length + 1}.webp`;
    if (await convert(media, name)) images.push(`/productos/sudu/${name}`);
  }
  inserted.push({
    row: p.row,
    title: p.title,
    slug,
    images,
    categorySlug: p.categorySlug,
    brandSlug: p.brandSlug,
    brandKey: p.brandKey,
    brandSource: p.knownBrandSlug ? 'existing' : p.inferredBrandSlug ? 'inferred' : p.brandSlug ? 'approved' : 'none',
    isFeatured: p.featured,
    weidianId: p.weidian_id,
  });
}

// Only the `safe` tier is applied automatically. A `probable` match is
// evidence of a product *family*, not of the same product: on this workbook
// roughly two thirds of them pointed at the wrong row (Jabra elite 75T ->
// Elite 7 Pro, Samsung watch 9 -> Galaxy Watch Ultra, Apple Pencil 2 ->
// Pencil 3). They are reported and written nowhere.
const updated = [];
const probableOnly = [];
const matchedNoPhoto = [];
const assetFailed = [];
for (const m of matches) {
  if (m.tier === 'none') continue;
  if (conflicted.has(m)) continue;
  const p = m.prepared;
  if (m.tier === 'probable') {
    probableOnly.push({ row: p.row, title: p.title, target: m.target, reason: m.reason });
    continue;
  }
  if (p.images.length === 0) {
    matchedNoPhoto.push({ row: p.row, title: p.title, target: m.target });
    continue;
  }
  const images = [];
  for (const media of p.images) {
    const name = `${m.target.slug}-${images.length + 1}.webp`;
    if (await convert(media, name)) images.push(`/productos/sudu/${name}`);
  }
  if (images.length === 0) {
    assetFailed.push({ row: p.row, title: p.title, target: m.target, media: p.images });
    continue;
  }
  updated.push({
    id: m.target.id,
    slug: m.target.slug,
    title: m.target.title,
    tier: m.tier,
    reason: m.reason,
    isFeatured: p.featured,
    images,
  });
}

// ----------------------------------------------------------------- prune
// The builder is meant to be re-run (Step 5 loops on it), so assets left over
// from a previous classification are removed: a row that used to be inserted
// and now matches would otherwise leave an orphaned file behind, and that file
// would be committed.
const expectedAssets = new Set(
  [...inserted.flatMap((i) => i.images), ...updated.flatMap((u) => u.images)]
    .map((path) => path.split('/').pop()),
);
const removedAssets = [];
for (const name of readdirSync(toPath(IMAGE_DIR))) {
  if (!name.endsWith('.webp') || expectedAssets.has(name)) continue;
  unlinkSync(toPath(new URL(name, IMAGE_DIR)));
  removedAssets.push(name);
}
console.log(`stale assets removed: ${removedAssets.length}`);

// --------------------------------------------------- possible duplicates
// Signalling for the human gate only: which new products look like something
// the catalog already has under a different title. Reported, never acted on.
const existingByCategoryBrand = new Map();
for (const q of existing) {
  if (!q.brandKey) continue;
  const key = `${q.categorySlug}|${q.brandKey}`;
  const list = existingByCategoryBrand.get(key) ?? [];
  list.push(q);
  existingByCategoryBrand.set(key, list);
}
const distinctiveWords = (text) =>
  [...new Set(normalizeKey(text).split(' '))]
    .filter((token) => token.length >= 4 && !/^\d+$/.test(token) && !brandTokens.has(token));

for (const ins of inserted) {
  const pool = ins.brandKey
    ? existingByCategoryBrand.get(`${ins.categorySlug}|${ins.brandKey}`) ?? []
    : [];
  const words = new Set(distinctiveWords(ins.title));
  ins.possibleDuplicates = words.size === 0
    ? []
    : pool
      .filter((q) => distinctiveWords(q.title).some((token) => words.has(token)))
      .slice(0, 3)
      .map((q) => ({ slug: q.slug, title: q.title }));
}
const insertsWithPossibleDuplicate = inserted.filter((i) => i.possibleDuplicates.length > 0).length;

// ------------------------------------------------------------ partition check
const buckets = {
  updated: updated.length,
  probableOnly: probableOnly.length,
  matchedNoPhoto: matchedNoPhoto.length,
  assetFailed: assetFailed.length,
  conflict: [...conflicted].length,
  inserted: inserted.length,
  unresolvedSection: unresolvedSection.length,
};
const recordsAccounted =
  buckets.updated + buckets.probableOnly + buckets.matchedNoPhoto + buckets.assetFailed
  + buckets.conflict + buckets.inserted + buckets.unresolvedSection;
if (recordsAccounted !== manifest.records.length) {
  throw new Error(
    `partition mismatch: ${recordsAccounted} accounted for, ${manifest.records.length} records`,
  );
}

// ------------------------------------------------------------ emit the SQL
// The generated file must reach the database in ONE execution: a Supabase MCP
// call is its own transaction (verified — BEGIN without COMMIT leaves nothing
// behind) and a tool-call argument has a size budget. The first version of this
// emitter wrote one statement per row, 128 KB, and could not be delivered at
// all. This form carries the same decisions in about 36 KB:
//   - inserts collapse into one INSERT ... SELECT over a VALUES list,
//   - ON CONFLICT (slug) DO NOTHING makes a re-run a no-op instead of a
//     duplicate-slug failure,
//   - the image filename is derived from the slug, which is exactly how the
//     assets above were named (`<slug>-<n>.webp`).
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const knownCategories = new Set([...categorySlugs, MOVILES.slug]);
for (const i of inserted) {
  if (!knownCategories.has(i.categorySlug)) {
    throw new Error(`insert ${i.slug} targets unknown category ${i.categorySlug}`);
  }
}
for (const b of uniqueBrandsToCreate) {
  if (brandBySlug.has(b.slug)) {
    throw new Error(`brand slug ${b.slug} already exists — remove it from brand-approvals.json`);
  }
}

const lines = ['BEGIN;', `-- ${new Date().toISOString()}  SUDU-Gadgets 2026-9 import`, ''];

if (!categorySlugs.has(MOVILES.slug)) {
  lines.push(
    `INSERT INTO categories (name, slug, sort_order) VALUES (${q(MOVILES.name)}, ${q(MOVILES.slug)}, ${MOVILES.sort_order});`,
    '',
  );
}
for (const b of uniqueBrandsToCreate) {
  lines.push(`INSERT INTO brands (name, slug) VALUES (${q(b.name)}, ${q(b.slug)}) ON CONFLICT (slug) DO NOTHING;`);
}
if (uniqueBrandsToCreate.length) lines.push('');

if (inserted.length) {
  lines.push(`-- ${inserted.length} new products`);
  lines.push('INSERT INTO products (title, slug, description, images, category_id, brand_id, is_featured)');
  lines.push(
    "SELECT v.t, v.s, NULL,",
    "       (CASE v.n WHEN 0 THEN '[]'::jsonb",
    "                WHEN 1 THEN to_jsonb(ARRAY['/productos/sudu/' || v.s || '-1.webp'])",
    "                ELSE to_jsonb(ARRAY['/productos/sudu/' || v.s || '-1.webp', '/productos/sudu/' || v.s || '-2.webp']) END),",
    '       c.id, b.id, v.f',
    'FROM (VALUES',
  );
  lines.push(
    inserted
      .map((i) => `  (${q(i.title)}, ${q(i.slug)}, ${q(i.categorySlug)}, ${q(i.brandSlug)}, ${i.isFeatured}, ${i.images.length})`)
      .join(',\n'),
  );
  lines.push(
    ') AS v(t text, s text, cslug text, bslug text, f boolean, n int)',
    'JOIN categories c ON c.slug = v.cslug',
    'LEFT JOIN brands b ON b.slug = v.bslug',
    'ON CONFLICT (slug) DO NOTHING;',
    '',
  );
}

if (updated.length) {
  lines.push(`-- ${updated.length} image-only updates`);
  lines.push(
    'UPDATE products p',
    'SET images = u.i::jsonb, is_featured = COALESCE(u.f, p.is_featured)',
    'FROM (VALUES',
  );
  lines.push(
    updated
      .map((u) => `  (${q(u.id)}::uuid, ARRAY[${u.images.map((x) => q(x)).join(', ')}]::text[], ${u.isFeatured ? 'true' : 'NULL'})`)
      .join(',\n'),
  );
  lines.push(
    ') AS u(id uuid, i text[], f boolean)',
    'WHERE p.id = u.id;',
    '',
  );
}

lines.push('COMMIT;');
writeFileSync(new URL('apply.sql', OUT), lines.join('\n'), 'utf8');

// ---------------------------------------------------------------- report
const unmatched = matches.filter((m) => m.tier === 'none');
const md = [
  '# SUDU-Gadgets 2026-9 — import report',
  '',
  `Generated ${new Date().toISOString()} from \`${manifest.source}\`.`,
  '',
  '## Totals',
  '',
  '| Metric | Count |',
  '| --- | --- |',
  `| Workbook records | ${manifest.records.length} |`,
  ...Object.entries(buckets).map(([k, v]) => `| ${k} | ${v} |`),
  `| New brands to create | ${uniqueBrandsToCreate.length} |`,
  `| New products resembling an existing one | ${insertsWithPossibleDuplicate} |`,
  `| Rows the extractor skipped (not workbook records) | ${manifest.skipped.length} |`,
  `| Stale assets removed | ${removedAssets.length} |`,
  '',
  '## Categories to create',
  '',
  categorySlugs.has(MOVILES.slug) ? '- none — `Móviles` already exists' : `- ${MOVILES.name} (\`${MOVILES.slug}\`)`,
  '',
  '## Brands to create (approved)',
  '',
  uniqueBrandsToCreate.length
    ? uniqueBrandsToCreate.map((b) => `- ${b.name} (\`${b.slug}\`) — from proposal \`${b.from}\``).join('\n')
    : '- none',
  '',
  '## Brand proposals awaiting approval',
  '',
  'Add any of these to `scripts/sudu/out/brand-approvals.json` as',
  '`{ "approve": [{ "from": "<key>", "name": "<Name>", "slug": "<slug>" }] }`, then re-run this script.',
  '',
  '| key | proposed name | products | examples |',
  '| --- | --- | --- | --- |',
  ...[...proposals.values()]
    .sort((a, b) => b.count - a.count)
    .map((p) => `| \`${p.from}\` | ${p.proposedName} | ${p.count} | ${p.samples.join(' · ')} |`),
  '',
  '## Probable matches — nothing written, review manually',
  '',
  'Evidence of the same product *family*, not of the same product. None of these is applied.',
  '',
  '| Workbook title | Existing product | Why |',
  '| --- | --- | --- |',
  ...probableOnly.map((p) => `| ${p.title} | ${p.target.title} (\`${p.target.slug}\`) | ${p.reason} |`),
  '',
  '## Possible duplicates among the new products',
  '',
  'New products in the same category and brand that share a distinctive word with an existing',
  'product. Nothing is changed automatically — check these before or after applying.',
  '',
  '| New product | Existing candidates |',
  '| --- | --- |',
  ...inserted.filter((i) => i.possibleDuplicates.length)
    .map((i) => `| ${i.title} (\`${i.slug}\`) | ${i.possibleDuplicates.map((c) => `${c.title} (\`${c.slug}\`)`).join(' · ')} |`),
  '',
  '## Conflicts — two workbook rows, one product, nothing written',
  '',
  ...(conflicts.length
    ? conflicts.map((c) => `- ${c.target.title} (\`${c.target.slug}\`) ← rows ${c.rows.join(', ')}`)
    : ['- none']),
  '',
  '## Matched but the workbook has no photo — nothing written',
  '',
  ...(matchedNoPhoto.length
    ? matchedNoPhoto.map((m) => `- row ${m.row} ${m.title} → ${m.target.slug}`)
    : ['- none']),
  '',
  '## Assets that failed to convert — nothing written',
  '',
  ...(assetFailed.length
    ? assetFailed.map((m) => `- row ${m.row} ${m.title} → ${m.target.slug} (${m.media.join(', ')})`)
    : ['- none']),
  '',
  '## Sections that map to no category — nothing written',
  '',
  ...(unresolvedSection.length
    ? unresolvedSection.map((p) => `- row ${p.row} ${p.title} — section \`${p.section}\``)
    : ['- none']),
  '',
  '## Unmatched by the matcher — these become the new products',
  '',
  'No existing product shares a distinctive token. A row whose section mapped to a category is',
  'one of the new products below; a row whose section mapped to nothing is held back and listed',
  'in the unresolved-section table above.',
  '',
  '| Workbook title | Section | Category | Candidates considered | Note |',
  '| --- | --- | --- | --- | --- |',
  ...unmatched.map((m) =>
    `| ${m.prepared.title} | ${m.prepared.section} | ${m.prepared.categorySlug ?? '—'} | ${m.candidates.map((c) => c.slug).join(', ') || '—'} | ${m.reason} |`),
  '',
  '## Rows the extractor skipped',
  '',
  ...manifest.skipped.map((s) => `- row ${s.row}: ${s.reason}`),
  '',
  '## New products, as they will appear',
  '',
  ...inserted.map((i) =>
    `- ${i.title} — \`${i.slug}\` — ${i.categorySlug}${i.brandSlug ? ` — ${i.brandSlug}` : ''}${i.isFeatured ? ' — **destacado**' : ''}${i.images.length ? '' : ' — **sin foto**'}`),
  '',
].join('\n');

writeFileSync(new URL('report.md', OUT), md, 'utf8');
writeFileSync(
  new URL('brand-proposals.json', OUT),
  JSON.stringify([...proposals.values()], null, 2),
  'utf8',
);
writeFileSync(
  new URL('apply-plan.json', OUT),
  JSON.stringify({ buckets, inserted, updated, probableOnly, matchedNoPhoto, assetFailed, conflicts, unresolvedSection, insertsWithPossibleDuplicate, brandsToCreate: uniqueBrandsToCreate }, null, 2),
  'utf8',
);

console.log(`catalog products : ${products.length}`);
console.log(`inserted         : ${inserted.length}`);
console.log(`updated (safe)   : ${updated.length}`);
console.log(`probable no-write: ${probableOnly.length}`);
console.log(`matched no photo : ${matchedNoPhoto.length}`);
console.log(`possible dupes   : ${insertsWithPossibleDuplicate}`);
console.log(`asset failed     : ${assetFailed.length}`);
console.log(`conflicts        : ${conflicts.length}`);
console.log(`unresolved categ.: ${unresolvedSection.length}`);
console.log(`unmatched        : ${unmatched.length}`);
console.log(`brand proposals  : ${proposals.size}`);
console.log(`brands to create : ${uniqueBrandsToCreate.length}`);
console.log('-> scripts/sudu/out/report.md');
console.log('-> scripts/sudu/out/apply.sql');
```

- [ ] **Step 2: Run the builder**

Run: `node scripts/sudu/build-plan.mjs`
Expected: a summary line per metric, then the two output paths. First run takes a minute while `sharp` converts up to 413 images.

If it throws `partition mismatch`, `unknown category`, or `brand slug already exists`, do not edit the SQL — the bug is in the builder's decision logic; fix that and re-run.

- [ ] **Step 3: Check the headline numbers**

Run:

```powershell
node -e "const p=require('./scripts/sudu/out/apply-plan.json');console.log(p.buckets)"
```

Sanity bounds to hold before going further:

- The `catalog products` line is the real catalog size (2,180 at the time of writing) and **never exactly 1000** — exactly 1000 means the pagination is broken and matching ran against a truncated catalog.
- `unresolvedSection` is **0**. Anything else means a section name was missed and those products are deliberately held back.
- `updated + probableOnly + matchedNoPhoto + assetFailed + conflict + inserted` equals `413`.
- `assetFailed` is 0. Anything else means a manifest media name did not resolve to a file.
- `probableOnly` is expected to be around 30 and **writes nothing**. Only `safe` matches update an existing product.
- `possible dupes` is informational: it counts new products that resemble an existing one. It is not part of the partition.
- Every inserted row has a non-empty `title`, and every `images` array is either empty or contains only `/productos/sudu/` paths.

- [ ] **Step 4: Confirm the assets exist**

Run:

```powershell
(Get-ChildItem "public\productos\sudu" -File).Count
```

Expected: equal to the total image count across `inserted` and `updated`. Then open any three files to confirm they are real product photos and not placeholder frames.

- [ ] **Step 5: Review the report — this is the human gate**

Open `scripts/sudu/out/report.md` and confirm:

1. The **unmatched** table contains only genuinely new products, not existing products that failed to match because of a rule that needs fixing.
2. The **probable** table: **nothing in it is written.** It is evidence of a product *family*, not of the same product, and roughly two thirds of these pairs are wrong on this workbook. Skim it and note any pair you actually want applied.
3. The **possible duplicates among the new products** table: every row is a new product that resembles something the catalog already has under another title. Decide whether it should be an insert at all.
4. The **conflicts** and **assets that failed** tables are empty or explainable.
5. The rendered titles read like a real storefront.

Decide the **brand proposals**: for each one you want, add it to `scripts/sudu/out/brand-approvals.json` and re-run Step 2. Rename a proposal there if the leading token split it wrongly (for example `Gallery Dept`). Leave the rest unapproved — those products are created with `brand_id = NULL`, exactly like most of the existing catalog.

Fix any `lib/sudu` rule that looks wrong, re-run Step 2, and re-read the report. Both scripts are idempotent, so this loop is free.

- [ ] **Step 6: Commit the source and the assets, not the scratch output**

```bash
git add -- scripts/sudu/build-plan.mjs public/productos/sudu
git commit -m "feat: build the SUDU import plan and convert its imagery to WebP"
```

`scripts/sudu/out/` stays untracked. Record the reviewed report in git:

```bash
Copy-Item scripts/sudu/out/report.md docs/superpowers/2026-10-01-sudu-import-report.md
git add -- docs/superpowers/2026-10-01-sudu-import-report.md
git commit -m "docs: record the SUDU import review report"
```

---

### Task 5: Apply the SQL

**This is the only step that writes to the database.** Do not start it until Task 4's report has been read and accepted.

**Files:**
- Read: `scripts/sudu/out/apply.sql`

**Interfaces:**
- Consumes: `out/apply.sql` from Task 4.
- Produces: new rows in `products`, possibly one row in `categories`, some rows in `brands`; updated `images` and `is_featured` on matched products.

- [ ] **Step 1: Take a rollback snapshot before touching anything**

Run the Supabase MCP `execute_sql` tool with:

```sql
create table if not exists public.sudu_import_backup (
  id uuid primary key,
  title text, slug text, images jsonb, is_featured boolean,
  snapshot_at timestamptz not null default now()
);
truncate public.sudu_import_backup;
insert into public.sudu_import_backup (id, title, slug, images, is_featured)
select id, title, slug, images, is_featured from public.products;
```

`truncate` first so a re-run always snapshots the *pre-apply* state, not a mixture. Keep the table: it is the only way to restore the previous imagery if a probable match turns out to have been wrong.

- [ ] **Step 2: Apply the generated SQL**

Run the Supabase MCP `execute_sql` tool with the full contents of `scripts/sudu/out/apply.sql` **in one call**. It opens with `BEGIN;` and closes with `COMMIT;`, so the whole import either lands or does not. It is expected to be roughly 36 KB. A Supabase MCP call is its own transaction, so splitting it across calls loses atomicity, and an argument that is too large is rejected before it reaches Postgres.

If it reports a syntax error, **do not hand-edit the SQL to work around it** — fix the escaping in `build-plan.mjs`, re-run Task 4 Step 2, and apply the regenerated file.

- [ ] **Step 3: Confirm the transaction committed and nothing collided**

Run the Supabase MCP `execute_sql` tool with:

```sql
select
  (select count(*) from products) as productos,
  (select count(*) from categories) as categorias,
  (select count(*) from brands) as marcas,
  (select count(*) from categories where slug = 'moviles') as moviles,
  (select count(*) from public.sudu_import_backup) as backup_rows,
  (select count(*) from (select slug from products group by slug having count(*) > 1) d) as slugs_duplicados;
```

`productos` must equal `backup_rows + inserted`. `moviles` must be 1. `slugs_duplicados` must be 0. If `BEGIN`/`COMMIT` was lost in transit, restore from `sudu_import_backup` and re-apply.

- [ ] **Step 4: No commit in this task**

The database is not in git. There is nothing to commit here.

---

### Task 6: Verify

**Files:**
- Create: `scripts/sudu/verify.mjs`

**Interfaces:**
- Consumes: `out/apply-plan.json` from Task 4; the live database.
- Produces: printed PASS/FAIL assertions. No writes.

- [ ] **Step 1: Write the verifier**

Create `scripts/sudu/verify.mjs`:

```javascript
// Read-only post-apply checks. Prints PASS/FAIL per assertion; writes nothing.
// Note: `products.slug` is UNIQUE, so a duplicate-slug check over a single
// SELECT cannot fail — that assertion belongs in SQL (Task 5 Step 3).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [
      line.slice(0, line.indexOf('=')).trim(),
      line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''),
    ]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const plan = JSON.parse(readFileSync(new URL('./out/apply-plan.json', import.meta.url), 'utf8'));

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

const { data: products } = await sb.from('products').select('id,slug,title,images,is_featured');
const { data: categories } = await sb.from('categories').select('slug,name');

const bySlug = new Map(products.map((p) => [p.slug, p]));
const byId = new Map(products.map((p) => [p.id, p]));
const catSlugs = new Set(categories.map((c) => c.slug));

check('categoría Móviles existe', catSlugs.has('moviles'));

const missing = plan.inserted.filter((i) => !bySlug.has(i.slug));
check('todos los productos nuevos existen', missing.length === 0,
  missing.length ? `faltan ${missing.length}: ${missing.slice(0, 5).map((m) => m.slug).join(', ')}` : `${plan.inserted.length} comprobados`);

const emptyTitles = plan.inserted.filter((i) => !bySlug.get(i.slug)?.title);
check('ningún producto nuevo tiene título vacío', emptyTitles.length === 0, `${emptyTitles.length} vacíos`);

const noImages = plan.inserted.filter((i) => (bySlug.get(i.slug)?.images ?? []).length === 0);
const expectedNoImages = plan.inserted.filter((i) => i.images.length === 0).length;
check('los nuevos sin foto son exactamente los previstos', noImages.length === expectedNoImages,
  `${noImages.length} sin imagen (esperado ${expectedNoImages})`);

const badPaths = plan.inserted.flatMap((i) => bySlug.get(i.slug)?.images ?? [])
  .filter((p) => typeof p === 'string' && !p.startsWith('/productos/sudu/'));
check('toda imagen apunta a /productos/sudu/', badPaths.length === 0, `${badPaths.length} rutas ajenas`);

const staleImages = plan.updated.filter((u) => {
  const row = byId.get(u.id);
  return !row || JSON.stringify(row.images ?? []) !== JSON.stringify(u.images ?? []);
});
check('cada producto emparejado tiene ya la imagen nueva', staleImages.length === 0, `${staleImages.length} sin actualizar`);

const featuredWanted = plan.updated.filter((u) => u.isFeatured).map((u) => u.id);
const featuredMissing = featuredWanted.filter((id) => !byId.get(id)?.is_featured);
check('los destacados de HOT SALE están marcados', featuredMissing.length === 0, `${featuredMissing.length} sin marcar`);

const planSlugs = plan.inserted.map((i) => i.slug);
const planDupes = planSlugs.filter((s, i) => planSlugs.indexOf(s) !== i);
check('los slugs nuevos son únicos dentro del plan', planDupes.length === 0, `${planDupes.length} repetidos`);

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} COMPROBACIONES FALLIDAS`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run the verifier**

Run: `node scripts/sudu/verify.mjs`
Expected: every line `PASS`, ending in `TODO OK`, exit code 0.

- [ ] **Step 3: Check the storefront by hand**

Run `npm run dev`, then open one page per category touched — a phone from `Móviles`, an AirPods product, a perfume, a sneaker, a streetwear hoodie. Confirm the photo is the right product and not a neighbour's, and that the category pages list them.

- [ ] **Step 4: Commit the verifier**

```bash
git add -- scripts/sudu/verify.mjs
git commit -m "test: verify the SUDU import landed correctly"
```

- [ ] **Step 5: Drop the backup table once satisfied**

Run the Supabase MCP `execute_sql` tool with `drop table if exists public.sudu_import_backup;`

Keep the table until the storefront has been reviewed. It is the only rollback path for a wrong probable match.

---

## Re-running the whole import

`extract.py` → `build-plan.mjs` → review → MCP SQL → `verify.mjs`. Matching is the idempotency mechanism: on a second run the products created by the first pass now exist and match at the safe tier, so their imagery is rewritten identically and nothing is duplicated. There is no `weidian_id` column, so a *renamed* workbook row would be treated as new and would need the old row deleted by hand. `brand-approvals.json` persists between runs, so approved brands stay approved.
