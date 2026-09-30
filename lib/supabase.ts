import { createClient } from '@supabase/supabase-js';

// El catálogo se lee en vivo desde Supabase: desactivamos la Data Cache de
// Next.js para que las páginas nunca sirvan datos cacheados/obsoletos.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  }
);
