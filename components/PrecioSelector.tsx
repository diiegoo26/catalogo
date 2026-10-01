'use client';
import { CALIDADES, etiquetaPrecio, type Calidad } from '@/lib/precios';

/**
 * Selector de calidad de una equipación. El precio depende de la calidad
 * elegida, así que el importe se pinta dentro de cada opción: no hay un precio
 * único que mostrar aparte.
 */
export default function PrecioSelector({
  valor,
  onChange,
}: {
  valor: Calidad;
  onChange: (c: Calidad) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Calidad</legend>
      <div className="flex flex-wrap gap-2">
        {CALIDADES.map((c) => (
          <button
            key={c.id}
            type="button"
            data-active={valor === c.id}
            onClick={() => onChange(c.id)}
            className="chip"
          >
            {c.label}
            <span className="ml-1.5 font-semibold text-ink">{etiquetaPrecio(c.precio)}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {valor === 'jugador'
          ? 'La misma que llevan los jugadores en el partido.'
          : 'Mismo diseño, precio más ajustado.'}
      </p>
    </fieldset>
  );
}