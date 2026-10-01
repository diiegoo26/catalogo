import Breadcrumbs from '@/components/Breadcrumbs';
import PageHeading from '@/components/PageHeading';
import { ProductGrid } from '@/components/ProductCard';
import { getCategory, getProducts } from '@/lib/queries';

export default async function Retro() {
  const category = await getCategory('equipaciones');
  const products = category ? await getProducts({ categoryId: category.id, isRetro: true }) : [];

  return (
    <>
      <Breadcrumbs items={[{ label: 'Equipaciones', href: '/equipaciones' }, { label: 'Retro' }]} />
      <PageHeading
        eyebrow="Clásicos"
        title="Equipaciones retro"
        description={`${products.length} equipaciones retro disponibles`}
      />
      <ProductGrid products={products} />
    </>
  );
}
