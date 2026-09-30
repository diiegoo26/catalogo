import Image from 'next/image';
import Link from 'next/link';

export type CardItem = { id: string; name: string; href: string; image?: string | null; meta?: string };

/** Grid reutilizable: categorías, países, ligas, equipos, marcas. */
export default function CardGrid({
  items,
  variant = 'logo',
}: {
  items: CardItem[];
  variant?: 'logo' | 'photo' | 'cover';
}) {
  if (!items.length)
    return (
      <div className="rounded-card border border-line bg-mist px-6 py-16 text-center">
        <p className="font-display text-lg font-bold">Nada por aquí todavía</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
          Esta sección se está completando. Vuelve pronto o explora otra categoría.
        </p>
      </div>
    );

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((i) => (
        <li key={i.id}>
          {variant === 'cover' ? (
            <Link href={i.href} className="card card-hover group relative block">
              <div className="relative aspect-[4/3] overflow-hidden bg-mist">
                {i.image ? (
                  <Image
                    src={i.image}
                    alt=""
                    fill
                    sizes="(min-width:1024px) 25vw, 50vw"
                    className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.05]"
                  />
                ) : (
                  <span className="absolute inset-0 grid place-items-center font-display text-4xl font-bold text-ink/15">
                    {i.name[0]}
                  </span>
                )}
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink/90 via-ink/35 to-transparent"
                />
                <p className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold text-white">{i.name}</p>
              </div>
            </Link>
          ) : (
            <Link href={i.href} className="card card-hover group flex h-full flex-col">
              <div className={`relative bg-mist ${variant === 'photo' ? 'aspect-[4/3]' : 'aspect-square'}`}>
                {i.image ? (
                  <Image
                    src={i.image}
                    alt=""
                    fill
                    sizes="(min-width:1024px) 25vw, 50vw"
                    className={
                      variant === 'photo'
                        ? 'object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]'
                        : 'object-contain p-6'
                    }
                  />
                ) : (
                  <span className="absolute inset-0 grid place-items-center font-display text-4xl font-bold text-ink/15">
                    {i.name[0]}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-0.5 p-3 text-center">
                <p className="text-sm font-medium leading-snug transition-colors duration-150 ease-out group-hover:text-brand">
                  {i.name}
                </p>
                {i.meta && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{i.meta}</p>
                )}
              </div>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
