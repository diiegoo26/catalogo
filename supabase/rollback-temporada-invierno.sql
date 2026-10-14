-- Rollback de 2026-10-14-temporada-invierno.sql
--
-- Misma convención que rollback-clasificacion-categorias.sql: queda escrito junto al
-- cambio. Ningún producto cambió de categoría, así que no hay asignaciones que
-- restaurar; alcanza con quitar la columna y su índice.
--
-- Si el deploy ya lee `is_temporada_invierno`, revertir primero el código: este script
-- deja la consulta de /temporada-de-invierno apuntando a una columna inexistente.

begin;

drop index if exists products_temporada_invierno_idx;
alter table products drop column if exists is_temporada_invierno;

commit;
