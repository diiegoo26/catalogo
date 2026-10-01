import type { ComponentType, ReactNode } from 'react';
import type { IconoPrenda } from '@/lib/guia-tallas';

type IconoProps = { className?: string };

/** Bloque con icono, título y contenido. El icono es SVG del mismo lenguaje que
 *  el resto del proyecto, no emoji. */
export function Seccion({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-3 font-display text-lg font-bold tracking-tight">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          {icono}
        </span>
        {titulo}
        <span className="h-px flex-1 bg-line" />
      </h2>
      <div className="rounded-card border border-line bg-surface p-5 text-sm leading-relaxed text-ink/85 sm:p-6">
        {children}
      </div>
    </section>
  );
}

export function IconoCamion({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M2 7h11v9H2zM13 10h4l4 3v3h-8z" />
      <circle cx="6.5" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

export function IconoCamiseta({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M9 3 4 5.5 5.5 9 8 8v13h8V8l2.5 1L20 5.5 15 3a3 3 0 0 1-6 0Z" />
    </svg>
  );
}

export function IconoCruz({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  );
}

export function IconoInfo({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function IconoRegla({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="2" y="9" width="20" height="6" rx="1" />
      <path d="M6 9v3M10 9v3M14 9v3M18 9v3" />
    </svg>
  );
}

export function IconoOjo({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconoTabla({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10M15 10v10" />
    </svg>
  );
}

export function IconoLista({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function IconoBombilla({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.6.5-.9 1.2-.9 1.9V17H9.4v-1.2c0-.7-.3-1.4-.9-1.9A6 6 0 0 1 12 3Z" />
    </svg>
  );
}

export function IconoZapatilla({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M3 17h18v-2l-5-2-3-4H7a3 3 0 0 0-3 3z" />
      <path d="M3 17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2" />
    </svg>
  );
}

export function IconoPantalon({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M7 3h10l1 18h-3l-1-11-1 11h-3L6 21z" />
      <path d="M7 3v4h10V3" />
    </svg>
  );
}

export function IconoBanador({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M4 7h16v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" />
      <path d="M4 7V5h16v2M12 7v10" />
    </svg>
  );
}

export function IconoSudadera({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M9 3 4 6l2 4 2-1v12h8V9l2 1 2-4-5-3a3 3 0 0 1-6 0Z" />
      <path d="M10 12h4v6h-4z" />
    </svg>
  );
}

export function IconoAbrigo({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M8 3 3 7l2 5 2-1v10h10V11l2 1 2-5-5-4-2 2h-2z" />
      <path d="M12 5v16" />
    </svg>
  );
}

/** Iconos de las prendas, resueltos por la clave que usa lib/guia-tallas.ts. */
export const ICONOS_PRENDA: Record<IconoPrenda, ComponentType<IconoProps>> = {
  zapatilla: IconoZapatilla,
  camiseta: IconoCamiseta,
  pantalon: IconoPantalon,
  banador: IconoBanador,
  sudadera: IconoSudadera,
  abrigo: IconoAbrigo,
};
