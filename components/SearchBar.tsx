'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Result = { title: string; slug: string; images: string[] };

export default function SearchBar() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Búsqueda con debounce
  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setResults(await res.json());
        setOpen(true);
      } catch {} finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={box} className="relative flex-1">
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={q}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          if (v.trim().length < 2) { setResults([]); setLoading(false); }
          else setLoading(true);
        }}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Buscar equipaciones, equipos, marcas…"
        aria-label="Buscar productos"
        className="field border-white/15 bg-white/10 py-2 pl-10 text-white placeholder:text-white/45"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 max-h-96 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-xl shadow-ink/20">
          {loading && <p className="p-3 text-sm text-muted">Buscando…</p>}
          {!loading && results.length === 0 && <p className="p-3 text-sm text-muted">Sin resultados</p>}
          {results.map((r) => (
            <Link
              key={r.slug}
              href={`/producto/${r.slug}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-mist"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-mist">
                {r.images?.[0] && <Image src={r.images[0]} alt="" fill sizes="48px" className="object-cover" />}
              </div>
              <p className="min-w-0 truncate text-sm font-medium">{r.title}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
