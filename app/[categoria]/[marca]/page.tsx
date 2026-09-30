import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import BrandHeader from '@/components/BrandHeader';
import { ProductGrid } from '@/components/ProductCard';
import { getBrandInCategory, getCategory, getProducts } from '@/lib/queries';

export async function generateMetadata({ params }: { params: Promise<{ categoria: string; marca: string }> }) {
  const { categoria, marca } = await params;
  return { title: `${marca} — ${categoria}` };
}

export default async function MarcaPage({
  params,
}: {
  params: Promise<{ categoria: string; marca: string }>;
}) {
  const { categoria, marca } = await params;
  const cat = await getCategory(categoria);
  if (!cat) notFound();

  const brand = await getBrandInCategory(marca, cat.id);
  if (!brand) notFound();

  const products = await getProducts({ categoryId: cat.id, brandId: brand.id });

  return (
    <>
      <Breadcrumbs items={[{ label: cat.name, href: `/${cat.slug}` }, { label: brand.name }]} />
      <BrandHeader brand={brand} />
      <ProductGrid products={products} />
    </>
  );
}
