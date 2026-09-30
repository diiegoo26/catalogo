import { describe, expect, it } from 'vitest';
import {
  AUTOR_MAX,
  TEXTO_MAX,
  construirMensajeResena,
  validarResena,
} from '../lib/resenas';

const VALIDA = {
  productId: null,
  author: 'Marta G.',
  rating: 5,
  body: 'Llegó rápido y la calidad es buenísima.',
};

describe('validarResena', () => {
  it('acepta una reseña de tienda válida', () => {
    const r = validarResena(VALIDA);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.resena.productId).toBeNull();
      expect(r.resena.author).toBe('Marta G.');
      expect(r.resena.rating).toBe(5);
    }
  });

  it('rechaza el honeypot relleno', () => {
    expect(validarResena({ ...VALIDA, hp: 'bot' })).toEqual({ ok: false, error: 'spam' });
  });

  it('rechaza payloads que no son objeto', () => {
    expect(validarResena(null)).toEqual({ ok: false, error: 'payload' });
    expect(validarResena([VALIDA])).toEqual({ ok: false, error: 'payload' });
    expect(validarResena('hola')).toEqual({ ok: false, error: 'payload' });
  });

  it('valida el nombre', () => {
    expect(validarResena({ ...VALIDA, author: 'M' })).toEqual({ ok: false, error: 'autor' });
    expect(validarResena({ ...VALIDA, author: '   ' })).toEqual({ ok: false, error: 'autor' });
    expect(validarResena({ ...VALIDA, author: 'x'.repeat(AUTOR_MAX + 1) })).toEqual({ ok: false, error: 'autor' });
    expect(validarResena({ ...VALIDA, author: 'x'.repeat(AUTOR_MAX) }).ok).toBe(true);
  });

  it('valida la puntuación (entero 1-5)', () => {
    for (const rating of [0, 6, 2.5, 'cinco', null, undefined]) {
      expect(validarResena({ ...VALIDA, rating })).toEqual({ ok: false, error: 'rating' });
    }
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(validarResena({ ...VALIDA, rating }).ok).toBe(true);
    }
  });

  it('valida la longitud del texto', () => {
    expect(validarResena({ ...VALIDA, body: 'corto' })).toEqual({ ok: false, error: 'texto' });
    expect(validarResena({ ...VALIDA, body: 'x'.repeat(TEXTO_MAX + 1) })).toEqual({ ok: false, error: 'texto' });
    expect(validarResena({ ...VALIDA, body: 'x'.repeat(TEXTO_MAX) }).ok).toBe(true);
  });

  it('exige un UUID con forma válida cuando hay producto', () => {
    expect(validarResena({ ...VALIDA, productId: 'no-es-uuid' })).toEqual({ ok: false, error: 'productId' });
    expect(validarResena({ ...VALIDA, productId: '' }).ok).toBe(true);
    const conProducto = validarResena({ ...VALIDA, productId: '612957f3-fc5a-4076-8daf-d099420b01a1' });
    expect(conProducto.ok).toBe(true);
    if (conProducto.ok) expect(conProducto.resena.productId).toBe('612957f3-fc5a-4076-8daf-d099420b01a1');
  });

  it('recorta el texto antes de guardarlo', () => {
    const r = validarResena({ ...VALIDA, author: '  Ana  ', body: '  Muy buen producto y rápido.  ' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.resena.author).toBe('Ana');
      expect(r.resena.body).toBe('Muy buen producto y rápido.');
    }
  });
});

describe('construirMensajeResena', () => {
  it('incluye autor, estrellas y producto', () => {
    const texto = construirMensajeResena({
      productId: 'id',
      productTitle: 'Camiseta KOVA',
      author: 'Ana',
      rating: 4,
      body: 'Muy buena',
    });
    expect(texto).toContain('Camiseta KOVA');
    expect(texto).toContain('Ana');
    expect(texto).toContain('★★★★☆');
    expect(texto).toContain('(4/5)');
  });

  it('marca las reseñas de tienda y escapa el HTML', () => {
    const texto = construirMensajeResena({
      productId: null,
      author: '<b>Ana</b>',
      rating: 5,
      body: 'Todo <script>perfecto</script>',
    });
    expect(texto).toContain('Reseña de la tienda');
    expect(texto).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(texto).toContain('&lt;script&gt;');
    expect(texto).not.toContain('<script>');
  });
});
