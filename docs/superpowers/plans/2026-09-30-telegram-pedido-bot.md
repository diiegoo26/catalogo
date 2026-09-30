# Telegram Product Order (own bot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreliable `t.me/<user>?text=` order button with a server route that delivers the order to the shop owner's Telegram through their own bot (`@KovaZoneBot`), with no action required from the customer.

**Architecture:** The client button `POST`s a JSON order to `app/api/pedido/route.ts`, which validates it (`lib/pedido.ts`), rate-limits it (`lib/rate-limit.ts`), and hands it to `lib/telegram.ts`, which calls the Telegram Bot API (`sendPhoto` with caption, `sendMessage` fallback). Secrets stay server-only.

**Tech Stack:** Next.js 16 (App Router Route Handlers), React 19, TypeScript, Tailwind v4, vitest (node env), Telegram Bot API.

## Global Constraints

- **Repo is NOT a git repository** — there is no commit step. Replace every "Commit" with a checkpoint (run the tests, confirm green).
- Secrets are **server-only**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Never prefix with `NEXT_PUBLIC_`.
- Vitest config: `tests/**/*.test.ts`, `environment: 'node'`. Import app code with **relative** paths (`../lib/...`), matching `tests/brand-counts.test.ts`.
- All user-facing copy is **Spanish** (existing UI language).
- Message parsing uses Telegram `parse_mode: 'HTML'`; every dynamic value must be HTML-escaped.
- Telegram limits: caption ≤ 1024 chars, message text ≤ 4096 chars (our messages are far shorter).
- Do not add new runtime dependencies.
- `NEXT_PUBLIC_TELEGRAM_USERNAME` is **kept** (not deleted) — it powers the plan-B fallback only.

---
### Task 1: Order payload + message builder (`lib/pedido.ts`)

**Files:**
- Create: `lib/pedido.ts`
- Test: `tests/pedido.test.ts`

