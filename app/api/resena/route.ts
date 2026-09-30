import { NextResponse } from 'next/server';
import { permitir } from '@/lib/rate-limit';
import { construirMensajeResena, validarResena } from '@/lib/resenas';
import { supabase } from '@/lib/supabase';
import { enviarMensaje } from '@/lib/telegram';

// Las reseñas se publican al instante; el dueño recibe un aviso por Telegram.
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocido';

  const MAX_BODY = 5_000;
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

  const v = validarResena(raw);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const { resena } = v;

  // El cupo se consume solo con envíos válidos: un despiste al escribir no
  // bloquea al cliente. Clave propia, no comparte cupo con los pedidos.
  if (!permitir(`resena:${ip}`, Date.now(), 3, 600_000)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  // El producto debe existir de verdad; así el aviso lleva su título real.
  if (resena.productId) {
    const { data } = await supabase.from('products').select('title').eq('id', resena.productId).maybeSingle();
    if (!data) return NextResponse.json({ ok: false, error: 'productId' }, { status: 400 });
    resena.productTitle = (data as { title: string }).title;
  }

  const { data: creada, error } = await supabase
    .from('reviews')
    .insert({ product_id: resena.productId, author: resena.author, rating: resena.rating, body: resena.body })
    .select('id,product_id,author,rating,body,created_at')
    .single();

  if (error) return NextResponse.json({ ok: false, error: 'db' }, { status: 502 });

  // Aviso al dueño: la reseña ya está guardada, así que un fallo aquí no la tumba.
  try {
    await enviarMensaje(construirMensajeResena(resena));
  } catch {
    /* silencio: la reseña ya está publicada */
  }

  return NextResponse.json({ ok: true, resena: creada });
}
