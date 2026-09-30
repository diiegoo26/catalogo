import type { Metadata } from 'next';
import Image from 'next/image';
import PageHeading from '@/components/PageHeading';
import PrintButton from '@/components/PrintButton';
import { getCatalogProducts } from '@/lib/queries';

export const metadata: Metadata = { title: 'Catálogo completo' };

export default async function CatalogoPage() {
  const products = await getCatalogProducts();

  const groups = new Map<string, { name: string; sort: number; items: typeof products }>();
  for (const p of products) {
    const g = groups.get(p.category.slug)
      ?? { name: p.category.name, sort: p.category.sort_order, items: [] };
    g.items.push(p);
    groups.set(p.category.slug, g);
  }
  const ordered = [...groups.values()].sort((a, b) => a.sort - b.sort);

  return (
    <div>
      <PageHeading
        eyebrow="PDF · Temporada 2026/27"
        title="Catálogo completo"
        description={`${products.length} productos · ${ordered.length} categorías`}
        action={<PrintButton />}
      />

      {ordered.map((g) => (
        <section key={g.name} className="mb-10">
          <h2 className="mb-4 flex items-center gap-3 font-display text-lg font-bold tracking-tight">
            {g.name}
            <span className="h-px flex-1 bg-line" />
          </h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
            {g.items.map((p) => (
              <li key={p.id} className="break-inside-avoid">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-mist ring-1 ring-line">
                  {p.images?.[0] && (
                    <Image src={p.images[0]} alt={p.title} fill sizes="(min-width:1024px) 25vw, 50vw"
                      className="object-cover" />
                  )}
                </div>
                <p className="mt-2 text-xs font-medium leading-snug">{p.title}</p>
                {p.brand && (
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{p.brand.name}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
