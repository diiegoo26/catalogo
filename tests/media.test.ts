import { describe, it, expect } from 'vitest';
import { needsDirectImage } from '../lib/media';

// next/image devuelve 400 para SVG y 403 cuando el CDN rechaza al optimizador.
// En esos casos la imagen no aparece: hay que pedirla directo al navegador.
describe('needsDirectImage', () => {
  it('marca los SVG, que el optimizador rechaza', () => {
    expect(needsDirectImage('https://cdn.worldvectorlogo.com/logos/rolex.svg')).toBe(true);
    expect(needsDirectImage('https://cdn.worldvectorlogo.com/logos/rolex.svg?v=2')).toBe(true);
    expect(needsDirectImage('https://cdn.worldvectorlogo.com/logos/rolex.SVG')).toBe(true);
  });

  it('marca los hosts que bloquean al optimizador', () => {
    expect(
      needsDirectImage('https://images.seeklogo.com/logo-png/9/1/mikasa-logo-png_seeklogo-92560.png'),
    ).toBe(true);
  });

  it('deja optimizar el resto', () => {
    expect(needsDirectImage('https://flagcdn.com/w320/es.png')).toBe(false);
    expect(needsDirectImage('https://lh3.googleusercontent.com/d/1es9mp1eyTN3ffHodad_2dSD77VgD69Kt')).toBe(false);
    expect(needsDirectImage('/productos/alice/ysl-libre-l-absolu-platine-edp-90ml.webp')).toBe(false);
    expect(needsDirectImage('')).toBe(false);
    expect(needsDirectImage(null)).toBe(false);
    expect(needsDirectImage(undefined)).toBe(false);
  });
});
