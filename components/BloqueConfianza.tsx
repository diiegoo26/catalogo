import Estrellas from './Estrellas';

const NUMERO = new Intl.NumberFormat('es-ES');

/**
 * Fila de confianza de la portada: nota media, número de opiniones y visitas.
 * Cada dato se pinta solo si tiene valor; sin ninguno, no se pinta nada.
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
  if (!hayOpinion && !hayVisitas) return null;

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
          <span className="font-semibold text-ink">{NUMERO.format(visitas)}</span>
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
