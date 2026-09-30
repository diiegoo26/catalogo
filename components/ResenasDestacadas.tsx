import Estrellas from './Estrellas';
import type { Resena } from '@/lib/types';

/** Reseñas de tienda para destacar (portada). No pinta nada si no hay ninguna. */
export default function ResenasDestacadas({ resenas }: { resenas: Resena[] }) {
  if (!resenas.length) return null;

  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {resenas.slice(0, 3).map((r) => (
        <li key={r.id} className="flex flex-col rounded-card border border-line bg-surface p-4">
          <Estrellas valor={r.rating} />
          <p className="mt-2.5 line-clamp-4 flex-1 text-sm leading-relaxed text-ink/80">{r.body}</p>
          <p className="mt-3 text-xs font-medium text-muted">{r.author}</p>
        </li>
      ))}
    </ul>
  );
}
