-- Seed default tags from existing product categories and link products
-- Safe to re-run (uses ON CONFLICT)

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
