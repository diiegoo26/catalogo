'use client';
import Image from 'next/image';
import { useState } from 'react';

export default function ProductGallery({ images, title, initialIndex }: { images: string[]; title: string; initialIndex?: number }) {
  const [active, setActive] = useState(Math.max(0, Math.min(initialIndex ?? 0, images.length - 1)));
  if (!images.length) return <div className="aspect-square rounded-card bg-mist ring-1 ring-line" />;
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-card bg-mist ring-1 ring-line">
        <Image src={images[active]} alt={title} fill priority sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={`Imagen ${i + 1}`}
              aria-current={i === active}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                i === active ? 'border-brand' : 'border-line hover:border-ink/40'
              }`}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
