import { describe, it, expect } from 'vitest';
import { escapeHtml, validarPedido, construirMensaje } from '../lib/pedido';
import { telefonoValido, telegramValido, normalizarTelegram } from '../lib/cliente';

const base = {
  title: 'Camiseta Real Madrid 2026-27',
  productUrl: 'https://x.test/producto/camiseta',
  nombre: 'Diego',
  telefono: '612 345 678',
  talla: 'M',
};

describe('escapeHtml', () => {
  it('escapes & < >', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('a "b" \'c\'')).toBe('a &quot;b&quot; &#39;c&#39;');
  });
});

describe('cliente helpers', () => {
  it('validates phone numbers by digit count', () => {
    expect(telefonoValido('612 345 678')).toBe(true);
    expect(telefonoValido('+34 612-345-678')).toBe(true);
    expect(telefonoValido('12345')).toBe(false);
    expect(telefonoValido('')).toBe(false);
  });

  it('validates and normalises telegram usernames', () => {
    expect(telegramValido('')).toBe(true);
    expect(telegramValido('@DiegoCorral')).toBe(true);
    expect(telegramValido('ab')).toBe(false);
    expect(telegramValido('bad name')).toBe(false);
    expect(normalizarTelegram('@DiegoCorral')).toBe('DiegoCorral');
  });
});

describe('validarPedido', () => {
  it('accepts a minimal payload and trims the title', () => {
    const r = validarPedido({ ...base, title: '  Kit  ' });
    expect(r).toEqual({ ok: true, pedido: { title: 'Kit', productUrl: base.productUrl, nombre: 'Diego', telefono: '612 345 678', talla: 'M' } });
  });

  it('rejects a non-object', () => {
    expect(validarPedido(null)).toEqual({ ok: false, error: 'payload' });
    expect(validarPedido([1])).toEqual({ ok: false, error: 'payload' });
  });

  it('rejects a missing title or a non-http productUrl', () => {
    expect(validarPedido({ productUrl: base.productUrl, nombre: 'Diego', telefono: '612345678', talla: 'M' })).toEqual({ ok: false, error: 'title' });
    expect(validarPedido({ title: 'x', productUrl: 'javascript:alert(1)', nombre: 'Diego', telefono: '612345678', talla: 'M' })).toEqual({ ok: false, error: 'productUrl' });
  });

  it('requires a name and a valid phone', () => {
    expect(validarPedido({ title: 'x', productUrl: base.productUrl, telefono: '612345678', talla: 'M' })).toEqual({ ok: false, error: 'nombre' });
    expect(validarPedido({ title: 'x', productUrl: base.productUrl, nombre: 'Diego', talla: 'M' })).toEqual({ ok: false, error: 'telefono' });
    expect(validarPedido({ title: 'x', productUrl: base.productUrl, nombre: 'Diego', telefono: '123', talla: 'M' })).toEqual({ ok: false, error: 'telefono' });
  });

  it('requires a size', () => {
    expect(validarPedido({ title: 'x', productUrl: base.productUrl, nombre: 'Diego', telefono: '612345678' })).toEqual({ ok: false, error: 'talla' });
  });

  it('accepts a quantity and rejects an out-of-range one', () => {
    expect(validarPedido({ ...base, cantidad: 2 })).toEqual({ ok: true, pedido: { title: base.title, productUrl: base.productUrl, nombre: 'Diego', telefono: '612 345 678', talla: 'M', cantidad: 2 } });
    expect(validarPedido({ ...base, cantidad: 0 })).toEqual({ ok: false, error: 'cantidad' });
    expect(validarPedido({ ...base, cantidad: 1.5 })).toEqual({ ok: false, error: 'cantidad' });
    expect(validarPedido({ ...base, cantidad: '2' })).toEqual({ ok: false, error: 'cantidad' });
  });

  it('accepts notes and rejects over-long ones', () => {
    expect(validarPedido({ ...base, notas: 'Enviad a Canarias' })).toEqual({
      ok: true,
      pedido: { title: base.title, productUrl: base.productUrl, nombre: 'Diego', telefono: '612 345 678', talla: 'M', notas: 'Enviad a Canarias' },
    });
    expect(validarPedido({ ...base, notas: 'x'.repeat(301) })).toEqual({ ok: false, error: 'notas' });
  });

  it('accepts an optional telegram username and normalises it', () => {
    const r = validarPedido({ ...base, telegram: '@DiegoCorral' });
    expect(r).toEqual({ ok: true, pedido: { title: base.title, productUrl: base.productUrl, nombre: 'Diego', telefono: '612 345 678', talla: 'M', telegram: 'DiegoCorral' } });
    expect(validarPedido({ ...base, telegram: '@x' })).toEqual({ ok: false, error: 'telegram' });
  });

  it('rejects an over-long title', () => {
    expect(validarPedido({ ...base, title: 'x'.repeat(201) })).toEqual({ ok: false, error: 'title' });
  });

  it('rejects a filled honeypot', () => {
    expect(validarPedido({ ...base, hp: 'bot' })).toEqual({ ok: false, error: 'spam' });
  });

  it('rejects a bad parches entry', () => {
    expect(validarPedido({ ...base, parches: ['ok', 5] })).toEqual({ ok: false, error: 'parches' });
  });

  it('keeps every remaining optional field', () => {
    const r = validarPedido({ ...base, color: 'Blanco', personalizacion: 'GARCÍA 10', parches: ['LaLiga'], cantidad: 3, notas: 'ok' });
    expect(r).toEqual({
      ok: true,
      pedido: { title: base.title, productUrl: base.productUrl, nombre: 'Diego', telefono: '612 345 678', talla: 'M',
        color: 'Blanco', personalizacion: 'GARCÍA 10', parches: ['LaLiga'], cantidad: 3, notas: 'ok' },
    });
  });
});

