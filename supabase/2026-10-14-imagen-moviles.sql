-- Imagen del tile de la categoría "Móviles" en la portada.
--
-- `moviles` es la única de las 14 categorías sin foto: su `image_url` está en NULL, así
-- que la grilla cae a la inicial del nombre ("M"). Este UPDATE la completa.
--
-- OJO con el look: `/productos/…` NO se amplía (ver `isLocalCatalogImage` en
-- `lib/media.ts`). El tile muestra la miniatura contenida sobre un panel claro, con el
-- texto en tinta, en vez de a sangre con velo como las otras 13 categorías. No hay foto
-- remota propia disponible: los 8 productos de la categoría solo tienen miniaturas
-- locales de 256x256, y la más grande de toda la carpeta tampoco las supera.
--
-- Si querés el mismo look que el resto, reemplazá el valor de abajo por una URL externa
-- (Google Drive `lh3.googleusercontent.com/d/…` o una foto CC0 de StockSnap) y volvé a
-- correr este archivo. Los hosts ya están permitidos en `next.config.ts`, así que la
-- URL no necesita ningún cambio de código.
--
-- Idempotente: se puede correr las veces que haga falta.
update categories
   set image_url = '/productos/sudu/samsung-s26-ultar-1.webp'
 where slug = 'moviles';

-- Para revertir (dejarla como estaba, sin foto):
-- update categories set image_url = null where slug = 'moviles';
