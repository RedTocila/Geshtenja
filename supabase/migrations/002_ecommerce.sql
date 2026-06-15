-- E-commerce migration for Geshtenja Light
-- Run after schema.sql (or via scripts/migrate.mjs)

-- ─── Extend products ───────────────────────────────────────────────────────────

alter table public.products
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists short_description text,
  add column if not exists price numeric(10, 2) not null default 0,
  add column if not exists sale_price numeric(10, 2),
  add column if not exists sku text,
  add column if not exists stock_quantity int not null default 0,
  add column if not exists in_stock boolean not null default true,
  add column if not exists is_featured boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists products_slug_key on public.products (slug) where slug is not null;

-- Gallery images
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.product_images enable row level security;

create policy "Public read product_images" on public.product_images for select using (true);
create policy "Admin insert product_images" on public.product_images for insert to authenticated with check (true);
create policy "Admin update product_images" on public.product_images for update to authenticated using (true) with check (true);
create policy "Admin delete product_images" on public.product_images for delete to authenticated using (true);

-- ─── Orders ──────────────────────────────────────────────────────────────────

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'delivered', 'cancelled')),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  customer_city text not null,
  customer_address text not null,
  notes text,
  subtotal numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  payment_method text not null default 'cod',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_slug text,
  product_image_url text,
  unit_price numeric(10, 2) not null,
  quantity int not null check (quantity > 0),
  line_total numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Admin full access
create policy "Admin read orders" on public.orders for select to authenticated using (true);
create policy "Admin update orders" on public.orders for update to authenticated using (true) with check (true);
create policy "Admin delete orders" on public.orders for delete to authenticated using (true);

create policy "Admin read order_items" on public.order_items for select to authenticated using (true);
create policy "Admin delete order_items" on public.order_items for delete to authenticated using (true);

-- ─── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from lower(regexp_replace(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g')));
$$;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := 'GS-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.orders where order_number = candidate);
  end loop;
  return candidate;
end;
$$;

-- Atomic order creation (anon checkout)
create or replace function public.create_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_customer_city text,
  p_customer_address text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(10, 2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty int;
  v_unit_price numeric(10, 2);
  v_line_total numeric(10, 2);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  -- Validate stock & compute subtotal
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    if not found then
      raise exception 'Product not found';
    end if;

    if not v_product.in_stock or v_product.stock_quantity <= 0 then
      raise exception 'Product "%" is out of stock', v_product.name;
    end if;

    v_qty := greatest(1, (v_item->>'quantity')::int);

    if v_product.stock_quantity < v_qty then
      raise exception 'Insufficient stock for "%"', v_product.name;
    end if;

    v_unit_price := coalesce(v_product.sale_price, v_product.price);
    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  v_order_number := public.generate_order_number();

  insert into public.orders (
    order_number, status, customer_name, customer_phone, customer_email,
    customer_city, customer_address, notes, subtotal, total, payment_method
  ) values (
    v_order_number, 'pending', p_customer_name, p_customer_phone, p_customer_email,
    p_customer_city, p_customer_address, nullif(trim(p_notes), ''), v_subtotal, v_subtotal, 'cod'
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    v_qty := greatest(1, (v_item->>'quantity')::int);
    v_unit_price := coalesce(v_product.sale_price, v_product.price);
    v_line_total := v_unit_price * v_qty;

    insert into public.order_items (
      order_id, product_id, product_name, product_slug, product_image_url,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_product.name, v_product.slug, v_product.image_url,
      v_unit_price, v_qty, v_line_total
    );

    update public.products
    set
      stock_quantity = greatest(0, stock_quantity - v_qty),
      in_stock = greatest(0, stock_quantity - v_qty) > 0,
      updated_at = now()
    where id = v_product.id;
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'total', v_subtotal
  );
end;
$$;

revoke all on function public.create_order(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, text, text, jsonb) to anon, authenticated;

-- Backfill existing products
update public.products
set
  slug = coalesce(nullif(slug, ''), public.slugify(name) || '-' || substr(id::text, 1, 8)),
  price = case when price = 0 then 149.00 + (sort_order * 10) else price end,
  stock_quantity = case when stock_quantity = 0 then 12 else stock_quantity end,
  in_stock = true,
  short_description = coalesce(short_description, 'Ndriçim premium nga koleksioni Geshtenja.'),
  description = coalesce(description, 'Pjesë e kuruar për atmosferë, funksion dhe zanatçi të qëndrueshme. Për udhëzime instalimi, na kontaktoni.')
where slug is null or slug = '';
