# Catálogo digital · Next.js + Tailwind + Supabase

**Producción:** https://kova-zone.vercel.app — proyecto `kova-zone` en Vercel (auto-deploy desde `main`).

1. `npx create-next-app@latest catalogo --ts --tailwind --app --src-dir=false --import-alias "@/*"`
2. Copia estos archivos encima del proyecto y ejecuta `npm i @supabase/supabase-js`
3. Ejecuta `supabase/schema.sql` en el SQL Editor de Supabase
4. Copia `.env.local.example` a `.env.local` y rellena las claves
5. `npm run dev`

IMPORTANTE: los slugs de categoría 'equipaciones' y 'calzado' deben existir tal cual
(tienen rutas propias); el resto de categorías usan automáticamente /[categoria].
