-- Initial schema: profiles, cocktails (Postgres catalog bridge), wishlist_items, cocktail_reviews.
-- Catalog strategy: `cocktails` stores stable `id_drink` (maps to SQLite / external API) plus `name`.
-- Full payload can stay in SQLite until you choose to mirror `payload_json` or similar into Postgres.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cocktails (
  id uuid primary key default gen_random_uuid(),
  id_drink text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  cocktail_id uuid not null references public.cocktails (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, cocktail_id)
);

create table public.cocktail_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  cocktail_id uuid not null references public.cocktails (id) on delete cascade,
  review text not null default '',
  rating integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, cocktail_id),
  constraint cocktail_reviews_rating_range check (rating >= 1 and rating <= 5)
);

create index wishlist_items_profile_id_idx on public.wishlist_items (profile_id);
create index wishlist_items_cocktail_id_idx on public.wishlist_items (cocktail_id);
create index cocktail_reviews_cocktail_id_idx on public.cocktail_reviews (cocktail_id);
create index cocktail_reviews_profile_id_idx on public.cocktail_reviews (profile_id);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup (SECURITY DEFINER in non-public schema)
-- ---------------------------------------------------------------------------

create schema if not exists private;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke all on schema private from public;
revoke all on all functions in schema private from public;
grant usage on schema private to postgres, supabase_auth_admin;
grant execute on function private.handle_new_user() to postgres, supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.cocktails enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.cocktail_reviews enable row level security;

-- profiles: own row only
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- cocktails: readable by anyone with the anon key (museum catalog); writes via service role / SQL editor
create policy cocktails_select_public on public.cocktails
  for select to anon, authenticated
  using (true);

-- wishlist: own rows only
create policy wishlist_select_own on public.wishlist_items
  for select to authenticated
  using (profile_id = auth.uid());

create policy wishlist_insert_own on public.wishlist_items
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy wishlist_update_own on public.wishlist_items
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy wishlist_delete_own on public.wishlist_items
  for delete to authenticated
  using (profile_id = auth.uid());

-- reviews: all authenticated users can read; only author can write
create policy cocktail_reviews_select_authenticated on public.cocktail_reviews
  for select to authenticated
  using (true);

create policy cocktail_reviews_insert_own on public.cocktail_reviews
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy cocktail_reviews_update_own on public.cocktail_reviews
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy cocktail_reviews_delete_own on public.cocktail_reviews
  for delete to authenticated
  using (profile_id = auth.uid());
