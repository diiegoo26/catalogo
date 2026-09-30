-- Reseñas de ejemplo para KOVA ZONE (inventadas).
-- Se publican como si fueran de clientes reales; el dueño puede borrar
-- cualquiera desde Supabase:  delete from reviews where id = '...';
--
-- Uso: psql "$DATABASE_URL" -f supabase/seed-resenas.sql

-- 1) Fuera las reseñas de prueba creadas al verificar el formulario.
DELETE FROM reviews
WHERE body LIKE 'ZAPATILLA DE PRUEBA%'
   OR body LIKE 'RESEÑA DE PRUEBA%'
   OR body LIKE 'PRUEBA DOS%'
   OR body LIKE 'PRUEBA TRES%';

-- 2) Reseñas (tienda + producto). `dias` = antigüedad para que las fechas
--    queden repartidas y no todas el mismo día.
INSERT INTO reviews (product_id, author, rating, body, created_at)
SELECT
  (SELECT p.id FROM products p WHERE p.slug = n.slug),
  n.author,
  n.rating,
  n.body,
  now() - make_interval(days => n.dias)
FROM (VALUES
  -- ── Reseñas de la tienda (sin producto) ──────────────────────────────
  (NULL::text, 'Marta G.', 5::smallint, 'Compré una equipación personalizada y quedó perfecta. La atención por Telegram fue rápida y muy clara.', 12),
  (NULL, 'Diego R.', 4, 'Buena calidad y precio. Tardó unos días más de lo que esperaba, pero me avisaron en todo momento.', 21),
  (NULL, 'Lucía M.', 5, 'Es la tercera vez que pido. Todo llega bien embalado y tal cual se ve en las fotos.', 34),
  (NULL, 'Iván P.', 5, 'Pedí unos sneakers y son idénticos a los de las imágenes. Repetiré seguro.', 48),
  (NULL, 'Sara L.', 4, 'El trato es genial, responden enseguida. La talla me quedó justa, mejor preguntar antes.', 57),
  (NULL, 'Rubén C.', 5, 'Envío rápido dentro de la península y muy buena comunicación por Telegram.', 73),
  (NULL, 'Alba T.', 3, 'El producto está bien, pero el pedido tardó en salir. Aun así me lo solucionaron.', 90),

  -- ── Sneakers ─────────────────────────────────────────────────────────
  ('air-forze-01', 'Javier R.', 5, 'Comodísimos y la talla coincide con la que uso siempre. Se nota la calidad del material.', 15),
  ('air-forze-01', 'Nacho V.', 4, 'Muy contento, los he llevado el día entero sin molestias.', 40),
  ('air-forze-02', 'Elena S.', 5, 'Preciosos en persona, incluso mejor que en las fotos.', 26),
  ('air-forze-04', 'Tomás A.', 4, 'Ligeros y muy bien acabados. La caja llegó algo golpeada, pero la zapatilla perfecta.', 61),

  -- ── Streetwear ───────────────────────────────────────────────────────
  ('vantor-01', 'Paula D.', 5, 'El algodón es grueso y no se deforma al lavar. Talla normal.', 18),
  ('vantor-01', 'Marcos B.', 4, 'Buena calidad, aunque el color es un pelín más oscuro que en la foto.', 52),
  ('vantor-02', 'Cristina F.', 5, 'Sienta muy bien y el estampado es nítido.', 29),
  ('vantor-03', 'Álvaro N.', 5, 'Me encanta cómo queda. Pediré otra en otro color.', 44),

  -- ── Chanclas ─────────────────────────────────────────────────────────
  ('playa-01', 'Rocío H.', 5, 'Comodísimas para la piscina, no resbalan nada.', 22),
  ('playa-01', 'Sergio M.', 4, 'Buen material y muy ligeras.', 66),
  ('playa-03', 'Nerea J.', 5, 'Perfectas para la playa, secan rapidísimo.', 36),

  -- ── Bolsos ───────────────────────────────────────────────────────────
  ('marvella-01', 'Beatriz L.', 5, 'El acabado es muy bueno y cabe más de lo que parece.', 9),
  ('marvella-01', 'Andrés G.', 3, 'Muy bonito, aunque el cierre podría ser más firme.', 47),
  ('marvella-02', 'Miriam P.', 5, 'Era un regalo y le encantó. La calidad se nota mucho.', 25),
  ('marvella-04', 'Óscar R.', 5, 'Elegante y bien hecho. Llegó en el plazo indicado.', 58),

  -- ── Relojes ──────────────────────────────────────────────────────────
  ('cronos-01', 'Guillermo T.', 5, 'Muy elegante y funciona perfecto. La correa es cómoda.', 14),
  ('cronos-01', 'Diana C.', 4, 'Buena relación calidad-precio, aunque el manual venía solo en inglés.', 38),
  ('cronos-02', 'Raquel V.', 5, 'Se lo regalé a mi padre y está encantado.', 55),
  ('cronos-04', 'Pablo M.', 5, 'Se ve sólido y la esfera es preciosa.', 71),

  -- ── Accesorios ───────────────────────────────────────────────────────
  ('genesys-01', 'Lorena A.', 4, 'Buen acabado por el precio que tiene.', 20),
  ('cartiel-01', 'Hugo S.', 5, 'Perfecto, idéntico a la descripción.', 33),
  ('cartiel-01', 'Sandra E.', 5, 'Muy contento con la compra, repetiré.', 69),
  ('cartiel-02', 'Bruno K.', 4, 'Calidad buena y el paquete llegó en perfecto estado.', 84),

  -- ── Equipaciones ─────────────────────────────────────────────────────
  ('camiseta-hercules-2026', 'Antonio L.', 5, 'La personalización con nombre y número quedó perfecta.', 11),
  ('camiseta-hercules-2026', 'Verónica D.', 5, 'Tela muy buena y el escudo va bordado, no impreso. Espectacular.', 42),
  ('camiseta-dresden-2026', 'Ismael P.', 4, 'Talla fiel y muy buen acabado.', 63),
  ('camiseta-die-roten-2026', 'Carmen O.', 5, 'Preciosa. Los parches venían ya puestos.', 77)
) AS n(slug, author, rating, body, dias)
WHERE (n.slug IS NULL OR EXISTS (SELECT 1 FROM products p WHERE p.slug = n.slug));
