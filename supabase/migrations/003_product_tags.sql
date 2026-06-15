-- Product tags for admin search and organization
-- Run after schema.sql and 002_ecommerce.sql

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.product_tags (
  product_id uuid not null references public.products (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (product_id, tag_id)
);

create index if not exists product_tags_tag_id_idx on public.product_tags (tag_id);
create index if not exists tags_slug_idx on public.tags (slug);

alter table public.tags enable row level security;
alter table public.product_tags enable row level security;

-- Policies (drop first so this migration is safe to re-run)
drop policy if exists "Public read tags" on public.tags;
drop policy if exists "Admin insert tags" on public.tags;
drop policy if exists "Admin update tags" on public.tags;
drop policy if exists "Admin delete tags" on public.tags;

create policy "Public read tags" on public.tags for select using (true);
create policy "Admin insert tags" on public.tags for insert to authenticated with check (true);
create policy "Admin update tags" on public.tags for update to authenticated using (true) with check (true);
create policy "Admin delete tags" on public.tags for delete to authenticated using (true);

drop policy if exists "Public read product_tags" on public.product_tags;
drop policy if exists "Admin insert product_tags" on public.product_tags;
drop policy if exists "Admin delete product_tags" on public.product_tags;

create policy "Public read product_tags" on public.product_tags for select using (true);
create policy "Admin insert product_tags" on public.product_tags for insert to authenticated with check (true);
create policy "Admin delete product_tags" on public.product_tags for delete to authenticated using (true);

-- Default tags (same as public site category filters)
insert into public.tags (name, slug) values
  ('Pendant', 'pendant'),
  ('Sconce', 'sconce'),
  ('Chandelier', 'chandelier'),
  ('Floor lamp', 'floor'),
  ('Office', 'office')
on conflict (slug) do nothing;

insert into public.product_tags (product_id, tag_id)
select p.id, t.id
from public.products p
join public.tags t on t.slug = p.category
on conflict do nothing;
