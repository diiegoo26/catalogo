import type { Metadata } from 'next';
import { Manrope, Space_Grotesk, Space_Mono } from 'next/font/google';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { CestaProvider } from '@/components/CestaProvider';
import './globals.css';

const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-space-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'KOVA ZONE — TU ESTILO, TU ZONA', template: '%s · KOVA ZONE' },
  description: 'Catálogo de equipaciones de fútbol de la temporada 2026/27, organizado por país, liga, equipo y marca.',
};

// Todo el catálogo depende de datos en vivo (Supabase): sin pre-renderizado
// estático para que las categorías y productos siempre estén al día.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${grotesk.variable} ${manrope.variable} ${spaceMono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Saltar al contenido
        </a>
        <CestaProvider>
          <Header />
          <main id="contenido" className="mx-auto max-w-6xl px-4 py-8">
            {children}
          </main>
          <Footer />
        </CestaProvider>
      </body>
    </html>
  );
}
