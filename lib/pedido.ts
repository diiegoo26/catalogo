import { normalizarTelegram, telefonoValido, telegramValido } from './cliente';
import { PROVINCIAS } from './provincias';
import { hayPrecioPendiente, totalEuros, type ItemPresupuesto } from './cesta';
import { etiquetaPrecio } from './precios';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

const esUrl = (s: string) => /^https?:\/\//i.test(s);

export const MAX_ITEMS = 20;

export type Cliente = { nombre: string; telefono: string; telegram?: string };

export type PresupuestoPayload = {
  items: ItemPresupuesto[];
  cliente: Cliente;
  provincia: string;
  localidad: string;
};

export type ValidacionPresupuesto =
  | { ok: true; presupuesto: PresupuestoPayload }
  | { ok: false; error: string };

function validarItem(raw: unknown): { ok: true; item: ItemPresupuesto } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'items' };
  const o = raw as Record<string, unknown>;

  const title = texto(o.title, 200);
  if (!title) return { ok: false, error: 'title' };
  const productUrl = texto(o.productUrl, 500);
  if (!productUrl || !esUrl(productUrl)) return { ok: false, error: 'productUrl' };
  const talla = texto(o.talla, 60);
  if (!talla) return { ok: false, error: 'talla' };

  const cantidad = o.cantidad;
  if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
    return { ok: false, error: 'cantidad' };
  }

  const item: ItemPresupuesto = { title, productUrl, talla, cantidad };

  if (o.imageUrl !== undefined) {
    const imageUrl = texto(o.imageUrl, 500);
    if (!imageUrl || !esUrl(imageUrl)) return { ok: false, error: 'imageUrl' };
    item.imageUrl = imageUrl;
  }
  if (o.precio !== undefined && o.precio !== null) {
    // Precio unitario en euros. Inválido => se rechaza el presupuesto entero.
    if (typeof o.precio !== 'number' || !Number.isFinite(o.precio) || o.precio < 0) {
      return { ok: false, error: 'precio' };
    }
    item.precio = o.precio;
  }
  if (o.color !== undefined) {
    const color = texto(o.color, 60);
    if (!color) return { ok: false, error: 'color' };
    item.color = color;
  }
  if (o.personalizacion !== undefined) {
    const personalizacion = texto(o.personalizacion, 80);
    if (!personalizacion) return { ok: false, error: 'personalizacion' };
    item.personalizacion = personalizacion;
  }
  if (o.parches !== undefined) {
    if (!Array.isArray(o.parches) || o.parches.length > 10) return { ok: false, error: 'parches' };
    const parches: string[] = [];
    for (const x of o.parches) {
      const p = texto(x, 60);
      if (!p) return { ok: false, error: 'parches' };
      parches.push(p);
    }
    item.parches = parches;
  }
  if (o.notas !== undefined && o.notas !== '') {
    const notas = texto(o.notas, 300);
    if (!notas) return { ok: false, error: 'notas' };
    item.notas = notas;
  }
  return { ok: true, item };
}

export function validarPresupuesto(raw: unknown): ValidacionPresupuesto {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'payload' };
  const o = raw as Record<string, unknown>;

  if (o.hp !== undefined && o.hp !== '') return { ok: false, error: 'spam' };

  if (!Array.isArray(o.items) || o.items.length < 1 || o.items.length > MAX_ITEMS) {
    return { ok: false, error: 'items' };
  }
  const items: ItemPresupuesto[] = [];
  for (const rawItem of o.items) {
    const r = validarItem(rawItem);
    if (!r.ok) return r;
    items.push(r.item);
  }

  const c = o.cliente;
  if (typeof c !== 'object' || c === null || Array.isArray(c)) return { ok: false, error: 'cliente' };
  const co = c as Record<string, unknown>;
  const nombre = texto(co.nombre, 60);
  if (!nombre) return { ok: false, error: 'nombre' };
  const telefono = texto(co.telefono, 30);
  if (!telefono || !telefonoValido(telefono)) return { ok: false, error: 'telefono' };
  const cliente: Cliente = { nombre, telefono };
  if (co.telegram !== undefined && co.telegram !== '') {
    const telegram = texto(co.telegram, 40);
    if (!telegram || !telegramValido(telegram)) return { ok: false, error: 'telegram' };
    cliente.telegram = normalizarTelegram(telegram);
  }

  const provincia = texto(o.provincia, 60);
  if (!provincia || !PROVINCIAS.includes(provincia)) return { ok: false, error: 'provincia' };
  const localidad = texto(o.localidad, 80);
  if (!localidad) return { ok: false, error: 'localidad' };

  return { ok: true, presupuesto: { items, cliente, provincia, localidad } };
}

