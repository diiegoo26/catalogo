'use client';
import Link from 'next/link';
import FilaCesta from './FilaCesta';
import TotalCesta from './TotalCesta';
import { useCesta } from './CestaProvider';

function IconoCerrar() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function CestaDrawer() {
  const { items, abierto, cerrar, quitarItem, cambiarCantidad, total } = useCesta();
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="kz-fade absolute inset-0 bg-ink/50 backdrop-blur-[1px]" onClick={cerrar} aria-hidden />
      <aside role="dialog" aria-label="Cesta" className="kz-slide-in absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-display font-bold">Tu cesta{total > 0 ? ` · ${total}` : ''}</p>
          <button
            type="button" onClick={cerrar} aria-label="Cerrar cesta"
            className="rounded-full p-1.5 text-muted transition hover:bg-mist hover:text-ink"
          >
            <IconoCerrar />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-display font-bold">Tu cesta está vacía</p>
              <p className="mx-auto mt-1.5 max-w-[16rem] text-sm text-muted">
                Añade productos desde el catálogo para pedir un presupuesto.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((it) => (
                <FilaCesta
                  key={it.id} item={it} compacta
                  onQuitar={() => quitarItem(it.id)}
                  onCantidad={(n) => cambiarCantidad(it.id, n)}
                />
              ))}
            </ul>
          )}
        </div>

          {items.length > 0 && (
            <div className="border-t border-line px-4 py-3">
              <TotalCesta items={items} compacta />
            </div>
          )}

        <div className="border-t border-line p-4">
          {items.length === 0 ? (
            <Link href="/" onClick={cerrar} className="btn btn-outline w-full">Ver productos</Link>
          ) : (
            <Link href="/cesta" onClick={cerrar} className="btn btn-brand w-full">Continuar</Link>
          )}
        </div>
      </aside>
    </div>
  );
}
