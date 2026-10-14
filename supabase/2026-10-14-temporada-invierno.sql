-- Temporada de Invierno: marca la ropa de abrigo dentro de Streetwear.
--
-- Los productos conservan `category_id` = Streetwear a propósito. Invierno es una
-- temporada, no un tipo de prenda: corta de costado a todas las categorías. La
-- reclasificación de 2026-09 ya gastó el eje de `category_id` en "tipo de prenda"
-- (next.config.ts redirige /chaquetas, /pantalones, /camisetas y /gorras a
-- /streetwear), y con una sola FK no entran los dos ejes: una categoría nueva se
-- llevaría 89 de las 324 filas de Streetwear y las sacaría de /streetwear y de
-- /streetwear/<marca>.
--
-- Es el mismo patrón de `is_retro` (supabase/2026-10-01-retro-is-retro.sql), que
-- resolvió el mismo problema para las equipaciones retro.
--
-- Ojo: esta columna NO se actualiza sola al reimportar. `lib/sudu/names.ts` sigue
-- mandando `coats` y `hoodies sweater jacket` a Streetwear, así que las altas nuevas
-- entran sin marcar y se curan a mano (o se vuelve a correr el UPDATE de abajo).

alter table products add column if not exists is_temporada_invierno boolean not null default false;

-- El listado /temporada-de-invierno filtra SOLO por esta columna y ordena por
-- created_at desc (getProducts siempre agrega ese orden), así que el índice parcial
-- sirve las dos cosas. Ojo: no se copia el `(category_id)` de products_retro_idx
-- porque acá no hay filtro por categoría — ese índice responde a otra consulta
-- (ver supabase/2026-10-01-retro-is-retro.sql).
create index if not exists products_temporada_invierno_idx
  on products (created_at desc) where is_temporada_invierno;

-- Alta inicial: los abrigos de Streetwear según el título.
--
-- Réplica exacta de la regla de lib/invierno.ts (18 palabras + 2 descartes), medida
-- contra los 324 títulos reales de Streetwear: marca 89. Del catálogo entero la regla
-- encuentra 92; las otras 3 son de Equipaciones y se descartan a propósito:
-- "Football hoodie Real Madrid French football jersey" y "High version club/national
-- team football trench coat" son camisetas —entran por `hoodie` y `coat`—, y
-- "Equipación retro local BTS Windbreaker" sí es un rompevientos pero se pierde. Dos
-- camisetas de fútbol en una vitrina de invierno se ven peor que no mostrar el
-- rompevientos.
--
-- Idempotente: no desmarca lo que ya estaba marcado, así que se puede volver a correr
-- sin pisar la curaduría manual.
update products
set is_temporada_invierno = true
where is_temporada_invierno = false
  and category_id = (select id from categories where slug = 'streetwear')
  and not (title ilike '%short sleeve%' or title ilike '%half sleeve%')
  and (
    title ilike '%chaqueta%' or title ilike '%campera%' or title ilike '%abrigo%' or
    title ilike '%parka%' or title ilike '%pluma%' or title ilike '%sudadera%' or
    title ilike '%invierno%' or title ilike '%hoodie%' or title ilike '%hooded%' or
    title ilike '%sweatshirt%' or title ilike '%sweater%' or title ilike '%cardigan%' or
    title ilike '%fleece%' or title ilike '%jacket%' or title ilike '%coat%' or
    title ilike '%puffer%' or title ilike '%windbreaker%' or title ilike '%winter%'
  );

-- Vista previa (opcional), para ver cuántas quedaron marcadas:
--   select count(*) from products where is_temporada_invierno;
