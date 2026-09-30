import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import PageHeading from '@/components/PageHeading';
import Resenas from '@/components/Resenas';
import { getNotaTienda, getResenasTienda } from '@/lib/queries';

export const metadata: Metadata = { title: 'Reseñas' };

export default async function ResenasPage() {
  const [resenas, nota] = await Promise.all([getResenasTienda(30), getNotaTienda()]);

  return (
    <>
      <Breadcrumbs items={[{ label: 'Reseñas' }]} />
      <PageHeading
        title="Reseñas de la tienda"
        description="Lo que cuentan quienes ya han comprado en KOVA ZONE"
      />
      <Resenas iniciales={resenas} media={nota.media} total={nota.total} conTitulo={false} />
    </>
  );
}
