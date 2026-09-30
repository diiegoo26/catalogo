import Breadcrumbs from '@/components/Breadcrumbs';
import CardGrid from '@/components/CardGrid';
import PageHeading from '@/components/PageHeading';
import { ProductGrid } from '@/components/ProductCard';
import { getCategory, getProducts, getRegions } from '@/lib/queries';

export default async function Equipaciones() {
  const regions = await getRegions();
  const category = await getCategory('equipaciones');
  const products = category ? await getProducts({ categoryId: category.id }) : [];
  return (
    <>
      <Breadcrumbs items={[{ label: 'Equipaciones' }]} />
      <PageHeading
        eyebrow="Temporada 2026/27"
        title="Elige un país"
        description={`${regions.length} ${regions.length === 1 ? 'país' : 'países'} con equipaciones disponibles`}
      />
      <CardGrid items={regions.map((r) => ({ id: r.id, name: r.name, image: r.flag_url, href: `/equipaciones/${r.slug}` }))} />
      {category && (
        <section id="productos" className="mt-12">
          <h2 className="mb-6 font-display text-2xl font-bold tracking-tight">Todos los productos</h2>
          <ProductGrid products={products} />
        </section>
      )}
    </>
  );
}
