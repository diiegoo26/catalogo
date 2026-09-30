import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-ink text-white/70 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-full" />
          <div>
            <p className="brand-text font-display text-sm font-bold tracking-tight">KOVA ZONE</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">Tu zona. Tu estilo.</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/" className="transition hover:text-white">
            Inicio
          </Link>
          <Link href="/equipaciones" className="transition hover:text-white">
            Equipaciones
          </Link>
          <Link href="/catalogo" className="transition hover:text-white">
            Catálogo (PDF)
          </Link>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-white/35">
          KOVA ZONE · 🚀 Solamente envíos peninsulares · 📦 Envíos 10 - 15 días
        </p>
      </div>
    </footer>
  );
}
