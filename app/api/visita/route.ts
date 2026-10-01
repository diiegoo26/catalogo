import { NextResponse } from 'next/server';
import { permitir } from '@/lib/rate-limit';
import { supabase } from '@/lib/supabase';
import { LIMITE_VISITAS_HORA, VENTANA_VISITAS_MS, decisionVisita } from '@/lib/visitas';

// Una visita = una página cargada. El beacon no manda nada: solo pide un +1.
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocido';

  const decision = decisionVisita(req.headers.get('user-agent') ?? '', () =>
    permitir(`visita:${ip}`, Date.now(), LIMITE_VISITAS_HORA, VENTANA_VISITAS_MS),
  );

  if (!decision.cuenta) {
    return decision.motivo === 'bot'
      ? NextResponse.json({ ok: false, skipped: 'bot' }, { status: 202 })
      : NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const { data, error } = await supabase.rpc('incrementar_visitas');
  if (error) return NextResponse.json({ ok: false, error: 'db' }, { status: 502 });

  return NextResponse.json({ ok: true, total: data as number });
}
