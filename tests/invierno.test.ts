import { describe, it, expect } from 'vitest';
import { PALABRAS_DE_ABRIGO, esRopaDeInvierno, tileDeInvierno } from '../lib/invierno';

// Títulos reales del catálogo, copiados tal cual llegan de Supabase.
describe('esRopaDeInvierno', () => {
  it('accepts outerwear and hooded garments', () => {
    expect(esRopaDeInvierno('Chaqueta 01')).toBe(true);
    expect(esRopaDeInvierno('Canada Goose Cotton Coat')).toBe(true);
    expect(esRopaDeInvierno('Essentials FW20 Puffer Jacket Moss')).toBe(true);
    expect(esRopaDeInvierno('Ralph Lauren Classic Hoodie')).toBe(true);
    expect(esRopaDeInvierno('The North Face windproof jacket collection')).toBe(true);
  });

  it('accepts a hooded sweatshirt, which the strict garment words alone would miss', () => {
    expect(esRopaDeInvierno('Supreme hooded sweatshirt')).toBe(true);
    expect(esRopaDeInvierno('Hell star old hooded sweatshirt')).toBe(true);
  });

  it('accepts winter and invierno as literal season markers', () => {
    expect(esRopaDeInvierno('Stone Island Sleeve Badge Winter Zipper Knitted Shirt')).toBe(true);
    expect(esRopaDeInvierno('Buzo de invierno')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(esRopaDeInvierno('MONCLER AUTUMN AND WINTER CASUAL JACKET')).toBe(true);
    expect(esRopaDeInvierno('nike fleece double-sided jacket')).toBe(true);
  });

  it('rejects football shirts, where jersey means camiseta rather than knitwear', () => {
    expect(esRopaDeInvierno('Stussy cotton baseball jersey')).toBe(false);
    expect(esRopaDeInvierno('Miami International MIAMI Joint Jersey')).toBe(false);
    expect(esRopaDeInvierno('Messi commemorative edition jersey')).toBe(false);
  });

  it('rejects short-sleeved tops, which are not winter garments', () => {
    // Los tres primeros encabezan la vitrina por fecha, así que este descarte
    // decide qué se ve en la portada.
    expect(esRopaDeInvierno('Stone Island Solid Color Hoodie Short Sleeve Collection')).toBe(false);
    expect(esRopaDeInvierno('AMIRI hooded sweatshirt short sleeved collection')).toBe(false);
    expect(esRopaDeInvierno('Ami hoodie short sleeved collection')).toBe(false);
    expect(esRopaDeInvierno('CP Company round neck pullover half sleeve T')).toBe(false);
  });

  it('still accepts a long-sleeved garment that merely mentions a sleeve', () => {
    expect(esRopaDeInvierno('Stone Island Sleeve Badge Winter Zipper Knitted Shirt')).toBe(true);
  });

  it('rejects a Spanish dress, which naive vest matching would wrongly accept', () => {
    expect(esRopaDeInvierno('Vestido largo de verano')).toBe(false);
  });

  it('rejects products that are not clothing at all', () => {
    expect(esRopaDeInvierno('Apple iphone 18 pro max')).toBe(false);
    expect(esRopaDeInvierno('Sony Ps5 controller')).toBe(false);
    expect(esRopaDeInvierno('')).toBe(false);
  });

  it('keeps the two words that caused false positives out of the keyword list', () => {
    expect(PALABRAS_DE_ABRIGO).not.toContain('jersey');
    expect(PALABRAS_DE_ABRIGO).not.toContain('vest');
  });
});

// El tile no sale de `categories` —invierno es una temporada, no una categoría— así
// que se arma a mano. Lo que se prueba es el enlace y el recuento: un href torcido
// manda a la vidriera de la estación a un 404 sin que nada más falle.
describe('tileDeInvierno', () => {
  it('points at the winter route, not at a category slug', () => {
    expect(tileDeInvierno(89).href).toBe('/temporada-de-invierno');
  });

  it('is labelled as a season and carries the real count', () => {
    const tile = tileDeInvierno(89);
    expect(tile.name).toBe('Temporada de Invierno');
    expect(tile.count).toBe(89);
  });

  it('carries a photo, so the tile does not fall back to the bare initial', () => {
    // Sin foto, `CategoryGrid` dibuja la inicial del nombre ("T") en vez del hueco:
    // por eso el tile se leía "TTemporada de Invierno".
    expect(tileDeInvierno(89).image).toMatch(/^https:\/\//);
  });

  it('has an id that cannot collide with a category uuid', () => {
    expect(tileDeInvierno(1).id).toBe('temporada-de-invierno');
  });
});
