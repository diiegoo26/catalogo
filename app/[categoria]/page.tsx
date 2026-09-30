import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import BrandHeader from '@/components/BrandHeader';
import CardGrid from '@/components/CardGrid';
import Filters from '@/components/Filters';
import PageHeading from '@/components/PageHeading';
import { ProductGrid } from '@/components/ProductCard';
import { brandViewMode } from '@/lib/brand-view';
import { categoryHasGenders, getBrandsByCategory, getCategory, getProducts } from '@/lib/queries';

type SP = { gender?: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function CategoriaPage({
  params, searchParams,
}: { params: Promise<{ categoria: string }>; searchParams: Promise<SP> }) {
  const { categoria } = await params;
  const sp = await searchParams;

  const cat = await getCategory(categoria);
  if (!cat) notFound();

  const brands = await getBrandsByCategory(cat.id);
  const mode = brandViewMode(brands.length);

  const products =
    mode === 'grid'
      ? []
      : await getProducts({
          categoryId: cat.id,
          brandId: mode === 'single' ? brands[0].id : undefined,
          gender: sp.gender || undefined,
        });

  // El filtro por género solo aporta cuando hay productos con género asignado.
  const showFilters = mode === 'none' && (await categoryHasGenders(cat.id));

  return (
    <>
      <Breadcrumbs items={[{ label: cat.name }]} />

      {mode === 'grid' && (
        <>
          <PageHeading
            eyebrow="Categoría"
            title={cat.name}
            description={`${plural(brands.length, 'marca', 'marcas')} disponibles`}
          />
          <CardGrid
            items={brands.map((b) => ({
              id: b.id,
              name: b.name,
              image: b.logo_url,
              href: `/${cat.slug}/${b.slug}`,
              meta: plural(b.product_count, 'producto', 'productos'),
            }))}
          />
        </>
      )}

      {mode === 'single' && (
        <>
          <BrandHeader brand={brands[0]} />
          <ProductGrid products={products} />
        </>
      )}

      {mode === 'none' && (
        <>
          <PageHeading
            eyebrow="Categoría"
            title={cat.name}
            description={plural(products.length, 'producto', 'productos')}
          />
          {showFilters && (
            <div className="mb-6">
              <Filters />
            </div>
          )}
          <ProductGrid products={products} />
        </>
      )}
    </>
  );
}
