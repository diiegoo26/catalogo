'use client';
import { CALIDADES, etiquetaPrecio, type Calidad } from '@/lib/precios';

/**
 * Selector de calidad de una equipación, como lista de precios.
 *
 * Antes eran botones `.chip`, la misma clase que usan el color y las tallas, y el
 * importe quedaba escondido dentro de una opción de color. Aquí cada opción es
 * una fila con el nombre a la izquierda y el precio a la derecha: el importe se
 * lee sin context y ya no compite visualmente con el selector de color.
 *
 * Se usan <input type="radio"> reales (visualmente ocultos, no `display:none`)
 * para conservar la navegación con flechas y el anuncio del lector de pantalla.
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

      <div className="overflow-hidden rounded-xl border border-line">
        {CALIDADES.map((c, i) => {
          const activo = valor === c.id;
          return (
            <div key={c.id} className={i > 0 ? 'border-t border-line' : undefined}>
              <label
                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-mist ${
                  activo ? 'bg-mist' : ''
                } has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-ink/40`}
              >
                <input
                  type="radio"
                  name="calidad"
                  value={c.id}
                  checked={activo}
                  onChange={() => onChange(c.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                    activo ? 'border-ink bg-ink' : 'border-line bg-surface'
                  }`}
                />
                <span className={`text-sm ${activo ? 'font-semibold text-ink' : 'text-ink/80'}`}>{c.label}</span>
                <span className="ml-auto text-sm font-semibold tabular-nums text-ink">
                  {etiquetaPrecio(c.precio)}
                </span>
              </label>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-muted">
        {valor === 'jugador'
          ? 'La misma que llevan los jugadores en el partido.'
          : 'Mismo diseño, precio más ajustado.'}
      </p>
    </fieldset>
  );
}