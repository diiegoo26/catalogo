-- Precios de producto.
--
-- El precio vuelve a la web tras la eliminación del 2026-09-30. Esta vez el
-- modelo distingue el precio propio del producto del precio por calidad:
--
--   products.price  — precio propio en euros. NULL = "usa la regla de categoría".
--   Equipaciones    — no usan products.price: el precio depende de la calidad
--                     elegida (Fans 18 € / Jugador 25 €) en lib/precios.ts.
--   Resto           — si price es NULL, la regla por categoría da 60 € a
--                     sneakers; lo demás se muestra como "Precio a consultar".
--
-- Todos los productos empiezan con price NULL a propósito: nadie inventa precios
-- en bloque. Se rellenan a mano los que necesiten un importe propio.
alter table public.products
  add column if not exists price numeric(10, 2);

comment on column public.products.price is
  'Precio en euros. NULL = aplicar la regla por categoría de lib/precios.ts.';