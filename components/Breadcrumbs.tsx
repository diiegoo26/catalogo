import Link from 'next/link';

export type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: 'Inicio', href: '/' }, ...items];
  return (
    <nav aria-label="Migas de pan" className="mb-5 -mx-4 overflow-x-auto px-4 print:hidden">
      <ol className="flex w-max items-center gap-2 font-mono text-[11px] tracking-wide text-muted">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={i} className="flex items-center gap-2 whitespace-nowrap">
              {c.href && !last ? (
                <Link href={c.href} className="transition hover:text-brand">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={last ? 'font-bold text-ink' : ''}>
                  {c.label}
                </span>
              )}
              {!last && (
                <span aria-hidden className="text-line">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
