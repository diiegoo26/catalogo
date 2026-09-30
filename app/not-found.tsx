import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-20 text-center sm:py-28">
      <Image
        src="/logo.png"
        alt="KOVA ZONE"
        width={72}
        height={72}
        className="h-18 w-18 rounded-full shadow-[0_12px_34px_rgba(46,123,255,0.4)]"
      />
      <p className="eyebrow mt-6">Error 404</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Esta página no está en el catálogo
      </h1>
      <p className="mt-3 max-w-md text-muted">
        Puede que el enlace haya cambiado o que el producto ya no esté disponible.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-brand">Volver al inicio</Link>
        <Link href="/equipaciones" className="btn btn-outline">Ver equipaciones</Link>
      </div>
    </div>
  );
}