**Interfaces:**
- Produces:
  - `type PedidoPayload = { title: string; productUrl: string; imageUrl?: string; price?: number; talla?: string; color?: string; personalizacion?: string; parches?: string[]; total?: number; hp?: string; elapsedMs?: number }`
  - `type Validacion = { ok: true; pedido: PedidoPayload } | { ok: false; error: string }`
  - `function escapeHtml(s: string): string`
  - `function validarPedido(raw: unknown): Validacion`
  - `function construirMensaje(p: PedidoPayload): { text: string; imageUrl?: string }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pedido.test.ts
import { describe, it, expect } from 'vitest';
import { escapeHtml, validarPedido, construirMensaje } from '../lib/pedido';

const base = { title: 'Camiseta Real Madrid 2026-27', productUrl: 'https://x.test/producto/camiseta' };

describe('escapeHtml', () => {
  it('escapes & < >', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });
});

describe('validarPedido', () => {
  it('accepts a minimal payload and trims the title', () => {
    const r = validarPedido({ ...base, title: '  Kit  ' });
    expect(r).toEqual({ ok: true, pedido: { title: 'Kit', productUrl: base.productUrl } });
  });

  it('rejects a non-object', () => {
    expect(validarPedido(null)).toEqual({ ok: false, error: 'payload' });
    expect(validarPedido([1])).toEqual({ ok: false, error: 'payload' });
  });

  it('rejects a missing title or a non-http productUrl', () => {
    expect(validarPedido({ productUrl: base.productUrl })).toEqual({ ok: false, error: 'title' });
    expect(validarPedido({ title: 'x', productUrl: 'javascript:alert(1)' })).toEqual({ ok: false, error: 'productUrl' });
  });

  it('rejects an over-long title', () => {
    expect(validarPedido({ ...base, title: 'x'.repeat(201) })).toEqual({ ok: false, error: 'title' });
  });

  it('rejects a filled honeypot and an impossibly fast submit', () => {
    expect(validarPedido({ ...base, hp: 'bot' })).toEqual({ ok: false, error: 'spam' });
    expect(validarPedido({ ...base, elapsedMs: 10 })).toEqual({ ok: false, error: 'spam' });
  });

  it('rejects a bad price and a bad parches entry', () => {
    expect(validarPedido({ ...base, price: -1 })).toEqual({ ok: false, error: 'price' });
    expect(validarPedido({ ...base, parches: ['ok', 5] })).toEqual({ ok: false, error: 'parches' });
  });

  it('keeps every provided optional field', () => {
    const r = validarPedido({ ...base, price: 85, total: 92, talla: 'M', color: 'Blanco', personalizacion: 'GARCÍA 10', parches: ['LaLiga'] });
    expect(r).toEqual({ ok: true, pedido: { title: base.title, productUrl: base.productUrl, price: 85, total: 92, talla: 'M', color: 'Blanco', personalizacion: 'GARCÍA 10', parches: ['LaLiga'] } });
  });
});

describe('construirMensaje', () => {
  it('builds the minimum message with just a product link', () => {
    const { text, imageUrl } = construirMensaje({ ...base });
    expect(text).toContain('🛒 <b>Nuevo pedido</b>');
    expect(text).toContain(`📦 <b>${base.title}</b>`);
    expect(text).toContain(`<a href="${base.productUrl}">Ver producto</a>`);
    expect(imageUrl).toBeUndefined();
  });

  it('combines talla and color on one line and escapes the title', () => {
    const { text } = construirMensaje({ title: 'A & B', productUrl: base.productUrl, talla: 'M', color: 'Negro' });
    expect(text).toContain('📦 <b>A &amp; B</b>');
    expect(text).toContain('Talla: M · Color: Negro');
  });

  it('shows the total with a breakdown when price differs, and passes the photo through', () => {
    const { text, imageUrl } = construirMensaje({ ...base, imageUrl: 'https://x.test/a.jpg', price: 85, total: 92 });
    expect(text).toContain('💰 Total:');
    expect(text).toContain('base +');
    expect(imageUrl).toBe('https://x.test/a.jpg');
  });

  it('shows only the total when price equals total', () => {
    const { text } = construirMensaje({ ...base, price: 85, total: 85 });
    expect(text).toContain('💰 Total:');
    expect(text).not.toContain('base +');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/pedido.test.ts`
Expected: FAIL — cannot resolve `../lib/pedido`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/pedido.ts
import { eur } from './format';

export type PedidoPayload = {
  title: string;
  productUrl: string;
  imageUrl?: string;
  price?: number;
  talla?: string;
  color?: string;
  personalizacion?: string;
  parches?: string[];
  total?: number;
  hp?: string;
  elapsedMs?: number;
};

export type Validacion =
  | { ok: true; pedido: PedidoPayload }
  | { ok: false; error: string };

const MIN_ELAPSED_MS = 1500;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

function numero(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000 ? v : null;
}

const esUrl = (s: string) => /^https?:\/\//i.test(s);

