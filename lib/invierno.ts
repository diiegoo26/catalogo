/**
 * Qué cuenta como ropa de invierno.
 *
 * La membresía en vivo la decide `products.is_temporada_invierno`, un booleano (ver
 * `supabase/2026-10-14-temporada-invierno.sql`): la regla marcó de una vez los 89
 * abrigos de Streetwear y desde ahí se cura a mano. Esta lista es la especificación
 * que ese SQL replica —verificada palabra por palabra— y la herramienta para volver a
 * marcar después de una importación.
 *
 * No hay categoría de temporada, y no por descuido: invierno corta de costado a todas
 * las categorías, mientras `category_id` ya está gastado en el eje "tipo de prenda"
 * (la reclasificación de 2026-09 mandó /chaquetas y /pantalones a /streetwear). El
 * campo `season` es de equipaciones de fútbol ("2026-27", "1994"...), no sirve. Lo
 * único que queda es el título: la lista de abajo se midió contra los 324 títulos
 * reales de Streetwear, no se inventó — sin `hooded`, `sweatshirt` y `windbreaker` la
 * regla perdía abrigos de verdad ("Supreme hooded sweatshirt", "Carhartt J97 autumn
 * and winter windbreaker collection").
 *
 * Dos palabras quedan afuera a propósito:
 * - `jersey`: en inglés futbolero significa camiseta, no tejido de abrigo. Metía
 *   "Stussy cotton baseball jersey" en una vitrina de invierno.
 * - `vest`: como subcadena matchea "vestido". Se pierde "The North Face vest"
 *   (que sí es un chaleco), y se prefiere eso a mostrar un vestido de verano.
 */
export const PALABRAS_DE_ABRIGO = [
  // Castellano
  'chaqueta', 'campera', 'abrigo', 'parka', 'pluma', 'sudadera', 'invierno',
  // Inglés
  'hoodie', 'hooded', 'sweatshirt', 'sweater', 'cardigan', 'fleece',
  'jacket', 'coat', 'puffer', 'windbreaker', 'winter',
] as const;

/**
 * Señales que descartan un título aunque nombre una prenda de abrigo.
 *
 * Un hoodie de manga corta no abriga. Y no es un caso de laboratorio: dos de los
 * ocho productos más nuevos de la categoría son "Stone Island Solid Color Hoodie
 * Short Sleeve Collection" y "AMIRI hooded sweatshirt short sleeved collection",
 * así que sin este descarte la portada mostraba manga corta en la vitrina de
 * invierno. `short sleeve` ya cubre "short sleeved" y "short sleeves".
 */
export const SENALES_DE_MANGA_CORTA = ['short sleeve', 'half sleeve'] as const;

/** ¿El título describe una prenda de abrigo? Compara en minúsculas. */
export function esRopaDeInvierno(titulo: string): boolean {
  const t = titulo.toLowerCase();
  if (SENALES_DE_MANGA_CORTA.some((senal) => t.includes(senal))) return false;
  return PALABRAS_DE_ABRIGO.some((palabra) => t.includes(palabra));
}

/**
 * Foto del tile: una prenda real de la propia vitrina (`Chaqueta 01`, 1200x1600),
 * servida desde Google Drive igual que las otras 13 categorías — no un archivo local.
 * Es una constante a propósito: cambiar la prenda de portada es editar una sola línea.
 *
 * El host ya está permitido en `next.config.ts` (`lh3.googleusercontent.com`). Si no lo
 * estuviera, `next/image` fallaría, `CategoryGrid` caería a la inicial y el tile se
 * leería "TTemporada de Invierno" sin que nada más se rompa.
 */
export const FOTO_DE_INVIERNO =
  'https://lh3.googleusercontent.com/d/1es9mp1eyTN3ffHodad_2dSD77VgD69Kt';

/**
 * Ficha de la vidriera "Temporada de Invierno" para la grilla de categorías.
 *
 * No sale de `categories`, justamente porque invierno no es una categoría: la
 * membresía la decide `products.is_temporada_invierno` y la ficha se arma a mano. Va
 * primera en la grilla —es la vidriera de la estación— y por eso el `href` apunta a
 * una ruta propia y no a un slug de categoría.
 */
export function tileDeInvierno(total: number) {
  return {
    id: 'temporada-de-invierno',
    name: 'Temporada de Invierno',
    href: '/temporada-de-invierno',
    image: FOTO_DE_INVIERNO,
    count: total,
  };
}
