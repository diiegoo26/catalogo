'use client';
import { useCesta } from './CestaProvider';

export default function BotonCesta() {
  const { total, abrir } = useCesta();
  return (
    <button
      type="button" onClick={abrir} aria-label="Abrir cesta"
      className="relative inline-flex h-10 shrink-0 items-center rounded-full border border-white/15 px-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
    >
      Cesta
      {total > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2E7BFF] px-1 font-mono text-[10px] font-bold text-white">
          {total}
        </span>
      )}
    </button>
  );
}