export function validarPedido(raw: unknown): Validacion {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'payload' };
  const o = raw as Record<string, unknown>;

  if (o.hp !== undefined && o.hp !== '') return { ok: false, error: 'spam' };
  if (typeof o.elapsedMs === 'number' && o.elapsedMs < MIN_ELAPSED_MS) return { ok: false, error: 'spam' };

  const title = texto(o.title, 200);
  if (!title) return { ok: false, error: 'title' };
  const productUrl = texto(o.productUrl, 500);
  if (!productUrl || !esUrl(productUrl)) return { ok: false, error: 'productUrl' };

  const pedido: PedidoPayload = { title, productUrl };

  if (o.imageUrl !== undefined) {
    const imageUrl = texto(o.imageUrl, 500);
    if (!imageUrl || !esUrl(imageUrl)) return { ok: false, error: 'imageUrl' };
    pedido.imageUrl = imageUrl;
  }
  if (o.price !== undefined) {
    const price = numero(o.price);
    if (price === null) return { ok: false, error: 'price' };
    pedido.price = price;
  }
  if (o.total !== undefined) {
    const total = numero(o.total);
    if (total === null) return { ok: false, error: 'total' };
    pedido.total = total;
  }
  if (o.talla !== undefined) {
    const talla = texto(o.talla, 60);
    if (!talla) return { ok: false, error: 'talla' };
    pedido.talla = talla;
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
    p.talla ? `Talla: ${escapeHtml(p.talla)}` : null,
    p.color ? `Color: ${escapeHtml(p.color)}` : null,
  ].filter(Boolean) as string[];
  if (opciones.length) lineas.push(opciones.join(' · '));

  if (p.personalizacion) lineas.push(`Personalización: ${escapeHtml(p.personalizacion)}`);
  if (p.parches?.length) lineas.push(`Parches: ${escapeHtml(p.parches.join(', '))}`);

  if (p.total !== undefined) {
    const extras = p.price !== undefined ? Math.round((p.total - p.price) * 100) / 100 : 0;
    lineas.push(
      extras > 0
        ? `💰 Total: ${eur(p.total)} (${eur(p.price as number)} base + ${eur(extras)} extras)`
        : `💰 Total: ${eur(p.total)}`,
    );
  } else if (p.price !== undefined) {
    lineas.push(`💰 Precio: ${eur(p.price)}`);
  }

  lineas.push(`🔗 <a href="${escapeHtml(p.productUrl)}">Ver producto</a>`);

  return { text: lineas.join('\n'), imageUrl: p.imageUrl };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/pedido.test.ts`
Expected: PASS (all cases green).

---

### Task 2: Rate limiter (`lib/rate-limit.ts`)

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `tests/rate-limit.test.ts`

**Interfaces:**
- Produces:
  - `function permitir(key: string, ahora?: number, max?: number, ventanaMs?: number): boolean`
  - `function limpiarRateLimit(): void`

- [ ] **Step 1: Write the failing test**

```ts
// tests/rate-limit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { permitir, limpiarRateLimit } from '../lib/rate-limit';

beforeEach(() => limpiarRateLimit());

