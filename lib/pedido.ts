import { normalizarTelegram, telefonoValido, telegramValido } from './cliente';
import { PROVINCIAS } from './provincias';
import type { ItemPresupuesto } from './cesta';

export type PedidoPayload = {
  title: string;
  productUrl: string;
  imageUrl?: string;
  talla: string;
  cantidad?: number;
  color?: string;
  personalizacion?: string;
  parches?: string[];
  notas?: string;
  nombre: string;
  telefono: string;
  telegram?: string;
  hp?: string;
};

export type Validacion =
  | { ok: true; pedido: PedidoPayload }
  | { ok: false; error: string };

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

export function validarPedido(raw: unknown): Validacion {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'payload' };
  const o = raw as Record<string, unknown>;

  if (o.hp !== undefined && o.hp !== '') return { ok: false, error: 'spam' };

  const title = texto(o.title, 200);
  if (!title) return { ok: false, error: 'title' };
  const productUrl = texto(o.productUrl, 500);
  if (!productUrl || !esUrl(productUrl)) return { ok: false, error: 'productUrl' };

  const nombre = texto(o.nombre, 60);
  if (!nombre) return { ok: false, error: 'nombre' };
  const telefono = texto(o.telefono, 30);
  if (!telefono || !telefonoValido(telefono)) return { ok: false, error: 'telefono' };
  const talla = texto(o.talla, 60);
  if (!talla) return { ok: false, error: 'talla' };

  const pedido: PedidoPayload = { title, productUrl, nombre, telefono, talla };

  if (o.cantidad !== undefined) {
    const cantidad = o.cantidad;
    if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
      return { ok: false, error: 'cantidad' };
    }
    pedido.cantidad = cantidad;
  }
  if (o.notas !== undefined && o.notas !== '') {
    const notas = texto(o.notas, 300);
    if (!notas) return { ok: false, error: 'notas' };
    pedido.notas = notas;
  }

  if (o.telegram !== undefined && o.telegram !== '') {
    const telegram = texto(o.telegram, 40);
    if (!telegram || !telegramValido(telegram)) return { ok: false, error: 'telegram' };
    pedido.telegram = normalizarTelegram(telegram);
  }

  if (o.imageUrl !== undefined) {
    const imageUrl = texto(o.imageUrl, 500);
    if (!imageUrl || !esUrl(imageUrl)) return { ok: false, error: 'imageUrl' };
    pedido.imageUrl = imageUrl;
  }
  if (o.color !== undefined) {
    const color = texto(o.color, 60);
    if (!color) return { ok: false, error: 'color' };
    pedido.color = color;
  }
  if (o.personalizacion !== undefined) {
    const personalizacion = texto(o.personalizacion, 80);
    if (!personalizacion) return { ok: false, error: 'personalizacion' };
    pedido.personalizacion = personalizacion;
  }
  if (o.parches !== undefined) {
    if (!Array.isArray(o.parches) || o.parches.length > 10) return { ok: false, error: 'parches' };
    const parches: string[] = [];
    for (const x of o.parches) {
      const p = texto(x, 60);
      if (!p) return { ok: false, error: 'parches' };
      parches.push(p);
    }
    pedido.parches = parches;
  }
  return { ok: true, pedido };
}

export function construirMensaje(p: PedidoPayload): { text: string; imageUrl?: string } {
  const lineas: string[] = ['🛒 <b>Nuevo pedido</b>', `📦 <b>${escapeHtml(p.title)}</b>`];

  const opciones = [
    `Talla: ${escapeHtml(p.talla)}`,
    p.cantidad ? `Cantidad: ${p.cantidad}` : null,
    p.color ? `Color: ${escapeHtml(p.color)}` : null,
  ].filter(Boolean) as string[];
  if (opciones.length) lineas.push(opciones.join(' · '));

  if (p.personalizacion) lineas.push(`Personalización: ${escapeHtml(p.personalizacion)}`);
  if (p.parches?.length) lineas.push(`Parches: ${escapeHtml(p.parches.join(', '))}`);
  if (p.notas) lineas.push(`📝 Notas: ${escapeHtml(p.notas)}`);

  lineas.push(`👤 Cliente: ${escapeHtml(p.nombre)}`);
  lineas.push(`📞 <a href="tel:${escapeHtml(p.telefono.replace(/[^\d+]/g, ''))}">${escapeHtml(p.telefono)}</a>`);
  if (p.telegram) {
    lineas.push(`✈️ <a href="https://t.me/${escapeHtml(p.telegram)}">@${escapeHtml(p.telegram)}</a>`);
  }
  return { text: lineas.join('\n'), imageUrl: p.imageUrl };
}

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
