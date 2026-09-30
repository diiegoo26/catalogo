'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Barra de filtros por URL (?gender=) — compartible, con acción de limpiar. */
export default function Filters() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const gender = sp.get('gender') ?? '';

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    const qs = next.toString();
    router.push(qs ? `${path}?${qs}` : path, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-mist p-3">
      <span className="eyebrow pl-1">Filtrar</span>
      <label className="flex items-center gap-2">
        <span className="sr-only">Género</span>
        <select className="field w-auto min-w-40" value={gender} onChange={(e) => set('gender', e.target.value)}>
          <option value="">Todos los géneros</option>
          <option value="hombre">Hombre</option>
          <option value="mujer">Mujer</option>
          <option value="unisex">Unisex</option>
        </select>
      </label>
      {gender && (
        <button
          type="button"
          onClick={() => set('gender', '')}
          className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-muted transition hover:border-ink hover:text-ink"
        >
          Quitar filtro ✕
        </button>
      )}
    </div>
  );
}