describe('permitir', () => {
  it('allows up to max hits in a window', () => {
    const t = 1_000_000;
    expect(permitir('ip', t, 3, 1000)).toBe(true);
    expect(permitir('ip', t + 1, 3, 1000)).toBe(true);
    expect(permitir('ip', t + 2, 3, 1000)).toBe(true);
    expect(permitir('ip', t + 3, 3, 1000)).toBe(false);
  });

  it('forgets hits older than the window', () => {
    expect(permitir('ip', 0, 1, 1000)).toBe(true);
    expect(permitir('ip', 500, 1, 1000)).toBe(false);
    expect(permitir('ip', 1001, 1, 1000)).toBe(true);
  });

  it('tracks keys independently', () => {
    expect(permitir('a', 0, 1, 1000)).toBe(true);
    expect(permitir('b', 0, 1, 1000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/rate-limit.test.ts`
Expected: FAIL — cannot resolve `../lib/rate-limit`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/rate-limit.ts
const hits = new Map<string, number[]>();

export function permitir(key: string, ahora: number = Date.now(), max = 5, ventanaMs = 60_000): boolean {
  const previos = (hits.get(key) ?? []).filter((t) => ahora - t < ventanaMs);
  if (previos.length >= max) {
    hits.set(key, previos);
    return false;
  }
  previos.push(ahora);
  hits.set(key, previos);
  return true;
}

/** Test helper: clears all counters. */
export function limpiarRateLimit(): void {
  hits.clear();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/rate-limit.test.ts`
Expected: PASS.

---

### Task 3: Telegram sender (`lib/telegram.ts`)

**Files:**
- Create: `lib/telegram.ts`
- Test: `tests/telegram.test.ts`

**Interfaces:**
- Consumes: `construirMensaje`, `PedidoPayload` from `lib/pedido.ts`.
- Produces:
  - `type EnvioResult = { ok: true } | { ok: false; error: string }`
  - `function enviarPedido(p: PedidoPayload, opts?: { fetchImpl?: typeof fetch; token?: string; chatId?: string; intentos?: number }): Promise<EnvioResult>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/telegram.test.ts
import { describe, it, expect, vi } from 'vitest';
import { enviarPedido } from '../lib/telegram';

const pedido = { title: 'Camiseta', productUrl: 'https://x.test/p' };

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/telegram.test.ts`
Expected: FAIL — cannot resolve `../lib/telegram`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/telegram.ts
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
      if (r.status < 500) return { ok: false, error: ultimo }; // 4xx: no point retrying
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/telegram.test.ts`
Expected: PASS.

---

### Task 4: Order route (`app/api/pedido/route.ts`)

**Files:**
- Create: `app/api/pedido/route.ts`

**Interfaces:**
- Consumes: `validarPedido` (`lib/pedido.ts`), `enviarPedido` (`lib/telegram.ts`), `permitir` (`lib/rate-limit.ts`).
- Produces: `POST` handler. Responses: `200 {ok:true}` · `400 {ok:false,error}` · `429 {ok:false,error:'rate_limited'}` · `502 {ok:false,error}`.

There is no unit test here (Route Handler + env wiring). This task's verification is a `tsc` typecheck plus the manual smoke test in Task 8.

- [ ] **Step 1: Write the implementation**

```ts
// app/api/pedido/route.ts
import { NextResponse } from 'next/server';
import { validarPedido } from '@/lib/pedido';
import { enviarPedido } from '@/lib/telegram';
import { permitir } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocido';
  if (!permitir(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const v = validarPedido(raw);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const r = await enviarPedido(v.pedido);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from the new file.

---

### Task 5: Telegram button component (`components/BotonTelegram.tsx`)

**Files:**
- Create: `components/BotonTelegram.tsx`

**Interfaces:**
- Produces:
  - `type Estado = 'idle' | 'enviando' | 'enviado' | 'error'`
  - default export `BotonTelegram({ onPedir, resetKey, label }: { onPedir: () => Promise<boolean>; resetKey?: string; label?: string })`

Verification: `npx tsc --noEmit` (used by Tasks 6 and 7).

- [ ] **Step 1: Write the component**

```tsx
// components/BotonTelegram.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

export type Estado = 'idle' | 'enviando' | 'enviado' | 'error';

type Props = {
  onPedir: () => Promise<boolean>;
  resetKey?: string;
  label?: string;
};

export default function BotonTelegram({ onPedir, resetKey, label = 'Pedir por Telegram' }: Props) {
  const [estado, setEstado] = useState<Estado>('idle');
  const enVuelo = useRef(false);

  useEffect(() => {
    setEstado('idle');
  }, [resetKey]);

  const pulsar = async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setEstado('enviando');
    try {
      const ok = await onPedir();
      setEstado(ok ? 'enviado' : 'error');
    } catch {
      setEstado('error');
    } finally {
      enVuelo.current = false;
    }
  };

  const etiqueta =
    estado === 'enviando' ? 'Enviando…'
    : estado === 'enviado' ? 'Pedido enviado ✓'
    : estado === 'error' ? 'No se pudo enviar. Reintentar'
    : label;

  return (
    <button
      onClick={pulsar}
      disabled={estado === 'enviando' || estado === 'enviado'}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#229ED9] py-3.5 font-semibold text-white transition hover:bg-[#1b8dc4] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <LogoTelegram />
      {etiqueta}
    </button>
  );
}

function LogoTelegram() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 6: Refactor `ProductPurchase` to use the route

**Files:**
- Modify: `components/ProductPurchase.tsx` (whole file)
- Modify: `app/producto/[slug]/page.tsx:62`

**Interfaces:**
- Consumes: `BotonTelegram` (Task 5), `POST /api/pedido` (Task 4).
- Produces: `ProductPurchase({ title, variants, price, imageUrl })` — two new props.

- [ ] **Step 1: Replace the component**

```tsx
// components/ProductPurchase.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import BotonTelegram from './BotonTelegram';
import type { Variant } from '@/lib/types';

const TELEGRAM_USER = process.env.NEXT_PUBLIC_TELEGRAM_USERNAME; // sin @ — solo respaldo

export default function ProductPurchase({ title, variants, price, imageUrl }: {
  title: string; variants: Variant[]; price?: number; imageUrl?: string;
}) {
  const sizes  = useMemo(() => [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[], [variants]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[], [variants]);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [aviso, setAviso] = useState(false);
  const montadoEn = useRef(0);
  useEffect(() => { montadoEn.current = Date.now(); }, []);

  const inStock = (s?: string | null, c?: string | null) =>
    variants.some((v) => (!s || v.size === s) && (!c || v.color === c) && v.stock > 0);

  const pedir = async (): Promise<boolean> => {
    setAviso(false);
    const productUrl = window.location.href;
    try {
      const r = await fetch('/api/pedido', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title, productUrl, imageUrl, price,
          talla: size ?? undefined, color: color ?? undefined,
          elapsedMs: Date.now() - montadoEn.current, hp: '',
        }),
      });
      if (r.ok) return true;
    } catch { /* cae al respaldo */ }

    // Plan B: copiar el pedido y ofrecer el chat directo
    if (TELEGRAM_USER) {
      const text = [`Hola, quiero pedir: ${title}`, size && `Talla: ${size}`, color && `Color: ${color}`, productUrl]
        .filter(Boolean).join('\n');
      try { await navigator.clipboard.writeText(text); setAviso(true); } catch { /* ignore */ }
    }
    return false;
  };

  const chip = (active: boolean, disabled: boolean) =>
    `min-w-12 rounded-lg border px-3 py-2 text-sm transition ${
      disabled ? 'cursor-not-allowed border-neutral-200 text-neutral-300 line-through'
      : active ? 'border-neutral-900 bg-neutral-900 text-white'
      : 'border-neutral-300 hover:border-neutral-900'}`;

  return (
    <div className="space-y-5">
      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Talla</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const disabled = !inStock(s, color);
              return <button key={s} disabled={disabled} onClick={() => setSize(s)} className={chip(size === s, disabled)}>{s}</button>;
            })}
          </div>
        </div>
      )}
      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const disabled = !inStock(size, c);
              return <button key={c} disabled={disabled} onClick={() => setColor(c)} className={chip(color === c, disabled)}>{c}</button>;
            })}
          </div>
        </div>
      )}
      <BotonTelegram onPedir={pedir} resetKey={`${size ?? ''}|${color ?? ''}`} />
      {aviso && (
        <p className="text-center text-xs text-neutral-500">
          No se pudo enviar. Mensaje copiado:{' '}
          <a className="underline" href={`https://t.me/${TELEGRAM_USER}`} target="_blank" rel="noreferrer">
            pégalo en Telegram
          </a>.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Pass the new props from the product page**

In `app/producto/[slug]/page.tsx`, replace the `ProductPurchase` usage:

```tsx
<ProductPurchase title={p.title} variants={p.variants} price={p.price} imageUrl={p.images[0]} />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

---

### Task 7: Refactor `KitCustomizer` to use the route

**Files:**
- Modify: `components/KitCustomizer.tsx` (whole file)
- Modify: `app/producto/[slug]/page.tsx:59-60`

**Interfaces:**
- Consumes: `BotonTelegram` (Task 5), `POST /api/pedido` (Task 4), `calcularTotal` (`lib/precios.ts`).
- Produces: `KitCustomizer({ title, variants, basePrice, players, patches, imageUrl })` — one new prop.

- [ ] **Step 1: Replace the order wiring and button (keep the rest of the JSX)**

Start from the current `components/KitCustomizer.tsx` and apply exactly these changes:

1. Replace the `order` function (lines ~49-69) with:

```tsx
  const pedir = async (): Promise<boolean> => {
    setAviso(false);
    const personalizacion = conImpresion && numeroValido
      ? [nombre && `${nombre}`, numero && `${numero}`, jugadorId ? '(plantilla)' : ''].filter(Boolean).join(' ')
      : undefined;
    const productUrl = window.location.href;
    try {
      const r = await fetch('/api/pedido', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title, productUrl, imageUrl,
          price: basePrice, total,
          talla: size ?? undefined, color: color ?? undefined,
          personalizacion,
          parches: conParches ? patches.map((p) => p.name) : undefined,
          elapsedMs: Date.now() - montadoEn.current, hp: '',
        }),
      });
      if (r.ok) return true;
    } catch { /* cae al respaldo */ }

    if (TELEGRAM_USER) {
      const text = [`Hola, quiero pedir: ${title}`, size && `Talla: ${size}`, color && `Color: ${color}`,
        personalizacion && `Personalización: ${personalizacion}`, productUrl].filter(Boolean).join('\n');
      try { await navigator.clipboard.writeText(text); setAviso(true); } catch { /* ignore */ }
    }
    return false;
  };
