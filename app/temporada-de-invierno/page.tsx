import Breadcrumbs from '@/components/Breadcrumbs';
import PageHeading from '@/components/PageHeading';
import { ProductGrid } from '@/components/ProductCard';
import { getProducts } from '@/lib/queries';

/**
 * Vidriera de temporada.
 *
 * No es una categoría: la membresía la decide la columna `products.is_temporada_invierno`
 * (ver supabase/2026-10-14-temporada-invierno.sql), porque invierno corta de costado a
 * todas las categorías y `category_id` ya está gastado en el eje "tipo de prenda".
 * Mismo molde que `app/equipaciones/retro/page.tsx`, que resolvió lo mismo para lo retro.
 */
export default async function TemporadaDeInvierno() {
  const prendas = await getProducts({ isTemporadaInvierno: true });
  const cuantas = `${prendas.length} ${prendas.length === 1 ? 'prenda de abrigo' : 'prendas de abrigo'}`;

  return (
    <>
      <Breadcrumbs items={[{ label: 'Temporada de Invierno' }]} />
      <PageHeading
        eyebrow="Temporada"
        title="Temporada de Invierno"
        description={`${cuantas} disponibles`}
      />
      <ProductGrid products={prendas} />
    </>
  );
}
