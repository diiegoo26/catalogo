import Image from 'next/image';
import type { BrandWithCount } from '@/lib/types';

/** Cabecera de marca: logo, nombre y numero de productos. */
export default function BrandHeader({ brand }: { brand: BrandWithCount }) {
  const n = brand.product_count;
  return (
    <div className="mb-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
      <div className="relative size-16 shrink-0 rounded-2xl border border-line bg-white shadow-sm">
        {brand.logo_url ? (
          <Image src={brand.logo_url} alt={brand.name} fill sizes="64px" className="object-contain p-2.5" />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-display text-2xl font-bold text-ink/20">
            {brand.name[0]}
          </span>
        )}
      </div>
      <div>
        <p className="eyebrow mb-1.5">Marca</p>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{brand.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {n} producto{n === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}
