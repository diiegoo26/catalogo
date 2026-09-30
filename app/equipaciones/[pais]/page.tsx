import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import CardGrid from '@/components/CardGrid';
import PageHeading from '@/components/PageHeading';
import { getLeagues, getRegion } from '@/lib/queries';

export default async function PaisPage({ params }: { params: Promise<{ pais: string }> }) {
  const { pais } = await params;
  const region = await getRegion(pais);
  if (!region) notFound();
  const leagues = await getLeagues(region.id);

  return (
    <>
      <Breadcrumbs items={[{ label: 'Equipaciones', href: '/equipaciones' }, { label: region.name }]} />
      <PageHeading
        eyebrow={region.name}
        title="Ligas"
        description={`${leagues.length} ${leagues.length === 1 ? 'liga' : 'ligas'} disponibles`}
      />
      <CardGrid items={leagues.map((l) => ({ id: l.id, name: l.name, image: l.logo_url, href: `/equipaciones/${region.slug}/${l.slug}` }))} />
    </>
  );
}
