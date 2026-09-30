import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Breadcrumbs, { Crumb } from '@/components/Breadcrumbs';
import KitCustomizer from '@/components/KitCustomizer';
import ProductGallery from '@/components/ProductGallery';
import ProductPurchase from '@/components/ProductPurchase';
import { descripcionVisible } from '@/lib/descripcion';
import { groupKitsByVariant } from '@/lib/kits';
import { getProductBySlug, getPlayers, getTeamPatches } from '@/lib/queries';
import { TEMPORADA_ACTUAL } from '@/lib/temporada';
import type { PatchBadge, Player } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  return { title: p?.title ?? 'Producto', description: descripcionVisible(p?.description)?.slice(0, 150) };
}

export default async function ProductoPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ kit?: string }> }) {
  const { slug } = await params;
  const { kit: kitParam } = await searchParams;
  const p = await getProductBySlug(slug);
  if (!p) notFound();

  const variants = groupKitsByVariant(p.images);
  const selected = variants.find((v) => v.kind === kitParam) ?? variants[0] ?? null;
  const titulo = selected ? selected.title : p.title;
  const initialIndex = selected ? Math.max(0, p.images.indexOf(selected.images[0])) : 0;
  const desc = descripcionVisible(p.description);

  const esKitTemporada = Boolean(p.team && p.season === TEMPORADA_ACTUAL);
  const [players, patches]: [Player[], PatchBadge[]] = esKitTemporada
    ? await Promise.all([getPlayers(p.team!.id), getTeamPatches(p.team!.id)])
    : [[], []];

  // Breadcrumb adaptativo según el flujo al que pertenezca el producto
  let crumbs: Crumb[];
  if (p.team) {
    const { team } = p; const { league } = team; const { region } = league;
    crumbs = [
      { label: p.category.name, href: `/${p.category.slug}` },
      { label: region.name, href: `/equipaciones/${region.slug}` },
      { label: league.name, href: `/equipaciones/${region.slug}/${league.slug}` },
      { label: team.name, href: `/equipaciones/${region.slug}/${league.slug}/${team.slug}` },
    ];
  } else if (p.brand) {
    crumbs = [
      { label: p.category.name, href: `/${p.category.slug}` },
      { label: p.brand.name, href: `/${p.category.slug}/${p.brand.slug}` },
    ];
  } else {
    crumbs = [{ label: p.category.name, href: `/${p.category.slug}` }];
  }
  crumbs.push({ label: p.title });

  return (
    <>
      <Breadcrumbs items={crumbs} />
      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <ProductGallery key={selected?.kind ?? 'default'} images={p.images} title={p.title} initialIndex={initialIndex} />
        <div>
          {p.brand && <p className="eyebrow mb-2">{p.brand.name}</p>}
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
          {selected && <p className="mt-1.5 text-sm text-muted">{p.title}</p>}
          {desc && <p className="mt-4 whitespace-pre-line leading-relaxed text-ink/75">{desc}</p>}
          <div className="mt-6">
            {esKitTemporada ? (
              <KitCustomizer key={selected?.kind ?? 'default'} title={selected ? `${p.title} — ${selected.title}` : p.title} variants={p.variants}
                players={players} patches={patches} imageUrl={p.images[0]} categoria={p.category.slug} />
            ) : (
              <ProductPurchase title={p.title} variants={p.variants} imageUrl={p.images[0]} categoria={p.category.slug} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
