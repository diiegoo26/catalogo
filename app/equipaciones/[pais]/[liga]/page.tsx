import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import CardGrid from '@/components/CardGrid';
import PageHeading from '@/components/PageHeading';
import { getLeague, getRegion, getTeams } from '@/lib/queries';

export default async function LigaPage({ params }: { params: Promise<{ pais: string; liga: string }> }) {
  const { pais, liga } = await params;
  const region = await getRegion(pais);
  if (!region) notFound();
  const league = await getLeague(region.id, liga);
  if (!league) notFound();
  const teams = await getTeams(league.id);

  return (
    <>
      <Breadcrumbs items={[
        { label: 'Equipaciones', href: '/equipaciones' },
        { label: region.name, href: `/equipaciones/${region.slug}` },
        { label: league.name },
      ]} />
      <PageHeading
        eyebrow={region.name}
        title={league.name}
        description={`${teams.length} ${teams.length === 1 ? 'equipo' : 'equipos'} · elige el tuyo`}
      />
      <CardGrid items={teams.map((t) => ({
        id: t.id, name: t.name, image: t.logo_url,
        href: `/equipaciones/${region.slug}/${league.slug}/${t.slug}`,
      }))} />
    </>
  );
}
