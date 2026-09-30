'use client';
import Link from 'next/link';
import CestaCheckout from '@/components/CestaCheckout';
import { useCesta } from '@/components/CestaProvider';
import FilaCesta from '@/components/FilaCesta';

function IconoCesta() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20 7H6" />
      <circle cx="9.5" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
    </svg>
  );
}

export default function CestaPage() {
  const { items, quitarItem, cambiarCantidad, total } = useCesta();
  const lineas = items.length;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Tu cesta</h1>

      {lineas === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-line bg-surface px-6 py-20 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mist text-muted">
            <IconoCesta />
          </div>
          <p className="mt-4 font-display text-lg font-bold">Tu cesta está vacía</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Añade productos desde el catálogo y pídelos todos juntos en un solo presupuesto.
          </p>
          <Link href="/catalogo" className="btn btn-brand mt-6">Ver catálogo</Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section>
            <p className="mb-3 text-sm text-muted">
              {lineas} {lineas === 1 ? 'producto' : 'productos'} · {total} {total === 1 ? 'unidad' : 'unidades'}
            </p>
            <ul className="card divide-y divide-line">
              {items.map((it) => (
                <FilaCesta
                  key={it.id} item={it}
                  onQuitar={() => quitarItem(it.id)}
                  onCantidad={(n) => cambiarCantidad(it.id, n)}
                />
              ))}
            </ul>
          </section>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CestaCheckout />
          </aside>
        </div>
      )}
    </div>
  );
}
