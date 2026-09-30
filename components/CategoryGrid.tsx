'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export type CategoryTile = { id: string; name: string; href: string; image?: string | null; count?: number };

/**
 * Portada: tiles de categoría a sangre con recuento y afordance de navegación.
 * Si la imagen de la categoría falla, cae a la inicial en vez de dejar el hueco
 * en blanco (las fotos actuales son enlaces externos que pueden romperse).
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

function Tile({ item }: { item: CategoryTile }) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(item.image) && !broken;

  return (
    <Link href={item.href} className="card card-hover group relative block">
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        {showImage ? (
          <Image
            src={item.image!}
            alt=""
            fill
            sizes="(min-width:1024px) 25vw, 50vw"
            onError={() => setBroken(true)}
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-display text-4xl font-bold text-ink/15">
            {item.name[0]}
          </span>
        )}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5">
          <div className="min-w-0">
            <p className="font-display text-base font-bold leading-tight text-white">{item.name}</p>
            {typeof item.count === 'number' && (
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
                {item.count} {item.count === 1 ? 'producto' : 'productos'}
              </p>
            )}
          </div>
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors duration-200 ease-out group-hover:bg-white group-hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
