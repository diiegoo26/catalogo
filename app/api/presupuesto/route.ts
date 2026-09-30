import { NextResponse } from 'next/server';
import { validarPresupuesto } from '@/lib/pedido';
import { enviarPresupuesto } from '@/lib/telegram';
import { permitir } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocido';
  if (!permitir(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const MAX_BODY = 20_000; // carts are larger than a single order but still small
  const declarado = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declarado) && declarado > MAX_BODY) {
    return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });
  }

  const texto = await req.text();
  if (texto.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(texto);
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const v = validarPresupuesto(raw);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const r = await enviarPresupuesto(v.presupuesto);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });

  return NextResponse.json({ ok: true });
}
