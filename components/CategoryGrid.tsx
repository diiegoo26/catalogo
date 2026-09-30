'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { isLocalCatalogImage } from '@/lib/media';

export type CategoryTile = { id: string; name: string; href: string; image?: string | null; count?: number };

/**
 * Portada: tiles de categoría con recuento y afordance de navegación.
 * Si la imagen de la categoría falla, cae a la inicial en vez de dejar el hueco
 * en blanco (las fotos actuales son enlaces externos que pueden romperse).
 *
 * Las fotos del proveedor (/productos/…) son miniaturas de ~100 px: se muestran
 * contenidas y a tamaño natural sobre un panel suave para no ampliarlas (que es
 * lo que las deja pixeladas). Las remotas sí van a sangre con `cover`.
 */
export default function CategoryGrid({ items }: { items: CategoryTile[] }) {
  if (!items.length) return <p className="py-16 text-center text-muted">Todavía no hay categorías.</p>;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((c) => (
        <li key={c.id}>
          <Tile item={c} />
        </li>
      ))}
    </ul>
  );
}

function Flecha() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Tile({ item }: { item: CategoryTile }) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(item.image) && !broken;
  const local = isLocalCatalogImage(item.image); // miniatura del proveedor: no ampliar

  return (
    <Link href={item.href} className="card card-hover group relative block">
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        {showImage && (local ? (
          // Miniatura ~100 px: se muestra a tamaño natural (next/image la reescalaría y pixelaría).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image!}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="absolute inset-0 m-auto max-h-[74%] max-w-[74%] object-contain transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <Image
            src={item.image!}
            alt=""
            fill
            sizes="(min-width:1024px) 270px, (min-width:640px) 33vw, 50vw"
            onError={() => setBroken(true)}
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.05]"
          />
        ))}

        {!showImage && (
          <span className="absolute inset-0 grid place-items-center font-display text-4xl font-bold text-ink/15">
            {item.name[0]}
          </span>
        )}

        {/* Velo y texto solo sobre foto a sangre; en panel claro (miniatura) va en tinta. */}
        {!local && (
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5">
          <div className="min-w-0">
            <p className={`font-display text-base font-bold leading-tight ${local ? 'text-ink' : 'text-white'}`}>{item.name}</p>
            {typeof item.count === 'number' && (
              <p className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${local ? 'text-muted' : 'text-white/60'}`}>
                {item.count} {item.count === 1 ? 'producto' : 'productos'}
              </p>
            )}
          </div>
          <span
            aria-hidden
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors duration-200 ease-out ${
              local
                ? 'bg-ink/5 text-ink group-hover:bg-ink group-hover:text-white'
                : 'bg-white/15 text-white backdrop-blur group-hover:bg-white group-hover:text-ink'
            }`}
          >
            <Flecha />
          </span>
        </div>
      </div>
    </Link>
  );
}
