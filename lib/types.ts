export type Category = { id: string; name: string; slug: string; image_url: string | null };
export type CategoryWithCount = Category & { product_count: number };
export type Brand    = { id: string; name: string; slug: string; logo_url: string | null };
export type BrandWithCount = Brand & { product_count: number };
export type Region   = { id: string; name: string; slug: string; flag_url: string | null };
export type League   = { id: string; name: string; slug: string; region_id: string; logo_url: string | null };
export type Team     = { id: string; name: string; slug: string; league_id: string; logo_url: string | null };
export type Variant  = { id: string; product_id: string; size: string | null; color: string | null; stock: number };
export type Player    = { id: string; team_id: string; name: string; number: number };
export type PatchBadge = { name: string; logo_url: string | null };

/** Reseña de cliente. `product_id` null = reseña general de la tienda. */
export type Resena = {
  id: string;
  product_id: string | null;
  author: string;
  rating: number;
  body: string;
  created_at: string;
};

export type ProductCardData = {
  id: string; title: string; slug: string;
  images: string[]; brand: { name: string } | null;
};

export type ProductDetail = ProductCardData & {
  description: string | null;
  season: string | null;
  category: { name: string; slug: string };
  brand: { name: string; slug: string } | null;
  team: { id: string; name: string; slug: string;
          league: { name: string; slug: string; region: { name: string; slug: string } } } | null;
  variants: Variant[];
};
