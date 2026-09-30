'use client';
import Image from 'next/image';
import Link from 'next/link';
import CestaCheckout from '@/components/CestaCheckout';
import { useCesta } from '@/components/CestaProvider';
import { CANTIDAD_MAX } from '@/lib/cesta';

export default function CestaPage() {
  const { items, quitarItem, cambiarCantidad, total } = useCesta();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold tracking-tight">Tu cesta</h1>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-mist px-6 py-16 text-center">
          <p className="font-display text-lg font-bold">La cesta está vacía</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">Añade productos desde el catálogo para pedir un presupuesto.</p>
          <Link href="/catalogo" className="btn btn-light mt-5 inline-flex">Ver catálogo</Link>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-4">
            {items.map((it) => (
              <li key={it.id} className="flex gap-4 border-b border-line pb-4 last:border-0">
                {it.imageUrl && <Image src={it.imageUrl} alt="" width={80} height={80} className="h-20 w-20 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{it.title}</p>
                  <p className="text-xs text-muted">
                    {it.talla}{it.color ? ` · ${it.color}` : ''}{it.personalizacion ? ` · ${it.personalizacion}` : ''}
                    {it.parches?.length ? ` · ${it.parches.join(', ')}` : ''}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <input type="number" min={1} max={CANTIDAD_MAX} value={it.cantidad}
                      onChange={(e) => cambiarCantidad(it.id, Number(e.target.value))}
                      className="w-16 rounded border border-line px-2 py-1 text-sm" />
                    <button type="button" onClick={() => quitarItem(it.id)} className="text-xs text-red-500 hover:underline">Quitar</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-right text-sm text-muted">Total: {total} {total === 1 ? 'artículo' : 'artículos'}</p>
          <div className="mt-6"><CestaCheckout /></div>
        </>
      )}
    </div>
  );
}
