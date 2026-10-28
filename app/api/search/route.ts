import { NextResponse } from 'next/server';
import { localizarImagen } from '@/lib/externos';
import { searchProducts } from '@/lib/queries';

type ResultadoBusqueda = { title: string; slug: string; images: string[] | null };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const resultados = (await searchProducts(q)) as ResultadoBusqueda[];
  // Las rutas se resuelven acá, en el servidor: SearchBar es 'use client' y no
  // necesita arrastrar el helper al bundle solo para pintar una miniatura.
  return NextResponse.json(
    resultados.map((r) => ({
      ...r,
      images: (r.images ?? []).map((src) => localizarImagen(src) ?? src),
    })),
  );
}
