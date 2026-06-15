-- Run this in Supabase Dashboard → SQL Editor (project: Geshtenja)
-- Creates tables, storage bucket, and security policies for the admin dashboard.

-- Products (lighting catalog)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('pendant', 'sconce', 'chandelier', 'floor', 'office')),
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Portfolio / installation works
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  location text not null,
  image_url text,
  video_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.works enable row level security;

-- Anyone can read (public website)
create policy "Public read products" on public.products for select using (true);
create policy "Public read works" on public.works for select using (true);

-- Only logged-in admin can manage content
create policy "Admin insert products" on public.products for insert to authenticated with check (true);
create policy "Admin update products" on public.products for update to authenticated using (true) with check (true);
create policy "Admin delete products" on public.products for delete to authenticated using (true);

create policy "Admin insert works" on public.works for insert to authenticated with check (true);
create policy "Admin update works" on public.works for update to authenticated using (true) with check (true);
create policy "Admin delete works" on public.works for delete to authenticated using (true);

-- Storage bucket for photos & videos
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "Public read media" on storage.objects for select using (bucket_id = 'media');
create policy "Admin upload media" on storage.objects for insert to authenticated with check (bucket_id = 'media');
create policy "Admin update media" on storage.objects for update to authenticated using (bucket_id = 'media') with check (bucket_id = 'media');
create policy "Admin delete media" on storage.objects for delete to authenticated using (bucket_id = 'media');

-- Starter data (matches current website)
insert into public.products (name, category, image_url, sort_order) values
  ('Aurora Pendant', 'pendant', 'https://images.unsplash.com/photo-1565818652107-397974f6bb0e?w=600&q=80', 1),
  ('Lumen Sconce', 'sconce', 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&q=80', 2),
  ('Celeste Chandelier', 'chandelier', 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=600&q=80', 3),
  ('Noir Floor Lamp', 'floor', 'https://images.unsplash.com/photo-1507473889964-fe6f813af4c4?w=600&q=80', 4),
  ('Ember Mini Pendant', 'pendant', 'https://images.unsplash.com/photo-1524484485831-a92ffc35ce9e?w=600&q=80', 5),
  ('Halo Desk Lamp', 'office', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', 6),
  ('Stratus Cluster', 'pendant', 'https://images.unsplash.com/photo-1540932239984-3012e4d4b0ef?w=600&q=80', 7),
  ('Arc Wall Light', 'sconce', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', 8),
  ('Prism Office Pendant', 'office', 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=600&q=80', 9),
  ('Solstice Chandelier', 'chandelier', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80', 10),
  ('Dusk Floor Lamp', 'floor', 'https://images.unsplash.com/photo-1594620302200-ffee4ee1173f?w=600&q=80', 11),
  ('Beacon Task Light', 'office', 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=80', 12);

insert into public.works (title, type, location, image_url, sort_order) values
  ('Meridian Hotel Lobby', 'Hospitality', 'Prishtinë, 2025', null, 1),
  ('Loft 42 Residence', 'Residential', 'Tirana, 2025', null, 2),
  ('Botanica Restaurant', 'Restaurant', 'Prizren, 2024', null, 3),
  ('Northline Offices', 'Corporate', 'Skopje, 2024', null, 4),
  ('Atelier Showroom', 'Retail', 'Prishtinë, 2024', null, 5),
  ('Villa Dukagjini', 'Residential', 'Pejë, 2023', null, 6);
