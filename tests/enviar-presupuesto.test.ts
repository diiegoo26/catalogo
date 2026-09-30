import { describe, it, expect, vi } from 'vitest';
import { enviarPresupuesto } from '../lib/telegram';

const base = {
  items: [{ title: 'Camiseta', productUrl: 'https://x.test/p', talla: 'M', cantidad: 1 }],
  cliente: { nombre: 'Diego', telefono: '612 345 678' },
  provincia: 'Madrid',
  localidad: 'Alcobendas',
};
const res = (ok: boolean, status: number) => ({ ok, status } as Response);

describe('enviarPresupuesto', () => {
  it('fails fast without token/chat id', async () => {
    const fetchImpl = vi.fn();
    const r = await enviarPresupuesto(base, { fetchImpl: fetchImpl as unknown as typeof fetch, token: '', chatId: '' });
    expect(r).toEqual({ ok: false, error: 'no_config' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends only the summary when there are no photos', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200));
    const r = await enviarPresupuesto(base, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(r).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain('/sendMessage');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).text).toContain('Nuevo presupuesto');
  });

  it('sends sendPhoto for one image, then the summary', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200));
    const p = { ...base, items: [{ ...base.items[0], imageUrl: 'https://x.test/a.jpg' }] };
    await enviarPresupuesto(p, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(fetchImpl.mock.calls[0][0]).toContain('/sendPhoto');
    expect(fetchImpl.mock.calls[1][0]).toContain('/sendMessage');
  });

  it('sends sendMediaGroup for two images, then the summary', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200));
    const p = {
      ...base,
      items: [
        { ...base.items[0], imageUrl: 'https://x.test/a.jpg' },
        { ...base.items[0], title: 'Bufanda', imageUrl: 'https://x.test/b.jpg' },
      ],
    };
    await enviarPresupuesto(p, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(fetchImpl.mock.calls[0][0]).toContain('/sendMediaGroup');
    const media = JSON.parse(fetchImpl.mock.calls[0][1].body).media;
    expect(media).toHaveLength(2);
    expect(media[0].caption).toContain('Presupuesto');
    expect(fetchImpl.mock.calls[1][0]).toContain('/sendMessage');
  });

  it('batches more than 10 images into 9 + 2, then the summary', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200));
    const items = Array.from({ length: 11 }, (_, i) => ({ ...base.items[0], title: `P${i}`, imageUrl: `https://x.test/${i}.jpg` }));
    await enviarPresupuesto({ ...base, items }, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    const albumCalls = fetchImpl.mock.calls.filter((c) => String(c[0]).includes('/sendMediaGroup'));
    expect(albumCalls).toHaveLength(2);
    expect(JSON.parse(albumCalls[0][1].body).media).toHaveLength(9);
    expect(JSON.parse(albumCalls[1][1].body).media).toHaveLength(2);
  });

  it('still reports ok when the album fails but the summary succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(false, 400)) // sendMediaGroup fails immediately (4xx)
      .mockResolvedValueOnce(res(true, 200));  // summary ok
    const p = {
      ...base,
      items: [
        { ...base.items[0], imageUrl: 'https://x.test/a.jpg' },
        { ...base.items[0], title: 'Bufanda', imageUrl: 'https://x.test/b.jpg' },
      ],
    };
    const r = await enviarPresupuesto(p, { fetchImpl: fetchImpl as unknown as typeof fetch, token: 't', chatId: '1' });
    expect(r).toEqual({ ok: true });
  });
});
