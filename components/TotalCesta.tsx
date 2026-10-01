'use client';
import { hayPrecioPendiente, totalEuros, type ItemCesta } from '@/lib/cesta';
import { etiquetaPrecio } from '@/lib/precios';

/**
 * Total de la cesta, compartido por el drawer y la página para que no diverjan.
 *
 * Si alguna línea es "a consultar" NO mostramos la suma de las que sí tienen
 * precio: una cifra parcial se leería como el total real y quedaría por debajo
 * del presupuesto. En ese caso el total lo dice explícitamente.
 */
export default function TotalCesta({ items, compacta = false }: { items: ItemCesta[]; compacta?: boolean }) {
  const pendiente = hayPrecioPendiente(items);
  return (
    <div className={compacta ? undefined : 'rounded-2xl border border-line bg-surface p-4'}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">Total estimado</span>
        <span className={`font-display font-bold tabular-nums text-ink ${compacta ? 'text-lg' : 'text-xl'}`}>
          {pendiente ? 'A confirmar' : etiquetaPrecio(totalEuros(items))}
        </span>
      </div>
      {pendiente && (
        <p className="mt-1 text-xs text-muted">
          Incluimos solo los artículos con precio. Te confirmamos el resto al responder.
        </p>
      )}
    </div>
  );
}