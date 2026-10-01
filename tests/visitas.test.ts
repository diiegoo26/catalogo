import { describe, it, expect, vi } from 'vitest';
import { decisionVisita, LIMITE_VISITAS_HORA, VENTANA_VISITAS_MS } from '../lib/visitas';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

describe('decisionVisita', () => {
  it('cuenta una visita de navegador dentro del límite', () => {
    const consumirCupo = vi.fn(() => true);
    expect(decisionVisita(CHROME, consumirCupo)).toEqual({ cuenta: true });
    expect(consumirCupo).toHaveBeenCalledTimes(1);
  });

  it('rechaza por cuota agotada', () => {
    expect(decisionVisita(CHROME, () => false)).toEqual({
      cuenta: false,
      motivo: 'rate_limited',
    });
  });

  it('descarta bots antes de tocar la cuota', () => {
    const consumirCupo = vi.fn(() => true);
    expect(decisionVisita('TelegramBot (like TwitterBot)', consumirCupo)).toEqual({
      cuenta: false,
      motivo: 'bot',
    });
    expect(consumirCupo).not.toHaveBeenCalled();
  });

  it('un bot ni siquiera llega a la cuota aunque ya esté agotada', () => {
    const consumirCupo = vi.fn(() => false);
    expect(decisionVisita('Googlebot/2.1', consumirCupo)).toEqual({
      cuenta: false,
      motivo: 'bot',
    });
    expect(consumirCupo).not.toHaveBeenCalled();
  });
});

describe('cupo por defecto', () => {
  it('permite 120 visitas por hora y una ventana de una hora', () => {
    expect(LIMITE_VISITAS_HORA).toBe(120);
    expect(VENTANA_VISITAS_MS).toBe(3_600_000);
  });
});
