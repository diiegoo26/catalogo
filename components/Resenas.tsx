'use client';
import { useState } from 'react';
import Estrellas from './Estrellas';
import type { Resena } from '@/lib/types';

const MENSAJES: Record<string, string> = {
  rate_limited: 'Has publicado varias reseñas seguidas. Vuelve a intentarlo en unos minutos.',
  spam: 'No hemos podido validar el formulario. Recarga la página e inténtalo otra vez.',
  autor: 'Escribe tu nombre (entre 2 y 40 caracteres).',
  rating: 'Elige una puntuación de 1 a 5 estrellas.',
  texto: 'El comentario debe tener entre 10 y 1000 caracteres.',
  productId: 'No encontramos este producto. Recarga la página.',
  too_large: 'El comentario es demasiado largo.',
};
const mensaje = (error?: string) =>
  (error && MENSAJES[error]) || 'No se pudo publicar la reseña. Inténtalo de nuevo.';

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

type Props = {
  /** Sin productId la reseña es de la tienda (no de un producto concreto). */
  productId?: string;
  productTitle?: string;
  iniciales: Resena[];
  media: number;
  total: number;
  /** false en la página /resenas, donde el título ya lo pone la propia página. */
  conTitulo?: boolean;
};

export default function Resenas({
  productId,
  productTitle,
  iniciales,
  media,
  total,
  conTitulo = true,
}: Props) {
  const [resenas, setResenas] = useState(iniciales);
  const [nota, setNota] = useState({ media, total });

  const [autor, setAutor] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [hp, setHp] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');

  const valido = autor.trim().length >= 2 && rating >= 1 && body.trim().length >= 10;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido || estado === 'enviando') return;
    setEstado('enviando');
    setError('');
    try {
      const r = await fetch('/api/resena', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: productId ?? null,
          productTitle,
          author: autor.trim(),
          rating,
          body: body.trim(),
          hp,
        }),
      });
      const data = (await r.json().catch(() => null)) as { ok?: boolean; resena?: Resena; error?: string } | null;
      if (r.ok && data?.ok && data.resena) {
        setResenas((prev) => [data.resena as Resena, ...prev]);
        setNota((n) => {
          const nuevoTotal = n.total + 1;
          return { media: Math.round(((n.media * n.total + rating) / nuevoTotal) * 10) / 10, total: nuevoTotal };
        });
        setAutor('');
        setRating(0);
        setBody('');
        setEstado('ok');
      } else {
        setEstado('error');
        setError(mensaje(data?.error));
      }
    } catch {
      setEstado('error');
      setError('No se pudo enviar. Revisa tu conexión e inténtalo otra vez.');
    }
  };

  return (
    <section className={conTitulo ? 'mt-12 border-t border-line pt-8' : 'mt-6'}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {conTitulo && <h2 className="font-display text-2xl font-bold tracking-tight">Reseñas</h2>}
          {nota.total > 0 ? (
            <p className={`flex items-center gap-2 text-sm text-muted ${conTitulo ? 'mt-1.5' : ''}`}>
              <Estrellas valor={nota.media} />
              <span>
                <span className="font-semibold text-ink">{nota.media.toFixed(1).replace('.', ',')}</span> de 5 ·{' '}
                {nota.total} {nota.total === 1 ? 'reseña' : 'reseñas'}
              </span>
            </p>
          ) : (
            <p className={`text-sm text-muted ${conTitulo ? 'mt-1.5' : ''}`}>Todavía no hay reseñas.</p>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Lista */}
        <div>
          {resenas.length === 0 ? (
            <div className="rounded-card border border-line bg-mist px-6 py-12 text-center">
              <p className="font-display text-lg font-bold">Sé el primero en opinar</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                {productTitle
                  ? 'Cuéntanos qué te ha parecido este producto. Tu reseña ayuda a los demás.'
                  : 'Cuéntanos cómo fue tu compra. Tu reseña ayuda a los demás.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {resenas.map((r) => (
                <li key={r.id} className="rounded-card border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Estrellas valor={r.rating} />
                    <span className="text-sm font-semibold">{r.author}</span>
                    <time dateTime={r.created_at} className="text-xs text-muted">
                      {fecha(r.created_at)}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/80">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={enviar} className="rounded-card border border-line bg-mist p-4 lg:sticky lg:top-24 lg:self-start">
          <h3 className="font-display text-base font-bold">Escribe tu reseña</h3>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Tu nombre *</span>
            <input
              value={autor}
              onChange={(e) => setAutor(e.target.value.slice(0, 40))}
              maxLength={40}
              placeholder="Ej. Marta G."
              className="field"
            />
          </label>

          <fieldset className="mt-4">
            <legend className="mb-1.5 block text-xs font-medium text-muted">Puntuación *</legend>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
                  aria-pressed={rating === n}
                  className="rounded-md p-0.5 transition-transform duration-100 ease-out hover:scale-110 active:scale-95"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                    className={`h-7 w-7 ${(hover || rating) >= n ? 'text-bolt2' : 'text-line'}`}
                  >
                    <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44 6.19 20.5l1.11-6.47L2.6 9.45l6.5-.95z" />
                  </svg>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Tu opinión *</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 1000))}
              rows={4}
              maxLength={1000}
              placeholder="¿Qué tal la calidad, la talla y el envío?"
              className="field resize-y"
            />
            <span className="mt-1 block text-right text-[11px] text-muted">{body.length}/1000</span>
          </label>

          {/* Honeypot: invisible para personas, tentador para bots. */}
          <input
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
          />

          {estado === 'error' && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          {estado === 'ok' && (
            <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              ¡Gracias! Tu reseña ya está publicada.
            </p>
          )}

          <button type="submit" disabled={!valido || estado === 'enviando'} className="btn btn-brand mt-4 w-full">
            {estado === 'enviando' ? 'Publicando…' : 'Publicar reseña'}
          </button>
          {!valido && (
            <p className="mt-2 text-center text-[11px] text-muted">
              Completa tu nombre, la puntuación y un comentario de al menos 10 caracteres.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
