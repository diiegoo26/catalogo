import { construirMensaje, type PedidoPayload } from './pedido';

export type EnvioResult = { ok: true } | { ok: false; error: string };

type Opciones = { fetchImpl?: typeof fetch; token?: string; chatId?: string; intentos?: number };

const API = 'https://api.telegram.org';

async function enviarConReintento(
  fetchImpl: typeof fetch,
  token: string,
  metodo: string,
  cuerpo: unknown,
  intentos: number,
): Promise<EnvioResult> {
  let ultimo = 'network';
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetchImpl(`${API}/bot${token}/${metodo}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      if (r.ok) return { ok: true };
      ultimo = `http_${r.status}`;
      if (r.status < 500) return { ok: false, error: ultimo };
    } catch {
      ultimo = 'network';
    }
  }
  return { ok: false, error: ultimo };
}

export async function enviarPedido(p: PedidoPayload, opts: Opciones = {}): Promise<EnvioResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = opts.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID ?? '';
  const intentos = opts.intentos ?? 2;
  if (!token || !chatId) return { ok: false, error: 'no_config' };

  const { text, imageUrl } = construirMensaje(p);

  if (imageUrl) {
    const foto = await enviarConReintento(fetchImpl, token, 'sendPhoto',
      { chat_id: chatId, photo: imageUrl, caption: text, parse_mode: 'HTML' }, intentos);
    if (foto.ok) return { ok: true };
  }

  return enviarConReintento(fetchImpl, token, 'sendMessage',
    { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }, intentos);
}

/** Aviso simple al dueño (p. ej. una reseña nueva). No lleva imagen. */
export async function enviarMensaje(texto: string, opts: Opciones = {}): Promise<EnvioResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = opts.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID ?? '';
  const intentos = opts.intentos ?? 2;
  if (!token || !chatId) return { ok: false, error: 'no_config' };

  return enviarConReintento(fetchImpl, token, 'sendMessage',
    { chat_id: chatId, text: texto, parse_mode: 'HTML', disable_web_page_preview: true }, intentos);
}