describe('construirMensaje', () => {
  it('includes the size, the customer contact and the product link', () => {
    const { text, imageUrl } = construirMensaje({ ...base });
    expect(text).toContain('🛒 <b>Nuevo pedido</b>');
    expect(text).toContain(`📦 <b>${base.title}</b>`);
    expect(text).toContain('Talla: M');
    expect(text).toContain('👤 Cliente: Diego');
    expect(text).toContain('📞 <a href="tel:612345678">612 345 678</a>');
    expect(text).toContain(`<a href="${base.productUrl}">Ver producto</a>`);
    expect(imageUrl).toBeUndefined();
  });

  it('adds the quantity and the notes when provided', () => {
    const { text } = construirMensaje({ ...base, cantidad: 2, notas: 'Sin prisa' });
    expect(text).toContain('Talla: M · Cantidad: 2');
    expect(text).toContain('📝 Notas: Sin prisa');
  });

  it('adds a telegram link when provided', () => {
    const { text } = construirMensaje({ ...base, telegram: 'DiegoCorral' });
    expect(text).toContain('<a href="https://t.me/DiegoCorral">@DiegoCorral</a>');
  });

  it('combines colour and personalisation and escapes the content', () => {
    const { text } = construirMensaje({ ...base, title: 'A & B', color: 'Negro', personalizacion: 'GARCÍA 10' });
    expect(text).toContain('📦 <b>A &amp; B</b>');
    expect(text).toContain('Talla: M · Color: Negro');
    expect(text).toContain('Personalización: GARCÍA 10');
  });

  it('never shows any monetary amount and passes the photo through', () => {
    const { text, imageUrl } = construirMensaje({ ...base, imageUrl: 'https://x.test/a.jpg' });
    expect(text).not.toContain('💰');
    expect(text).not.toContain('€');
    expect(imageUrl).toBe('https://x.test/a.jpg');
  });
});
