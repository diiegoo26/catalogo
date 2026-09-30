import { describe, it, expect, vi } from 'vitest';
import { enviarPedido } from '../lib/telegram';

const pedido = { title: 'Camiseta', productUrl: 'https://x.test/p', nombre: 'Diego', telefono: '612 345 678', talla: 'M' };

function res(ok: boolean, status: number) {
  return { ok, status } as Response;
}

describe('enviarPedido', () => {
  it('fails fast when the token or chat id is missing', async () => {
    const fetchImpl = vi.fn();
    const r = await enviarPedido(pedido, { fetchImpl: fetchImpl as unknown as typeof fetch, token: '', chatId: '' });
    expect(r).toEqual({ ok: false, error: 'no_config' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses sendPhoto when an image is present and returns ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200));
    const r = await enviarPedido({ ...pedido, imageUrl: 'https://x.test/a.jpg' },
      { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(r).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain('/sendPhoto');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).photo).toBe('https://x.test/a.jpg');
  });

  it('falls back to sendMessage when the photo is rejected', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(false, 400))
      .mockResolvedValueOnce(res(true, 200));
    const r = await enviarPedido({ ...pedido, imageUrl: 'https://x.test/a.jpg' },
      { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(r).toEqual({ ok: true });
    expect(fetchImpl.mock.calls[0][0]).toContain('/sendPhoto');
    expect(fetchImpl.mock.calls[1][0]).toContain('/sendMessage');
  });

  it('uses sendMessage when there is no image', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200));
    await enviarPedido(pedido, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(fetchImpl.mock.calls[0][0]).toContain('/sendMessage');
  });

  it('retries once on a 5xx and reports the failure after the budget', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(false, 500));
    const r = await enviarPedido(pedido, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1', intentos: 2 });
    expect(r).toEqual({ ok: false, error: 'http_500' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('reports a network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await enviarPedido(pedido, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1', intentos: 1 });
    expect(r).toEqual({ ok: false, error: 'network' });
  });
});
