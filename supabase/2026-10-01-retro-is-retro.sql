-- Marca las equipaciones retro dentro de la categoría Equipaciones.
-- Los productos retro conservan `category_id` = Equipaciones a propósito: de ahí
-- cuelgan el precio Fans/Jugador (lib/precios.ts) y la rama de compra
-- CompraEquipacion. Esta columna es lo único que los distingue.
alter table products add column if not exists is_retro boolean not null default false;

-- El listado /equipaciones/retro filtra por categoría + is_retro.
create index if not exists products_retro_idx on products (category_id) where is_retro;
