-- Migration: kits 2026-27 (season + squads + competition patches)
-- Idempotent: safe to run more than once.

-- 1) season on products
alter table products add column if not exists season text;

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

-- 6) season backfill (only rows never classified)
update products set season = '2026-27' where season is null and title like '%2026%';
update products set season = '2025-26' where season is null and title like '%2025%';
