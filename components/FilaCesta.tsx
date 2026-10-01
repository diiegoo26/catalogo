'use client';
import Image from 'next/image';
import Link from 'next/link';
import CantidadStepper from './CantidadStepper';
import type { ItemCesta } from '@/lib/cesta';
import { etiquetaPrecio } from '@/lib/precios';

function IconoQuitar() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

type Props = {
  item: ItemCesta;
  onQuitar: () => void;
  onCantidad: (n: number) => void;
  compacta?: boolean;
};

/** One cart line: thumbnail, product link, chosen options, quantity stepper
 * and a remove control. Shared by the page and the drawer so they never drift. */
export default function FilaCesta({ item, onQuitar, onCantidad, compacta = false }: Props) {
  const thumb = compacta ? 56 : 80;
  const opciones = [item.talla, item.color, item.personalizacion, item.parches?.join(', ')]
    .filter(Boolean).join(' · ');
  const precio = typeof item.precio === 'number' ? etiquetaPrecio(item.precio) : 'A consultar';

  return (
    <li className={`flex gap-4 ${compacta ? 'py-3' : 'p-4'}`}>
      {item.imageUrl && (
        <Image
          src={item.imageUrl} alt="" width={thumb} height={thumb}
          className={`${compacta ? 'h-14 w-14' : 'h-20 w-20'} shrink-0 rounded-xl bg-mist object-cover`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={item.productUrl} className="line-clamp-2 font-medium leading-snug transition-colors hover:text-brand">
              {item.title}
            </Link>
            {opciones && <p className="mt-0.5 truncate text-xs text-muted">{opciones}</p>}
          </div>
          <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-ink">
            {precio}
          </span>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <CantidadStepper valor={item.cantidad} onChange={onCantidad} />
          {typeof item.precio === 'number' && item.cantidad > 1 && (
            <span className="text-xs text-muted tabular-nums">
              {etiquetaPrecio(item.precio * item.cantidad)} en total
            </span>
          )}
        </div>
      </div>
      <button
        type="button" onClick={onQuitar} aria-label={`Quitar ${item.title}`}
        className="shrink-0 rounded-full p-1.5 text-muted transition hover:bg-mist hover:text-red-500"
      >
        <IconoQuitar />
      </button>
    </li>
  );
}
