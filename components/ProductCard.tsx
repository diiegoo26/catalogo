import Image from 'next/image';
import Link from 'next/link';
import { groupKitsByVariant, type KitVariant } from '@/lib/kits';
import { isLocalCatalogImage } from '@/lib/media';
import type { ProductCardData } from '@/lib/types';

type CardEntry = { product: ProductCardData; variant: KitVariant | null };

// Expand each product into one entry per kit variant so every kit (Local,
// Visitante, Tercera…) is visible at a glance, instead of hiding them behind a
// selector that only shows one image at a time. Products without variant photos
// (not a kit, or unrecognised URL shape) stay as a single entry.
//
// Kit photos are unique per team+kit, but the same photo appears in several
// products of one team ("Camiseta …", "Player Versión …", "Conjunto … Niño").
// We show each kit photo only ONCE per page, keeping the first product seen
// (now that price no longer decides the winner), so a team lists just
// Local/Visitante/Tercera instead of the duplicate Player Versión / Niño products.
function expandByVariant(products: ProductCardData[]): CardEntry[] {
  const entries: CardEntry[] = [];
  const indexByImage = new Map<string, number>();
  for (const product of products) {
    const variants = groupKitsByVariant(product.images);
    if (variants.length <= 1) {
      entries.push({ product, variant: null });
      continue;
    }
    for (const variant of variants) {
      const key = variant.images[0];
      const at = indexByImage.get(key);
      if (at === undefined) {
        indexByImage.set(key, entries.length);
        entries.push({ product, variant });
      }
    }
  }
  return entries;
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  const entries = expandByVariant(products);
  if (!entries.length)
    return (
      <div className="rounded-card border border-line bg-mist px-6 py-16 text-center">
        <p className="font-display text-lg font-bold">Sin resultados</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
          No hay productos con estos filtros. Prueba a cambiar el género o explora otra categoría.
        </p>
      </div>
    );
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
      {entries.map(({ product, variant }) => (
        <li key={`${product.id}-${variant?.kind ?? 'default'}`}>
          <ProductCard p={product} variant={variant} />
        </li>
      ))}
    </ul>
  );
}

export default function ProductCard({ p, variant }: { p: ProductCardData; variant?: KitVariant | null }) {
  const variants = groupKitsByVariant(p.images);
  const image = variant?.images[0] ?? variants[0]?.images[0] ?? p.images?.[0];
  const label = variant && variants.length > 1 ? variant.label : null;

  return (
    <div className="group">
      {/* Elevación declarada una sola vez: borde en reposo, sombra al pasar el ratón. */}
      <div className="relative aspect-square overflow-hidden rounded-card bg-mist ring-1 ring-line transition-shadow duration-200 ease-out group-hover:shadow-[0_18px_40px_-24px_rgba(11,16,48,0.45)]">
        {/* Enlace redundante: el título de abajo es el punto de tabulación del producto. */}
        <Link href={`/producto/${p.slug}`} tabIndex={-1} aria-hidden className="absolute inset-0">
          {image && (isLocalCatalogImage(image) ? (
            // Miniatura del proveedor (~100 px): a ~1.5× (150 px) para que se vea con un
            // pixelado leve, ni diminuta ni ampliada a sangre. `next/image` la reescalaría
            // al tamaño de la tarjeta y la pixelaría más.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 m-auto h-[150px] w-[150px] max-w-full object-contain"
            />
          ) : (
            <Image
              src={image}
              alt=""
              fill
              sizes="(min-width:1024px) 270px, (min-width:640px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            />
          ))}
        </Link>
        {label && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-bolt px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink shadow-sm">
            {label}
          </span>
        )}
      </div>

      <div className="pt-2.5">
        {p.brand && <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{p.brand.name}</p>}
        <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
          <Link href={`/producto/${p.slug}`} className="transition-colors duration-150 ease-out group-hover:text-brand">
            {p.title}
          </Link>
        </h3>
      </div>
    </div>
  );
}
