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
