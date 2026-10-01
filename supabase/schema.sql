-- =========================================================
-- CATÁLOGO DIGITAL · Esquema Supabase / PostgreSQL
-- =========================================================
create extension if not exists pg_trgm;   -- búsqueda por texto tolerante (ILIKE rápido)

create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,          -- 'equipaciones', 'calzado', 'perfumes'...
  image_url   text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  created_at  timestamptz not null default now()
);

create table regions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  flag_url    text,             -- PNG de la bandera del país (null = sin imagen)
  created_at  timestamptz not null default now()
);

create table leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  region_id   uuid not null references regions(id) on delete cascade,
  logo_url    text,             -- PNG del escudo de la competición
  created_at  timestamptz not null default now(),
  unique (region_id, slug)
);

create table teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  league_id   uuid not null references leagues(id) on delete cascade,
  logo_url    text,
  created_at  timestamptz not null default now(),
  unique (league_id, slug)
);

create table products (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  slug         text not null unique,
  description  text,
  category_id  uuid not null references categories(id),
  brand_id     uuid references brands(id) on delete set null,
  team_id      uuid references teams(id)  on delete set null,
  images       jsonb not null default '[]'::jsonb,   -- ["https://...","https://..."]
  gender       text check (gender in ('hombre','mujer','unisex','nino')),  -- para filtros
  season       text,
  price        numeric(10, 2),  -- NULL = regla por categoría (lib/precios.ts)
  is_featured  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  size        text,          -- talla o medida (S, M, 42, 100ml...)
  color       text,
  stock       int not null default 0 check (stock >= 0),
  unique (product_id, size, color)
);

-- 2) squads
create table if not exists players (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references teams(id) on delete cascade,
  name      text not null,
  number    int  not null check (number between 1 and 99),
  unique (team_id, number)
);

-- 3) competitions that grant a patch (leagues are NOT here: they come from leagues.logo_url)
create table if not exists competitions (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      text not null unique,
  logo_url  text,
  kind      text not null check (kind in ('copa','continental'))
);

-- 4) club <-> competition
create table if not exists team_competitions (
  team_id        uuid not null references teams(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  primary key (team_id, competition_id)
);

create index if not exists players_team_id_idx          on players (team_id);
create index if not exists team_competitions_comp_idx   on team_competitions (competition_id);

-- 5) RLS: public read, same as every other table
do $$
declare t text;
begin
  foreach t in array array['players','competitions','team_competitions']
  loop
    execute format('alter table %I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'public read'
    ) then
      execute format('create policy "public read" on %I for select using (true)', t);
    end if;
  end loop;
end $$;

-- ---------- ÍNDICES ----------
create index on leagues (region_id);
create index on teams   (league_id);
create index on products (category_id);
create index on products (brand_id);
create index on products (team_id);
create index on products (category_id, brand_id);
create index on products (created_at desc);
create index on products (is_featured) where is_featured;
create index on product_variants (product_id);
-- Búsqueda rápida por título (ILIKE '%texto%')
create index products_title_trgm on products using gin (title gin_trgm_ops);

-- ---------- RLS: lectura pública, escritura solo con service_role/panel ----------
do $$
declare t text;
begin
  foreach t in array array['categories','brands','regions','leagues','teams','products','product_variants']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;

-- ---------- DATOS DE EJEMPLO ----------
insert into categories (name, slug, sort_order) values
  ('Equipaciones','equipaciones',1), ('Calzado','calzado',2),
  ('Perfumes','perfumes',3), ('Bolsos','bolsos',4), ('Accesorios','accesorios',5);
