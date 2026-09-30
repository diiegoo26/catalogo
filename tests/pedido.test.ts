import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../lib/pedido';
import { telefonoValido, telegramValido, normalizarTelegram } from '../lib/cliente';

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
