import Image from 'next/image';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/Breadcrumbs';
import { ProductGrid } from '@/components/ProductCard';
import { getLeague, getProducts, getRegion, getTeam, getTeamPatches } from '@/lib/queries';
import { TEMPORADA_ACTUAL } from '@/lib/temporada';

export default async function EquipoPage({ params }: { params: Promise<{ pais: string; liga: string; equipo: string }> }) {
  const { pais, liga, equipo } = await params;
  const region = await getRegion(pais);
  if (!region) notFound();
  const league = await getLeague(region.id, liga);
  if (!league) notFound();
  const team = await getTeam(league.id, equipo);
  if (!team) notFound();

  const [products, patches] = await Promise.all([
    getProducts({ teamId: team.id, season: TEMPORADA_ACTUAL }),
    getTeamPatches(team.id),
  ]);

  return (
    <>
      <Breadcrumbs items={[
        { label: 'Equipaciones', href: '/equipaciones' },
        { label: region.name, href: `/equipaciones/${region.slug}` },
        { label: league.name, href: `/equipaciones/${region.slug}/${league.slug}` },
        { label: team.name },
      ]} />

      <div className="mb-8 flex items-center gap-4">
        {team.logo_url && (
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-line bg-white p-2.5 shadow-sm">
            <Image src={team.logo_url} alt="" width={64} height={64} className="h-full w-full object-contain" />
          </div>
        )}
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">{league.name} · {region.name}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{team.name}</h1>
          <p className="mt-1 text-sm text-muted">Equipaciones de la temporada {TEMPORADA_ACTUAL}</p>
          {patches.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap items-center gap-2">
              {patches.map((p) => (
                <li key={p.name}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink/80">
                  {p.logo_url && (
                    <Image src={p.logo_url} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
                  )}
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <p className="py-16 text-center text-muted">Próximamente tendremos sus equipaciones.</p>
      )}
    </>
  );
}
