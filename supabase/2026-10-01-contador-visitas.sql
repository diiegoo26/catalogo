-- Contador público de visitas de la tienda.
-- Una única fila que nunca crece: el total se incrementa dentro de Postgres,
-- así dos peticiones simultáneas no se pisan entre sí.

create table if not exists public.site_visits (
  id smallint primary key default 1 check (id = 1),
  total bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.site_visits (id, total) values (1, 0) on conflict (id) do nothing;

create or replace function public.incrementar_visitas()
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.site_visits
     set total = total + 1,
         updated_at = now()
   where id = 1
  returning total;
$$;

-- La anon solo lee; el incremento ocurre dentro de la función. El `revoke all`
-- es deliberado: Supabase concede INSERT/UPDATE/DELETE *y también TRUNCATE* sobre
-- las tablas de public, y TRUNCATE no pasa por RLS, así que sin esto el rol anon
-- podría vaciar el contador con una sola sentencia.
revoke all on public.site_visits from anon, authenticated;
grant select on public.site_visits to anon, authenticated;
grant execute on function public.incrementar_visitas() to anon, authenticated;

alter table public.site_visits enable row level security;

create policy "site_visits se lee publicamente"
  on public.site_visits for select
  to anon, authenticated
  using (true);
