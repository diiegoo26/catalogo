import Image from 'next/image';
import Link from 'next/link';
import BotonCesta from './BotonCesta';
import SearchBar from './SearchBar';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 print:hidden">
      <div className="brand-gradient h-0.5 w-full" />
      <div className="border-b border-white/10 bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/85">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link href="/" aria-label="KOVA ZONE — inicio" className="group flex shrink-0 items-center gap-2.5">
            <Image
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              priority
              className="h-10 w-10 rounded-full shadow-[0_6px_18px_rgba(46,123,255,0.4)] transition-transform duration-300 group-hover:scale-105"
            />
            <span className="hidden flex-col leading-none sm:flex">
              <span className="brand-text font-display text-[1.05rem] font-bold tracking-tight">KOVA ZONE</span>
              <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.24em] text-white/55">Tu zona. Tu estilo.</span>
            </span>
          </Link>

          <SearchBar />

          <Link href="/catalogo" className="btn btn-light hidden shrink-0 md:inline-flex">
            Catálogo (PDF)
          </Link>
          <BotonCesta />
        </div>
      </div>
    </header>
  );
}
