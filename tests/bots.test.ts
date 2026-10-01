import { describe, it, expect } from 'vitest';
import { esBot } from '../lib/bots';

const NAVEGADORES = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
];

const AUTOMATIZADOS = [
  'TelegramBot (like TwitterBot)',
  'WhatsApp/2.23.20.0',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36',
  'curl/8.4.0',
  'python-requests/2.32.3',
];

describe('esBot', () => {
  it('no marca los navegadores reales', () => {
    for (const ua of NAVEGADORES) expect(esBot(ua), ua).toBe(false);
  });

  it('no marca un user-agent mínimo de navegador', () => {
    expect(esBot('Mozilla/5.0')).toBe(false);
  });

  it('marca crawlers, previews y clientes automatizados', () => {
    for (const ua of AUTOMATIZADOS) expect(esBot(ua), ua).toBe(true);
  });

  it('trata la ausencia de user-agent como no humano', () => {
    // Ningún navegador omite el suyo, así que un UA vacío nunca es una visita real.
    expect(esBot('')).toBe(true);
  });
});
