import { escapeHtml } from './pedido';

/** Reseña de cliente. `productId` null = reseña general de la tienda. */
export type ResenaPayload = {
  productId: string | null;
  productTitle?: string;
  author: string;
  rating: number;
  body: string;
};

export type ValidacionResena =
  | { ok: true; resena: ResenaPayload }
  | { ok: false; error: string };

export const AUTOR_MIN = 2;
export const AUTOR_MAX = 40;
export const TEXTO_MIN = 10;
export const TEXTO_MAX = 1000;
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** UUID v4-ish; suficiente para comprobar forma antes de tocar la base de datos. */
const esUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export function validarResena(raw: unknown): ValidacionResena {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'payload' };
  const o = raw as Record<string, unknown>;

  // Honeypot: los bots rellenan campos ocultos.
  if (o.hp !== undefined && o.hp !== '') return { ok: false, error: 'spam' };

  const autor = typeof o.author === 'string' ? o.author.trim() : '';
  if (autor.length < AUTOR_MIN || autor.length > AUTOR_MAX) return { ok: false, error: 'autor' };

  const rating = typeof o.rating === 'number' ? o.rating : Number(o.rating);
  if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    return { ok: false, error: 'rating' };
  }

  const body = typeof o.body === 'string' ? o.body.trim() : '';
  if (body.length < TEXTO_MIN || body.length > TEXTO_MAX) return { ok: false, error: 'texto' };

  let productId: string | null = null;
  if (o.productId !== undefined && o.productId !== null && o.productId !== '') {
    if (typeof o.productId !== 'string' || !esUuid(o.productId)) return { ok: false, error: 'productId' };
    productId = o.productId;
  }

  const productTitle = typeof o.productTitle === 'string' ? o.productTitle.trim().slice(0, 200) : undefined;

  return { ok: true, resena: { productId, productTitle: productTitle || undefined, author: autor, rating, body } };
}

/** Mensaje de aviso al dueño (Telegram, HTML). */
export function construirMensajeResena(r: ResenaPayload): string {
  const donde = r.productTitle
    ? `Producto: <b>${escapeHtml(r.productTitle)}</b>`
    : 'Reseña de la tienda (sin producto)';
  const estrellas = '★'.repeat(r.rating) + '☆'.repeat(RATING_MAX - r.rating);
  return [
    '⭐ <b>Nueva reseña</b>',
    donde,
    `${estrellas} (${r.rating}/5)`,
    `De: ${escapeHtml(r.author)}`,
    '────────────',
    escapeHtml(r.body),
  ].join('\n');
}
