'use client';
import Image from 'next/image';
import Link from 'next/link';
import { CANTIDAD_MAX } from '@/lib/cesta';
import { useCesta } from './CestaProvider';

export default function CestaDrawer() {
  const { items, abierto, cerrar, quitarItem, cambiarCantidad, total } = useCesta();
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={cerrar} aria-hidden />
      <aside role="dialog" aria-label="Cesta" className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-display font-bold">Tu cesta ({total})</p>
          <button type="button" onClick={cerrar} className="text-sm text-muted hover:text-ink">Cerrar</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">Tu cesta está vacía.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.id} className="flex gap-3 border-b border-line pb-3 last:border-0">
                  {it.imageUrl && (
                    <Image src={it.imageUrl} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.title}</p>
                    <p className="text-xs text-muted">{it.talla}{it.color ? ` · ${it.color}` : ''}</p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <input
                        type="number" min={1} max={CANTIDAD_MAX} value={it.cantidad}
                        onChange={(e) => cambiarCantidad(it.id, Number(e.target.value))}
                        className="w-16 rounded border border-line px-2 py-1 text-sm"
                      />
                      <button type="button" onClick={() => quitarItem(it.id)} className="text-xs text-red-500 hover:underline">Quitar</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line p-4">
          <Link href="/cesta" onClick={cerrar} className="flex w-full items-center justify-center rounded-full bg-ink py-3 font-semibold text-white">
            Ver cesta completa
          </Link>
        </div>
      </aside>
    </div>
  );
}