```

2. Change the `copied` state to `aviso`: replace `const [copied, setCopied] = useState(false);` with `const [aviso, setAviso] = useState(false);` and remove the now-unused `const [copied, setCopied]` if present. Also drop `ready`/`puedePedir` gating on the button.

2b. Add the mount-time ref so `elapsedMs` measures time since mount (not page load — approved change):
   - Add `useEffect` and `useRef` to the existing `import { useMemo, useState } from 'react';`.
   - After the `aviso` state, add:
     ```tsx
     const montadoEn = useRef(0);
     useEffect(() => { montadoEn.current = Date.now(); }, []);
     ```

3. Update the props type and signature to add `imageUrl`:

```tsx
type Props = {
  title: string;
  variants: Variant[];
  basePrice: number;
  players: Player[];
  patches: PatchBadge[];
  imageUrl?: string;
};
```

and the component signature becomes `export default function KitCustomizer({ title, variants, basePrice, players, patches, imageUrl }: Props) {`.

4. Replace the old button block (lines ~164-172) with:

```tsx
      <BotonTelegram onPedir={pedir} resetKey={`${size ?? ''}|${color ?? ''}|${nombre}|${numero}`} />
      {aviso && (
        <p className="text-center text-xs text-neutral-500">
          No se pudo enviar. Mensaje copiado:{' '}
          <a className="underline" href={`https://t.me/${TELEGRAM_USER}`} target="_blank" rel="noreferrer">
            pégalo en Telegram
          </a>.
        </p>
      )}
```

5. Add the import at the top: `import BotonTelegram from './BotonTelegram';`

Note: the button is now **always active** (per approved spec). The `numeroValido` red hint stays, and an invalid number simply omits `personalizacion` from the payload.

- [ ] **Step 2: Pass the new prop from the product page**

In `app/producto/[slug]/page.tsx`, update the `KitCustomizer` usage:

```tsx
<KitCustomizer title={p.title} variants={p.variants}
  basePrice={p.price} players={players} patches={patches} imageUrl={p.images[0]} />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors, no unused-import warnings.

---

### Task 8: Setup script, env docs, and smoke test

**Files:**
- Create: `scripts/telegram-whoami.mjs`
- Modify: `package.json` (add script)
- Modify: `.env.local.example`

**Interfaces:**
- Produces: `npm run telegram:whoami` — prints every `chat_id` that has written to the bot.

- [ ] **Step 1: Write the helper script**

```js
// scripts/telegram-whoami.mjs
// Prints the chat_id(s) that have messaged the bot, so you can fill TELEGRAM_CHAT_ID.
import { readFileSync } from 'node:fs';

function token() {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const m = env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* no .env.local */ }
  return '';
}

const t = token();
if (!t) {
  console.error('Falta TELEGRAM_BOT_TOKEN (en el entorno o en .env.local).');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${t}/getUpdates`);
