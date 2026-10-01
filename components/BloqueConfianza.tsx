'use client';
import { useEffect, useState } from 'react';
import Estrellas from './Estrellas';

const NUMERO = new Intl.NumberFormat('es-ES');
const DURACION = 1_200;

/**
 * Curva de salida: rápido al principio y frenando al final, como un contador
 * mecánico. Es la misma easing del proyecto (kz-rise / kz-slide-in).
 */
function salida(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Fila de confianza de la portada: nota media, número de opiniones y visitas.
 * El contador de visitas sube desde 0 al montar; sin JavaScript el valor final
 * ya viene en el HTML y se ve igualmente.
 */
export default function BloqueConfianza({
  media,
  opiniones,
  visitas,
}: {
  media: number;
  opiniones: number;
  visitas: number;
}) {
  const hayOpinion = opiniones > 0 && media > 0;
  const hayVisitas = visitas > 0;
  const [contador, setContador] = useState(0);

  useEffect(() => {
    if (!visitas) return;

    let animacion = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animacion = requestAnimationFrame(() => setContador(visitas));
    } else {
      const t0 = performance.now();
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - t0) / DURACION);
        setContador(Math.round(visitas * salida(t)));
        if (t < 1) animacion = requestAnimationFrame(paso);
      };
      animacion = requestAnimationFrame(paso);
    }
    return () => cancelAnimationFrame(animacion);
  }, [visitas]);

  if (!hayOpinion && !hayVisitas) return null;

  const mostradas = hayVisitas && contador === 0 ? visitas : contador;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted">
      {hayOpinion && (
        <span className="inline-flex items-center gap-1.5">
          <Estrellas valor={media} className="h-3 w-3" />
          <span className="font-semibold text-ink">{media.toFixed(1).replace('.', ',')}</span>
          <span>{opiniones === 1 ? 'opinión' : 'opiniones'}</span>
        </span>
      )}

      {hayOpinion && hayVisitas && (
        <span aria-hidden className="select-none">
          ·
        </span>
      )}

      {hayVisitas && (
        <span className="inline-flex items-center gap-1.5">
          <Ojo className="h-3.5 w-3.5" />
          {/* El valor final se anuncia a lectores de pantalla: el número que sube es decorativo. */}
          <span className="font-semibold text-ink tabular-nums" aria-label={`${visitas} visitas`}>
            <span aria-hidden>{NUMERO.format(mostradas)}</span>
          </span>
          <span>{visitas === 1 ? 'visita' : 'visitas'}</span>
        </span>
      )}
    </div>
  );
}

/** Mismo lenguaje visual que las estrellas de Estrellas: icono SVG, no emoji. */
function Ojo({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
      className={className}
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
