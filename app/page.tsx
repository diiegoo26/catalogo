import Image from 'next/image';
import CategoryGrid from '@/components/CategoryGrid';
import { getCategoriesWithCounts } from '@/lib/queries';

// Líneas de producto que anuncia la tienda (contenido del cliente).
const LINEAS = ['👟 Sneakers', '👕 Streetwear', '👜 Bolsos', '⌚ Relojes', '💎 Accesorios'];

export default async function Home() {
  // Nunca enlazamos a una categoría vacía.
  const categories = (await getCategoriesWithCounts()).filter((c) => c.product_count > 0);

  return (
    <>
      {/* Cartel de tienda */}
      <section className="kz-rise relative isolate overflow-hidden rounded-card bg-ink">
        <div aria-hidden className="kz-grid absolute inset-0 opacity-70" />
        <div aria-hidden className="kz-aurora absolute inset-0" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/10" />

        <div className="relative flex flex-col items-center gap-6 px-6 py-9 text-center sm:flex-row sm:items-center sm:gap-8 sm:px-10 sm:py-11 sm:text-left">
          <Image
            src="/logo.png"
            alt=""
            width={112}
            height={112}
            priority
            className="h-24 w-24 shrink-0 rounded-full shadow-[0_18px_44px_rgba(46,123,255,0.45)] sm:h-28 sm:w-28"
          />

          <div className="min-w-0">
            <p className="eyebrow text-white/55">🚀 KOVA.ZONE</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Tu zona. Tu estilo. <span aria-hidden>🏁</span>
            </h1>

            <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {LINEAS.map((l) => (
                <li
                  key={l}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/85 backdrop-blur"
                >
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Condiciones de envío: la información que decide la compra */}
        <div className="relative border-t border-white/10 bg-white/5 px-6 py-3.5 sm:px-10">
          <div className="flex flex-col items-center gap-2 text-sm text-white/70 sm:flex-row sm:justify-center sm:gap-6">
            <span>🚀 Solamente envíos peninsulares</span>
            <span aria-hidden className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
            <span>📦 Envíos 8 - 12 días</span>
          </div>
        </div>
      </section>

      {/* Categorías — única navegación de la portada */}
      <section className="mt-12">
        <h2 className="mb-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">Categorías</h2>
        <CategoryGrid
          items={categories.map((c) => ({
            id: c.id,
            name: c.name,
            image: c.image_url,
            count: c.product_count,
            href: `/${c.slug}`,
          }))}
        />
      </section>
    </>
  );
}