const data = await res.json();
if (!data.ok) {
  console.error('Telegram respondió con error:', data.description ?? res.status);
  process.exit(1);
}

const chats = new Map();
for (const u of data.result ?? []) {
  const c = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat;
  if (c) chats.set(c.id, c);
}

if (chats.size === 0) {
  console.log('No hay mensajes todavía. Escribe algo al bot en Telegram y vuelve a ejecutar este script.');
  process.exit(0);
}

for (const [id, c] of chats) {
  const nombre = c.title ?? [c.first_name, c.last_name].filter(Boolean).join(' ');
  console.log(`TELEGRAM_CHAT_ID=${id}   (${nombre}${c.username ? ' @' + c.username : ''})`);
}
```

- [ ] **Step 2: Register the npm script**

In `package.json` `scripts`, add:

```json
"telegram:whoami": "node scripts/telegram-whoami.mjs"
```

- [ ] **Step 3: Document the environment variables**

Replace the contents of `.env.local.example` with:

```
NEXT_PUBLIC_SUPABASE_URL=https://lekygyoeiviygjdqmvom.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu anon key>
# Bot de Telegram (solo servidor — nunca NEXT_PUBLIC_)
TELEGRAM_BOT_TOKEN=123456:ABC-tu-token-de-@BotFather
TELEGRAM_CHAT_ID=123456789
# Opcional: respaldo si falla el envío (enlace t.me directo)
NEXT_PUBLIC_TELEGRAM_USERNAME=tu_usuario_telegram
```

- [ ] **Step 4: Run the helper against the real bot**

Run: `npm run telegram:whoami`
Expected: prints `TELEGRAM_CHAT_ID=1055133821   (Diego Corral @DiegoCorral)`.

- [ ] **Step 5: Smoke test the full flow**

Run: `npm run dev` in one terminal. With `.env.local` already holding `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID=1055133821`, open a product page, pick a size/color, press "Pedir por Telegram", and confirm a photo message with the order arrives in Telegram. Then check the same for a kit page (customization + patches).

- [ ] **Step 6: Full test suite + typecheck**

Run: `npm test` then `npx tsc --noEmit` then `npm run lint`
Expected: all green.

---

## Self-Review

**Spec coverage:**
- Own-bot, notify owner only → Tasks 3, 4, 6, 7.
- Server-only token/chat_id → Tasks 3, 4, 8; `.env.local.example` documents it.
- Own route `/api/pedido` → Task 4.
- Reusable branded button with states → Task 5.
- Always-active button → Tasks 6, 7 (gating removed).
- Formatted message + product photo → Tasks 1 (message) and 3 (`sendPhoto`).
- Fallback to text when the photo fails → Task 3 (tested).
- One retry on transient error → Task 3.
- Client never hangs → Task 5 (`enVuelo` guard) and `try/finally`.
- Plan B (clipboard + `t.me`) → Tasks 6, 7; `NEXT_PUBLIC_TELEGRAM_USERNAME` kept.
- Validation + honeypot + timing → Task 1 (tested).
- Rate limit, noted serverless limitation → Task 2.
- `telegram:whoami` script → Task 8.
- Unit tests → Tasks 1, 2, 3.

**Placeholder scan:** no TBD/TODO; every code step has full code. Task 7 is expressed as guided edits against the existing file (the file is 175 lines; a full rewrite would duplicate unchanged JSX), with the exact code for every changed region.

**Type consistency:** `PedidoPayload`, `Validacion`, `EnvioResult`, `Estado`, `permitir`, `enviarPedido`, `construirMensaje` keep the same names/signatures across tasks. Failure error strings (`payload`, `title`, `productUrl`, `imageUrl`, `price`, `total`, `talla`, `color`, `personalizacion`, `parches`, `spam`, `bad_json`, `rate_limited`, `no_config`, `http_<n>`, `network`) are used consistently.
