-- Harvest Rentals: allow 8 more crops (20 in total).
-- New crops: jowar, ragi, bajra, sunflower, sesame, green_gram, black_gram, lentil.
-- Run this ONCE in the Supabase SQL editor. Safe to run again.

-- 1. Remove the old crop lists (they only allowed the first 12 crops).
do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.machines'::regclass, 'public.bookings'::regclass)
      and pg_get_constraintdef(c.oid) like '%pigeon_pea%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- 2. Add the new lists with all 20 crops.
alter table public.machines
  add constraint machines_crops_check check (
    cardinality(crops) > 0
    and crops <@ array[
      'wheat', 'rice', 'maize', 'sugarcane', 'cotton', 'soybean',
      'groundnut', 'millet', 'barley', 'mustard', 'chickpea', 'pigeon_pea',
      'jowar', 'ragi', 'bajra', 'sunflower', 'sesame', 'green_gram',
      'black_gram', 'lentil'
    ]::text[]
  );

alter table public.bookings
  add constraint bookings_crop_check check (crop in (
    'wheat', 'rice', 'maize', 'sugarcane', 'cotton', 'soybean',
    'groundnut', 'millet', 'barley', 'mustard', 'chickpea', 'pigeon_pea',
    'jowar', 'ragi', 'bajra', 'sunflower', 'sesame', 'green_gram',
    'black_gram', 'lentil'
  ));

notify pgrst, 'reload schema';
