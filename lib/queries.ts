import { supabase } from './supabase';
import { withCounts, withInnerProductTotals, type RawBrandRow } from './brand-counts';
import type { Brand, BrandWithCount, Category, CategoryWithCount, League, PatchBadge, Player, ProductCardData, ProductDetail, Region, Resena, Team } from './types';

const CARD = 'id,title,slug,images,brand:brands(name)';

export async function getCategories() {
  const { data } = await supabase.from('categories').select('*').order('sort_order');
  return (data ?? []) as Category[];
}
export async function getCategory(slug: string) {
  const { data } = await supabase.from('categories').select('*').eq('slug', slug).maybeSingle();
  return data as Category | null;
}
/** Categorías con el total de productos de cada una (para la portada). */
export async function getCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const { data } = await supabase
    .from('categories')
    .select('id,name,slug,image_url,products(count)')
    .order('sort_order');
  const rows = (data ?? []) as unknown as (Category & { products: { count: number }[] | null })[];
  return rows.map((r) => ({
    id: r.id, name: r.name, slug: r.slug, image_url: r.image_url,
    product_count: r.products?.[0]?.count ?? 0,
  }));
}

// ----- Flujo Equipaciones -----
export async function getRegions() {
  const { data } = await supabase.from('regions').select('*').order('name');
  return (data ?? []) as Region[];
}
export async function getRegion(slug: string) {
  const { data } = await supabase.from('regions').select('*').eq('slug', slug).maybeSingle();
  return data as Region | null;
}
export async function getLeagues(regionId: string) {
  const { data } = await supabase.from('leagues').select('*').eq('region_id', regionId).order('name');
  return (data ?? []) as League[];
}
export async function getLeague(regionId: string, slug: string) {
  const { data } = await supabase.from('leagues').select('*')
    .eq('region_id', regionId).eq('slug', slug).maybeSingle();
  return data as League | null;
}
export async function getTeams(leagueId: string) {
  const { data } = await supabase.from('teams').select('*').eq('league_id', leagueId).order('name');
  return (data ?? []) as Team[];
}
export async function getTeam(leagueId: string, slug: string) {
  const { data } = await supabase.from('teams').select('*')
    .eq('league_id', leagueId).eq('slug', slug).maybeSingle();
  return data as Team | null;
}

// ----- Marcas -----
export async function getBrand(slug: string) {
  const { data } = await supabase.from('brands').select('*').eq('slug', slug).maybeSingle();
  return data as Brand | null;
}
/** Marcas con al menos un producto en la categoria, con su total. */
export async function getBrandsByCategory(categoryId: string): Promise<BrandWithCount[]> {
  const { data } = await supabase
    .from('brands')
    .select('id,name,slug,logo_url,inner_products:products!inner(category_id)')
    .eq('inner_products.category_id', categoryId)
    .order('name');
  const rows = (data ?? []) as unknown as RawBrandRow[];
  return withCounts(withInnerProductTotals(rows));
}

/** La marca solo resuelve si tiene productos en esa categoria; si no, notFound(). */
export async function getBrandInCategory(brandSlug: string, categoryId: string): Promise<BrandWithCount | null> {
  const all = await getBrandsByCategory(categoryId);
  return all.find((b) => b.slug === brandSlug) ?? null;
}

// ----- Productos -----
export type ProductFilters = {
  categoryId?: string; brandId?: string; teamId?: string;
  gender?: string; season?: string;
};
export async function getProducts(f: ProductFilters = {}) {
  let q = supabase.from('products').select(CARD).order('created_at', { ascending: false });
  if (f.categoryId) q = q.eq('category_id', f.categoryId);
  if (f.brandId)    q = q.eq('brand_id', f.brandId);
  if (f.teamId)     q = q.eq('team_id', f.teamId);
  if (f.season)   q = q.eq('season', f.season);
  if (f.gender)     q = q.eq('gender', f.gender);
  const { data } = await q;
  return (data ?? []) as unknown as ProductCardData[];
}