export function construirPieAlbum(total: number): string {
  return `🛒 <b>Presupuesto</b> — ${total} ${total === 1 ? 'artículo' : 'artículos'}`;
}

export function construirResumen(p: PresupuestoPayload): string {
  const n = p.items.length;
  const lineas: string[] = [`🛒 <b>Nuevo presupuesto (${n} ${n === 1 ? 'artículo' : 'artículos'})</b>`];

  p.items.forEach((it, i) => {
    lineas.push('');
    lineas.push(`${i + 1}. 📦 <b>${escapeHtml(it.title)}</b>`);
    const opciones = [
      `Talla: ${escapeHtml(it.talla)}`,
      it.cantidad ? `Cantidad: ${it.cantidad}` : null,
      it.color ? `Color: ${escapeHtml(it.color)}` : null,
    ].filter(Boolean) as string[];
    if (opciones.length) lineas.push(opciones.join(' · '));
    if (typeof it.precio === 'number') {
      lineas.push(it.cantidad > 1
        ? `💶 ${etiquetaPrecio(it.precio)} × ${it.cantidad} = ${etiquetaPrecio(it.precio * it.cantidad)}`
        : `💶 ${etiquetaPrecio(it.precio)}`);
    } else {
      lineas.push(`💶 ${etiquetaPrecio(null)}`);
    }
    if (it.personalizacion) lineas.push(`Personalización: ${escapeHtml(it.personalizacion)}`);
    if (it.parches?.length) lineas.push(`Parches: ${escapeHtml(it.parches.join(', '))}`);
    if (it.notas) lineas.push(`📝 Notas: ${escapeHtml(it.notas)}`);
    lineas.push(`🔗 <a href="${escapeHtml(it.productUrl)}">Ver producto</a>`);
  });

  lineas.push('');
  lineas.push(`👤 Cliente: ${escapeHtml(p.cliente.nombre)}`);
  lineas.push(`📞 <a href="tel:${escapeHtml(p.cliente.telefono.replace(/[^\d+]/g, ''))}">${escapeHtml(p.cliente.telefono)}</a>`);
  if (p.cliente.telegram) {
    lineas.push(`✈️ <a href="https://t.me/${escapeHtml(p.cliente.telegram)}">@${escapeHtml(p.cliente.telegram)}</a>`);
  }
  lineas.push(`📍 Envío: ${escapeHtml(p.localidad)} (${escapeHtml(p.provincia)}) — el envío es un extra`);
  lineas.push(hayPrecioPendiente(p.items)
    ? '💶 Total estimado: a confirmar (solo contamos los artículos con precio)'
    : `💶 Total estimado: ${etiquetaPrecio(totalEuros(p.items))}`);
  return lineas.join('\n');
}

/** Chunk image URLs into Telegram media groups (2-10 each). A single URL is
 * returned as a 1-item chunk so the caller can use sendPhoto instead. */
export function repartirAlbumes(urls: string[], max = 10): string[][] {
  const grupos: string[][] = [];
  for (let i = 0; i < urls.length; i += max) grupos.push(urls.slice(i, i + max));
  const ultimo = grupos[grupos.length - 1];
  if (grupos.length > 1 && ultimo.length < 2) {
    const previo = grupos[grupos.length - 2];
    ultimo.unshift(previo.pop() as string);
  }
  return grupos;
}
