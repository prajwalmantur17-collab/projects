-- Harvest Rentals core schema.
-- Safe to apply once to a fresh Supabase project (SQL editor or `supabase db push`).

create type public.user_role as enum ('farmer', 'owner');
create type public.booking_status as enum ('pending', 'confirmed', 'rejected', 'cancelled');
create type public.machine_type as enum (
  'combine_harvester',
  'tractor_harvester',
  'reaper',
  'thresher',
  'baler',
  'other'
);
create type public.notification_kind as enum (
  'booking_created',
  'booking_confirmed',
  'booking_rejected',
  'booking_cancelled'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'Farmer' check (char_length(full_name) between 1 and 120),
  role public.user_role,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'kn', 'hi')),
  village text check (village is null or char_length(village) between 2 and 80),
  district text check (district is null or char_length(district) between 2 and 80),
  state text check (state is null or char_length(state) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  machine_type public.machine_type not null,
  model text check (model is null or char_length(model) <= 80),
  price_per_acre numeric(10, 2) not null check (price_per_acre between 1 and 1000000),
  crops text[] not null check (
    cardinality(crops) > 0
    and crops <@ array[
      'wheat', 'rice', 'maize', 'sugarcane', 'cotton', 'soybean',
      'groundnut', 'millet', 'barley', 'mustard', 'chickpea', 'pigeon_pea'
    ]::text[]
  ),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  image_path text check (image_path is null or char_length(image_path) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machines_coordinates_together check ((latitude is null) = (longitude is null))
);

create index machines_owner_id_idx on public.machines (owner_id);
create index machines_active_type_idx on public.machines (is_active, machine_type);
create index machines_crops_idx on public.machines using gin (crops);

create table public.machine_locations (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete cascade,
  village text not null check (char_length(village) between 2 and 80),
  district text not null check (char_length(district) between 2 and 80),
  state text not null check (char_length(state) between 2 and 80),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index machine_locations_unique_village_idx
  on public.machine_locations (machine_id, lower(village));
create index machine_locations_machine_idx on public.machine_locations (machine_id);
create index machine_locations_village_idx on public.machine_locations (lower(village));

create table public.machine_blackout_dates (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete cascade,
  unavailable_on date not null,
  created_at timestamptz not null default now(),
  unique (machine_id, unavailable_on)
);

create index machine_blackout_dates_machine_date_idx
  on public.machine_blackout_dates (machine_id, unavailable_on);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete restrict,
  farmer_id uuid not null references public.profiles (id) on delete restrict,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  service_date date not null,
  village text not null check (char_length(village) between 2 and 80),
  acreage numeric(6, 2) not null check (acreage between 0.1 and 500),
  crop text not null check (crop in (
    'wheat', 'rice', 'maize', 'sugarcane', 'cotton', 'soybean',
    'groundnut', 'millet', 'barley', 'mustard', 'chickpea', 'pigeon_pea'
  )),
  contact_phone text not null check (contact_phone ~ '^[6-9][0-9]{9}$'),
  notes text check (notes is null or char_length(notes) <= 500),
  price_per_acre numeric(10, 2) not null check (price_per_acre > 0),
  status public.booking_status not null default 'pending',
  owner_note text check (owner_note is null or char_length(owner_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  cancelled_at timestamptz
);

create index bookings_farmer_created_idx on public.bookings (farmer_id, created_at desc);
create index bookings_owner_created_idx on public.bookings (owner_id, created_at desc);
create index bookings_machine_date_idx on public.bookings (machine_id, service_date);
create index bookings_service_date_idx on public.bookings (service_date);

-- One confirmed service per machine/day, and no duplicate pending requests
-- from the same farmer for the same machine/day. Enforced by the database so
-- double taps and two tabs cannot create conflicting bookings.
create unique index bookings_one_confirmed_per_machine_date
  on public.bookings (machine_id, service_date)
  where status = 'confirmed';
create unique index bookings_one_pending_per_farmer_machine_date
  on public.bookings (machine_id, farmer_id, service_date)
  where status = 'pending';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  kind public.notification_kind not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (user_id)
  where is_read = false;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger machines_touch_updated_at
  before update on public.machines
  for each row execute function public.touch_updated_at();

create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();

-- Read model used by the app: machine + owner name + primary service village
-- and the full list of service villages.
create view public.machine_cards
with (security_invoker = true)
as
select
  m.id,
  m.owner_id,
  m.machine_type,
  m.model,
  m.price_per_acre,
  m.crops,
  m.phone,
  m.latitude,
  m.longitude,
  m.image_path,
  m.is_active,
  m.created_at,
  m.updated_at,
  p.full_name as owner_name,
  primary_location.village,
  primary_location.district,
  primary_location.state,
  coalesce(service_villages.villages, array[]::text[]) as service_villages
from public.machines m
join public.profiles p on p.id = m.owner_id
join lateral (
  select ml.village, ml.district, ml.state
  from public.machine_locations ml
  where ml.machine_id = m.id
  order by ml.is_primary desc, ml.created_at asc
  limit 1
) primary_location on true
left join lateral (
  select array_agg(ml.village order by ml.is_primary desc, ml.village) as villages
  from public.machine_locations ml
  where ml.machine_id = m.id
) service_villages on true;