export type CatalogProduct = ProductCardData & {
  category: { name: string; slug: string; sort_order: number };
};

/** Todos los productos con su categoría, para el catálogo imprimible / PDF. */
export async function getCatalogProducts() {
  const { data } = await supabase
    .from('products')
    .select('id,title,slug,images,brand:brands(name),category:categories(name,slug,sort_order)')
    .order('title');
  return (data ?? []) as unknown as CatalogProduct[];
}

export async function getProductBySlug(slug: string) {
  const { data } = await supabase
    .from('products')
    .select(`*, category:categories(name,slug), brand:brands(name,slug),
             team:teams(id,name,slug, league:leagues(name,slug, region:regions(name,slug))),
             variants:product_variants(*)`)
    .eq('slug', slug).maybeSingle();
  return data as unknown as ProductDetail | null;
}

export async function searchProducts(text: string, limit = 8) {
  const clean = text.replace(/[%_,]/g, ' ').trim();
  if (clean.length < 2) return [];
  const { data } = await supabase.from('products').select('title,slug,images')
    .ilike('title', `%${clean}%`).limit(limit);
  return data ?? [];
}

// ----- Equipaciones 2026-27 -----
export async function getPlayers(teamId: string) {
  const { data } = await supabase.from('players').select('*')
    .eq('team_id', teamId).order('number', { ascending: true });
  return (data ?? []) as Player[];
}

/** League badge first, then cups/continental badges. Cup entries without a logo are kept (text-only chip). */
export async function getTeamPatches(teamId: string): Promise<PatchBadge[]> {
  const [teamRes, compRes] = await Promise.all([
    supabase.from('teams').select('league:leagues(name,logo_url)').eq('id', teamId).maybeSingle(),
    supabase.from('team_competitions')
      .select('competition:competitions(name,logo_url)').eq('team_id', teamId),
  ]);
  const league = (teamRes.data as { league: { name: string; logo_url: string | null } | null } | null)?.league;
  const out: PatchBadge[] = [];
  if (league?.logo_url) out.push({ name: league.name, logo_url: league.logo_url });
  for (const row of compRes.data ?? []) {
    const c = (row as unknown as { competition: { name: string; logo_url: string | null } | null }).competition;
    if (c) out.push({ name: c.name, logo_url: c.logo_url });
  }
  return out;
}

// ----- Reseñas -----
const RESENA = 'id,product_id,author,rating,body,created_at';

export async function getResenasProducto(productId: string, limit = 50): Promise<Resena[]> {
  const { data } = await supabase
    .from('reviews').select(RESENA)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as Resena[];
}

export async function getResenasTienda(limit = 9): Promise<Resena[]> {
  const { data } = await supabase
    .from('reviews').select(RESENA)
    .is('product_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as Resena[];
}

/** Nota media exacta de un producto, contando TODAS sus reseñas (no solo las mostradas). */
export async function getNotaProducto(productId: string): Promise<{ media: number; total: number }> {
  const { data } = await supabase.from('reviews').select('rating').eq('product_id', productId);
  const notas = (data ?? []) as { rating: number }[];
  if (!notas.length) return { media: 0, total: 0 };
  const suma = notas.reduce((acc, r) => acc + r.rating, 0);
  return { media: Math.round((suma / notas.length) * 10) / 10, total: notas.length };
}

/** Nota media de las reseñas DE TIENDA (solo las que no apuntan a un producto). */
export async function getNotaTienda(): Promise<{ media: number; total: number }> {
  const { data } = await supabase.from('reviews').select('rating').is('product_id', null);
  const notas = (data ?? []) as { rating: number }[];
  if (!notas.length) return { media: 0, total: 0 };
  const suma = notas.reduce((acc, r) => acc + r.rating, 0);
  return { media: Math.round((suma / notas.length) * 10) / 10, total: notas.length };
}
