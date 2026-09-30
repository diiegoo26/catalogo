'use client';
import Image from 'next/image';
import { useState } from 'react';
import { isLocalCatalogImage } from '@/lib/media';

export default function ProductGallery({ images, title, initialIndex }: { images: string[]; title: string; initialIndex?: number }) {
  const [active, setActive] = useState(Math.max(0, Math.min(initialIndex ?? 0, images.length - 1)));
  if (!images.length) return <div className="aspect-square rounded-card bg-mist ring-1 ring-line" />;

  const current = images[active];
  const local = isLocalCatalogImage(current);

  return (
    // Las miniaturas del proveedor son pequeñas: limitamos el ancho para no
    // ampliarlas hasta que se vean borrosas, manteniendo la foto completa.
    <div className={local ? 'mx-auto w-full max-w-[520px]' : undefined}>
      <div className="relative aspect-square overflow-hidden rounded-card bg-mist ring-1 ring-line">
        <Image
          src={current}
          alt={title}
          fill
          priority
          sizes="(min-width:768px) 50vw, 100vw"
          className={local ? 'object-contain p-4' : 'object-cover'}
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={`Imagen ${i + 1}`}
              aria-current={i === active}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-mist transition ${
                i === active ? 'border-brand' : 'border-line hover:border-ink/40'
              }`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="64px"
                className={isLocalCatalogImage(src) ? 'object-contain p-1' : 'object-cover'}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
