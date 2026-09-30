// Groups a product's FootyLogos photo URLs by kit variant so the catalog can offer a
// Local / Visitante / Tercera selector.
//
// Two URL shapes exist in `products.images`:
//   assets host: .../<folder>/<cover|NN>-<club>-<season>-<kind>-kit-footylogos.<ext>
//   www host:    .../kits/<club-slug>-<season>/<kind>-<cover|NN>.<ext>

export type KitVariant = {
  kind: string;
  label: string;
  title: string;
  images: string[];
};

const LABELS: Record<string, string> = {
  home: 'Local',
  away: 'Visitante',
  third: 'Tercera',
  fourth: 'Cuarta',
  anniversary: 'Aniversario',
  goalkeeper: 'Portero',
};

const TITLES: Record<string, string> = {
  home: 'Equipación de local',
  away: 'Equipación de visitante',
  third: 'Equipación de tercera',
  fourth: 'Equipación de cuarta',
  anniversary: 'Equipación de aniversario',
  goalkeeper: 'Equipación de portero',
};

export function kitTitleFor(kind: string): string {
  return TITLES[kind] ?? `Equipación de ${kind}`;
}

const ORDER = ['home', 'away', 'third', 'fourth', 'anniversary', 'goalkeeper'];

function kindOf(url: string): string | null {
  const asset = /^(?:cover|\d{1,3})-.*?-\d{4}(?:-\d{2})?-([a-z]+)-kit-footylogos\./.exec(url.split('/').pop() ?? '');
  if (asset) return asset[1];
  const web = /\/([a-z]+)-(?:cover|\d{1,3})\.(?:webp|png|jpe?g)$/.exec(url);
  if (web) return web[1];
  return null;
}

export function groupKitsByVariant(images: string[] | null | undefined): KitVariant[] {
  const groups = new Map<string, string[]>();
  for (const url of images ?? []) {
    const kind = kindOf(url);
    if (!kind) continue;
    const list = groups.get(kind);
    if (list) list.push(url);
    else groups.set(kind, [url]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ia = ORDER.indexOf(a);
      const ib = ORDER.indexOf(b);
      return (ia === -1 ? ORDER.length : ia) - (ib === -1 ? ORDER.length : ib);
    })
    .map(([kind, group]) => ({
      kind,
      label: LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1),
      title: kitTitleFor(kind),
      images: group,
    }));
}
