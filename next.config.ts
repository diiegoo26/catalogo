import type { NextConfig } from 'next';

// Reclasificación de categorías (2026-09): las categorías antiguas se
// reagruparon en las líneas nuevas. Mantenemos vivas las URLs antiguas con
// redirecciones permanentes (tanto la categoría como sus subpáginas de marca).
const REDIRECCIONES_CATEGORIA: [string, string][] = [
  ['calzado', 'sneakers'],
  ['camisetas', 'streetwear'],
  ['chandal', 'streetwear'],
  ['conjuntos', 'streetwear'],
  ['chaquetas', 'streetwear'],
  ['pantalones', 'streetwear'],
  ['gorras', 'streetwear'],
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.footylogos.com' },
      // Fotos reales de las equipaciones 2026-27 (galerias de FootyLogos)
      { protocol: 'https', hostname: 'assets.footylogos.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
      // Fotos de productos (286) alojadas en el CDN de Wix
      { protocol: 'https', hostname: 'static.wixstatic.com' },
      // Fotos de la tienda Tu_tienda99 (Google Drive), 489 productos
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Iconos de banderas/escudos (Icons8)
      { protocol: 'https', hostname: 'img.icons8.com' },
      // Imagenes de Pinterest
      { protocol: 'https', hostname: 'i.pinimg.com' },
      // Logos/escudos de otras fuentes (detectadas en la base de datos)
      { protocol: 'https', hostname: 'images.seeklogo.com' },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
      { protocol: 'https', hostname: 'cdn.worldvectorlogo.com' },
      { protocol: 'https', hostname: 'thumb.wikimedia.org' },
      { protocol: 'https', hostname: 'fbi.cults3d.com' },
      { protocol: 'https', hostname: 'static.vecteezy.com' },
      { protocol: 'https', hostname: 'dynl.mktgcdn.com' },
      { protocol: 'https', hostname: 'cdn.create.vista.com' },
      { protocol: 'https', hostname: 'icon2.cleanpng.com' },
      { protocol: 'https', hostname: 'banner2.cleanpng.com' },
      { protocol: 'https', hostname: 'i.etsystatic.com' },
      { protocol: 'https', hostname: 'c.perfumesclub.com' },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
    ],
  },
  async redirects() {
    return REDIRECCIONES_CATEGORIA.flatMap(([desde, hacia]) => [
      { source: `/${desde}`, destination: `/${hacia}`, permanent: true },
      { source: `/${desde}/:path*`, destination: `/${hacia}/:path*`, permanent: true },
    ]);
  },
};

export default nextConfig;
