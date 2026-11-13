-- Drivers: people who operate harvesters and other machines for hire.
-- Tables are readable only by the people involved; everyone else goes through
-- SECURITY DEFINER functions so phone numbers stay private until allowed.

create table if not exists public.driver_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  experience_years integer not null,
  machine_types public.machine_type[] not null,
  crops text[] not null default '{}',
  village text not null,
  district text not null,
  state text not null,
  phone text not null,
  rate_amount numeric,
  rate_unit text,
  bio text,
  is_active boolean not null default false,
  is_available boolean not null default true,
  phone_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_profiles_experience_check check (experience_years between 0 and 60),
  constraint driver_profiles_machine_types_check check (cardinality(machine_types) between 1 and 6),
  constraint driver_profiles_crops_check check (crops <@ array['wheat','rice','maize','sugarcane','cotton','soybean','groundnut','millet','barley','mustard','chickpea','pigeon_pea','jowar','ragi','bajra','sunflower','sesame','green_gram','black_gram','lentil']::text[]),
  constraint driver_profiles_village_check check (char_length(village) between 2 and 80),
  constraint driver_profiles_district_check check (char_length(district) between 2 and 80),
  constraint driver_profiles_state_check check (char_length(state) between 2 and 80),
  constraint driver_profiles_phone_check check (phone ~ '^[6-9][0-9]{9}$'),
  constraint driver_profiles_rate_check check (
    (rate_amount is null and rate_unit is null)
    or (rate_amount between 1 and 100000 and rate_unit in ('per_acre','per_hour','per_day'))
  ),
  constraint driver_profiles_bio_check check (bio is null or char_length(bio) <= 300)
);

create index if not exists driver_profiles_active_district_idx
  on public.driver_profiles (lower(district)) where is_active;
create index if not exists driver_profiles_machine_types_idx
  on public.driver_profiles using gin (machine_types);

drop trigger if exists trg_driver_profiles_touch on public.driver_profiles;
create trigger trg_driver_profiles_touch
  before update on public.driver_profiles
  for each row execute function public.touch_updated_at();

create table if not exists public.driver_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  machine_type public.machine_type not null,
  service_date date not null,
  days integer not null default 1,
  village text not null,
  crop text,
  contact_phone text not null,
  notes text,
  status text not null default 'pending',
  driver_note text,
  responded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_requests_not_self check (driver_id <> requester_id),
  constraint driver_requests_days_check check (days between 1 and 60),
  constraint driver_requests_village_check check (char_length(village) between 2 and 80),
  constraint driver_requests_phone_check check (contact_phone ~ '^[6-9][0-9]{9}$'),
  constraint driver_requests_notes_check check (notes is null or char_length(notes) <= 500),
  constraint driver_requests_driver_note_check check (driver_note is null or char_length(driver_note) <= 500),
  constraint driver_requests_status_check check (status in ('pending','accepted','declined','cancelled')),
  constraint driver_requests_crop_check check (crop is null or crop = any (array['wheat','rice','maize','sugarcane','cotton','soybean','groundnut','millet','barley','mustard','chickpea','pigeon_pea','jowar','ragi','bajra','sunflower','sesame','green_gram','black_gram','lentil']::text[]))
);

create index if not exists driver_requests_driver_idx
  on public.driver_requests (driver_id, status, service_date);
create index if not exists driver_requests_requester_idx
  on public.driver_requests (requester_id, created_at desc);
create unique index if not exists driver_requests_one_pending
  on public.driver_requests (requester_id, driver_id, service_date) where status = 'pending';

drop trigger if exists trg_driver_requests_touch on public.driver_requests;
create trigger trg_driver_requests_touch
  before update on public.driver_requests
  for each row execute function public.touch_updated_at();

create table if not exists public.driver_ratings (
  request_id uuid primary key references public.driver_requests(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  rater_id uuid not null references public.profiles(id) on delete cascade,
  stars integer not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint driver_ratings_stars_check check (stars between 1 and 5),
  constraint driver_ratings_comment_check check (comment is null or char_length(comment) <= 300)
);
create index if not exists driver_ratings_driver_idx on public.driver_ratings (driver_id);

-- Row level security: only the people involved can read rows; nobody writes directly.
alter table public.driver_profiles enable row level security;
alter table public.driver_requests enable row level security;
alter table public.driver_ratings enable row level security;

drop policy if exists driver_profiles_select_own on public.driver_profiles;
create policy driver_profiles_select_own on public.driver_profiles
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists driver_requests_select_involved on public.driver_requests;
create policy driver_requests_select_involved on public.driver_requests
  for select to authenticated
  using (driver_id = (select auth.uid()) or requester_id = (select auth.uid()));

drop policy if exists driver_ratings_select_involved on public.driver_ratings;
create policy driver_ratings_select_involved on public.driver_ratings
  for select to authenticated
  using (driver_id = (select auth.uid()) or rater_id = (select auth.uid()));

revoke all on public.driver_profiles from anon, authenticated;
revoke all on public.driver_requests from anon, authenticated;
revoke all on public.driver_ratings from anon, authenticated;
grant select on public.driver_profiles to authenticated;
grant select on public.driver_requests to authenticated;
grant select on public.driver_ratings to authenticated;

-- Result shapes
drop type if exists public.driver_card cascade;
create type public.driver_card as (
  user_id uuid,
  full_name text,
  avatar_path text,
  experience_years integer,
  machine_types text[],
  crops text[],
  village text,
  district text,
  state text,
  rate_amount numeric,
  rate_unit text,
  bio text,
  is_available boolean,
  phone text,
  rating_avg numeric,
  rating_count integer,
  jobs_done integer
);

drop type if exists public.driver_request_row cascade;
create type public.driver_request_row as (
  id uuid,
  driver_id uuid,
  requester_id uuid,
  machine_type text,
  service_date date,
  days integer,
  village text,
  crop text,
  contact_phone text,
  notes text,
  status text,
  driver_note text,
  created_at timestamptz,
  responded_at timestamptz,
  other_name text,
  other_avatar_path text,
  other_phone text,
  rating_stars integer
);

-- Internal helpers (not callable from the API)
create or replace function public.driver_is_busy(
  p_driver uuid, p_from date, p_days integer, p_exclude uuid default null
) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.driver_requests r
    where r.driver_id = p_driver
      and r.status = 'accepted'
      and (p_exclude is null or r.id <> p_exclude)
      and r.service_date < p_from + p_days
      and p_from < r.service_date + r.days
  );
$$;

create or replace function public.driver_cards_for_viewer(p_viewer uuid)
returns setof public.driver_card
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    dp.user_id,
    p.full_name,
    p.avatar_path,
    dp.experience_years,
    dp.machine_types::text[],
    dp.crops,
    dp.village,
    dp.district,
    dp.state,
    dp.rate_amount,
    dp.rate_unit,
    dp.bio,
    dp.is_available,
    case
      when dp.phone_public
        or exists (
          select 1 from public.driver_requests r
          where r.driver_id = dp.user_id and r.requester_id = p_viewer and r.status = 'accepted'
        )
      then dp.phone
      else null
    end,
    (select round(avg(dr.stars)::numeric, 1) from public.driver_ratings dr where dr.driver_id = dp.user_id),
    (select count(*)::integer from public.driver_ratings dr where dr.driver_id = dp.user_id),
    (select count(*)::integer from public.driver_requests r
       where r.driver_id = dp.user_id and r.status = 'accepted'
         and r.service_date + r.days <= (now() at time zone 'Asia/Kolkata')::date)
  from public.driver_profiles dp
  join public.profiles p on p.id = dp.user_id
  where dp.is_active;
$$;

revoke execute on function public.driver_is_busy(uuid, date, integer, uuid) from public, anon, authenticated;
revoke execute on function public.driver_cards_for_viewer(uuid) from public, anon, authenticated;

-- Driver profile
create or replace function public.save_driver_profile(
  p_experience_years integer,
  p_machine_types text[],
  p_crops text[],
  p_village text,
  p_district text,
  p_state text,
  p_phone text,
  p_rate_amount numeric default null,
  p_rate_unit text default null,
  p_bio text default null,
  p_is_active boolean default false,
  p_is_available boolean default true,
  p_phone_public boolean default true
) returns public.driver_profiles
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_types public.machine_type[];
  v_crops text[];
  v_village text := btrim(coalesce(p_village, ''));
  v_district text := btrim(coalesce(p_district, ''));
  v_state text := btrim(coalesce(p_state, ''));
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_row public.driver_profiles;
begin
  if v_user is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'HR_NOT_FOUND: profile not found' using errcode = 'P0001';
  end if;
  if p_experience_years is null or p_experience_years < 0 or p_experience_years > 60 then
    raise exception 'HR_INVALID_INPUT: invalid experience' using errcode = 'P0001';
  end if;
  if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'HR_INVALID_INPUT: invalid phone' using errcode = 'P0001';
  end if;
  if (p_rate_amount is null) <> (p_rate_unit is null) then
    raise exception 'HR_INVALID_INPUT: rate needs an amount and a unit' using errcode = 'P0001';
  end if;

  begin
    select array_agg(distinct t::public.machine_type)
      into v_types
      from unnest(coalesce(p_machine_types, '{}'::text[])) t;
  exception when invalid_text_representation then
    raise exception 'HR_INVALID_INPUT: unknown machine type' using errcode = 'P0001';
  end;
  if v_types is null or cardinality(v_types) < 1 then
    raise exception 'HR_INVALID_INPUT: choose at least one machine' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct c), '{}'::text[])
    into v_crops
    from unnest(coalesce(p_crops, '{}'::text[])) c;

  begin
    insert into public.driver_profiles (
      user_id, experience_years, machine_types, crops, village, district, state, phone,
      rate_amount, rate_unit, bio, is_active, is_available, phone_public
    ) values (
      v_user, p_experience_years, v_types, v_crops, v_village, v_district, v_state, p_phone,
      p_rate_amount, p_rate_unit, v_bio,
      coalesce(p_is_active, false), coalesce(p_is_available, true), coalesce(p_phone_public, true)
    )
    on conflict (user_id) do update set
      experience_years = excluded.experience_years,
      machine_types = excluded.machine_types,
      crops = excluded.crops,
      village = excluded.village,
      district = excluded.district,
      state = excluded.state,
      phone = excluded.phone,
      rate_amount = excluded.rate_amount,
      rate_unit = excluded.rate_unit,
      bio = excluded.bio,
      is_active = excluded.is_active,
      is_available = excluded.is_available,
      phone_public = excluded.phone_public
    returning * into v_row;
  exception when check_violation then
    raise exception 'HR_INVALID_INPUT: invalid driver details' using errcode = 'P0001';
  end;

  return v_row;
end;
$$;

create or replace function public.set_driver_status(
  p_is_active boolean default null,
  p_is_available boolean default null
) returns public.driver_profiles
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.driver_profiles;
begin
  if v_user is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  update public.driver_profiles
     set is_active = coalesce(p_is_active, is_active),
         is_available = coalesce(p_is_available, is_available)
   where user_id = v_user
   returning * into v_row;
  if v_row.user_id is null then
    raise exception 'HR_DRIVER_NOT_FOUND: create your driver profile first' using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

-- Search and details (signed-in users only)
create or replace function public.search_drivers(
  p_village text default null,
  p_district text default null,
  p_state text default null,
  p_machine_type text default null,
  p_crop text default null,
  p_min_experience integer default null,
  p_limit integer default 48,
  p_offset integer default 0
) returns setof public.driver_card
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_village text := nullif(btrim(coalesce(p_village, '')), '');
  v_district text := nullif(btrim(coalesce(p_district, '')), '');
  v_state text := nullif(btrim(coalesce(p_state, '')), '');
  v_type text := nullif(btrim(coalesce(p_machine_type, '')), '');
  v_crop text := nullif(btrim(coalesce(p_crop, '')), '');
  v_village_like text;
  v_district_like text;
  v_state_like text;
begin
  if v_user is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  v_village_like := '%' || replace(replace(replace(lower(coalesce(v_village, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_district_like := '%' || replace(replace(replace(lower(coalesce(v_district, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_state_like := '%' || replace(replace(replace(lower(coalesce(v_state, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select c.*
  from public.driver_cards_for_viewer(v_user) c
  where c.user_id <> v_user
    and (v_type is null or v_type = any (c.machine_types))
    and (v_crop is null or cardinality(c.crops) = 0 or v_crop = any (c.crops))
    and (p_min_experience is null or c.experience_years >= p_min_experience)
    and (
      (v_village is null and v_district is null and v_state is null)
      or (v_village is not null
          and (lower(c.village) like v_village_like or lower(c.district) like v_village_like))
      or (v_district is not null and lower(c.district) like v_district_like)
      or (v_village is null and v_district is null and v_state is not null
          and lower(c.state) like v_state_like)
    )
  order by
    case
      when v_village is not null and lower(c.village) = lower(v_village) then 0
      when v_village is not null and lower(c.village) like v_village_like then 1
      when v_district is not null and lower(c.district) like v_district_like then 2
      when v_village is not null and lower(c.district) like v_village_like then 2
      else 3
    end asc,
    c.is_available desc,
    coalesce(c.rating_avg, 0) desc,
    c.experience_years desc,
    c.user_id
  limit least(greatest(coalesce(p_limit, 48), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.get_driver(p_driver_id uuid)
returns setof public.driver_card
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  return query
  select c.* from public.driver_cards_for_viewer(v_user) c where c.user_id = p_driver_id;
end;
$$;

-- Hire requests
create or replace function public.create_driver_request(
  p_driver_id uuid,
  p_machine_type text,
  p_service_date date,
  p_days integer,
  p_village text,
  p_crop text,
  p_contact_phone text,
  p_notes text default null
) returns public.driver_requests
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_me public.profiles;
  v_driver public.driver_profiles;
  v_type public.machine_type;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_village text := btrim(coalesce(p_village, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_crop text := nullif(btrim(coalesce(p_crop, '')), '');
  v_req public.driver_requests;
begin
  if v_user is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  select * into v_me from public.profiles where id = v_user;
  if v_me.id is null then
    raise exception 'HR_NOT_FOUND: profile not found' using errcode = 'P0001';
  end if;
  if p_driver_id = v_user then
    raise exception 'HR_DRIVER_SELF: you cannot hire yourself' using errcode = 'P0001';
  end if;

  select * into v_driver from public.driver_profiles where user_id = p_driver_id for update;
  if v_driver.user_id is null or not v_driver.is_active then
    raise exception 'HR_DRIVER_NOT_FOUND: driver not found' using errcode = 'P0001';
  end if;
  if not v_driver.is_available then
    raise exception 'HR_DRIVER_UNAVAILABLE: driver is not available now' using errcode = 'P0001';
  end if;

  begin
    v_type := p_machine_type::public.machine_type;
  exception when invalid_text_representation then
    raise exception 'HR_INVALID_INPUT: unknown machine type' using errcode = 'P0001';
  end;
  if not (v_type = any (v_driver.machine_types)) then
    raise exception 'HR_DRIVER_MISMATCH: driver does not run this machine' using errcode = 'P0001';
  end if;

  if p_service_date is null or p_service_date < v_today then
    raise exception 'HR_PAST_DATE: service date must be today or later' using errcode = 'P0001';
  end if;
  if p_service_date > v_today + 365 then
    raise exception 'HR_INVALID_INPUT: service date is too far ahead' using errcode = 'P0001';
  end if;
  if p_days is null or p_days < 1 or p_days > 60 then
    raise exception 'HR_INVALID_INPUT: invalid number of days' using errcode = 'P0001';
  end if;
  if char_length(v_village) < 2 or char_length(v_village) > 80 then
    raise exception 'HR_INVALID_INPUT: invalid village' using errcode = 'P0001';
  end if;
  if p_contact_phone is null or p_contact_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'HR_INVALID_INPUT: invalid contact phone' using errcode = 'P0001';
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'HR_INVALID_INPUT: notes are too long' using errcode = 'P0001';
  end if;

  if public.driver_is_busy(p_driver_id, p_service_date, p_days, null) then
    raise exception 'HR_DRIVER_BUSY: driver is already booked for those dates' using errcode = 'P0001';
  end if;

  begin
    insert into public.driver_requests (
      driver_id, requester_id, machine_type, service_date, days, village, crop, contact_phone, notes
    ) values (
      p_driver_id, v_user, v_type, p_service_date, p_days, v_village, v_crop, p_contact_phone, v_notes
    ) returning * into v_req;
  exception
    when unique_violation then
      raise exception 'HR_DRIVER_DUPLICATE: you already asked this driver for that date' using errcode = 'P0001';
    when check_violation then
      raise exception 'HR_INVALID_INPUT: invalid request details' using errcode = 'P0001';
  end;

  insert into public.notifications (user_id, kind, payload)
  values (
    p_driver_id,
    'driver_request_created'::public.notification_kind,
    jsonb_build_object(
      'audience', 'driver',
      'request_id', v_req.id,
      'requester_name', v_me.full_name,
      'machine_type', v_req.machine_type,
      'service_date', v_req.service_date,
      'village', v_req.village
    )
  );

  return v_req;
end;
$$;

create or replace function public.respond_to_driver_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null
) returns public.driver_requests
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_req public.driver_requests;
  v_driver_name text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_user is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  select * into v_req from public.driver_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'HR_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  if v_req.driver_id <> v_user then
    raise exception 'HR_DRIVER_FORBIDDEN: not your request' using errcode = 'P0001';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'HR_DRIVER_STATE: request is no longer pending' using errcode = 'P0001';
  end if;
  if p_decision is null or p_decision not in ('accepted', 'declined') then
    raise exception 'HR_INVALID_DECISION: decision must be accepted or declined' using errcode = 'P0001';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'HR_INVALID_INPUT: note is too long' using errcode = 'P0001';
  end if;

  if p_decision = 'accepted' then
    perform 1 from public.driver_profiles where user_id = v_user for update;
    if v_req.service_date + v_req.days <= v_today then
      raise exception 'HR_DRIVER_STATE: these dates have already passed' using errcode = 'P0001';
    end if;
    if public.driver_is_busy(v_user, v_req.service_date, v_req.days, v_req.id) then
      raise exception 'HR_DRIVER_BUSY: you already accepted another job on those dates' using errcode = 'P0001';
    end if;
  end if;

  update public.driver_requests
     set status = p_decision, driver_note = v_note, responded_at = now()
   where id = v_req.id
   returning * into v_req;

  select full_name into v_driver_name from public.profiles where id = v_user;

  insert into public.notifications (user_id, kind, payload)
  values (
    v_req.requester_id,
    case when p_decision = 'accepted'
      then 'driver_request_accepted'::public.notification_kind
      else 'driver_request_declined'::public.notification_kind end,
    jsonb_build_object(
      'audience', 'requester',
      'request_id', v_req.id,
      'driver_name', v_driver_name,
      'machine_type', v_req.machine_type,
      'service_date', v_req.service_date
    )
  );

  return v_req;
end;
$$;

create or replace function public.cancel_driver_request(p_request_id uuid)
returns public.driver_requests
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_req public.driver_requests;
  v_name text;
begin
  if v_user is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  select * into v_req from public.driver_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'HR_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  if v_user <> v_req.requester_id and v_user <> v_req.driver_id then
    raise exception 'HR_DRIVER_FORBIDDEN: not your request' using errcode = 'P0001';
  end if;
  if v_req.status not in ('pending', 'accepted') then
    raise exception 'HR_DRIVER_STATE: request can no longer be cancelled' using errcode = 'P0001';
  end if;

  update public.driver_requests
     set status = 'cancelled', cancelled_at = now()
   where id = v_req.id
   returning * into v_req;

  select full_name into v_name from public.profiles where id = v_user;

  insert into public.notifications (user_id, kind, payload)
  values (
    case when v_user = v_req.requester_id then v_req.driver_id else v_req.requester_id end,
    'driver_request_cancelled'::public.notification_kind,
    jsonb_build_object(
      'audience', case when v_user = v_req.requester_id then 'driver' else 'requester' end,
      'request_id', v_req.id,
      'requester_name', case when v_user = v_req.requester_id then v_name else null end,
      'driver_name', case when v_user = v_req.driver_id then v_name else null end,
      'machine_type', v_req.machine_type,
      'service_date', v_req.service_date
    )
  );

  return v_req;
end;
$$;

create or replace function public.rate_driver(
  p_request_id uuid,
  p_stars integer,
  p_comment text default null
) returns public.driver_ratings
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_req public.driver_requests;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_row public.driver_ratings;
begin
  if v_user is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  select * into v_req from public.driver_requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'HR_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  if v_req.requester_id <> v_user then
    raise exception 'HR_DRIVER_FORBIDDEN: only the person who hired can rate' using errcode = 'P0001';
  end if;
  if v_req.status <> 'accepted' then
    raise exception 'HR_DRIVER_STATE: only accepted jobs can be rated' using errcode = 'P0001';
  end if;
  if v_req.service_date > v_today then
    raise exception 'HR_DRIVER_TOO_EARLY: rate after the work date' using errcode = 'P0001';
  end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'HR_INVALID_INPUT: stars must be 1 to 5' using errcode = 'P0001';
  end if;
  if v_comment is not null and char_length(v_comment) > 300 then
    raise exception 'HR_INVALID_INPUT: comment is too long' using errcode = 'P0001';
  end if;

  begin
    insert into public.driver_ratings (request_id, driver_id, rater_id, stars, comment)
    values (v_req.id, v_req.driver_id, v_user, p_stars, v_comment)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'HR_DRIVER_RATED: you already rated this job' using errcode = 'P0001';
  end;

  return v_row;
end;
$$;

create or replace function public.list_driver_requests(p_as text default 'requester')
returns setof public.driver_request_row
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  if p_as is null or p_as not in ('requester', 'driver') then
    raise exception 'HR_INVALID_INPUT: invalid view' using errcode = 'P0001';
  end if;

  if p_as = 'driver' then
    return query
    select r.id, r.driver_id, r.requester_id, r.machine_type::text, r.service_date, r.days,
           r.village, r.crop, r.contact_phone, r.notes, r.status, r.driver_note,
           r.created_at, r.responded_at,
           p.full_name, p.avatar_path, r.contact_phone,
           (select dr.stars from public.driver_ratings dr where dr.request_id = r.id)
    from public.driver_requests r
    join public.profiles p on p.id = r.requester_id
    where r.driver_id = v_user
    order by (r.status = 'pending') desc, r.service_date desc, r.created_at desc
    limit 100;
  else
    return query
    select r.id, r.driver_id, r.requester_id, r.machine_type::text, r.service_date, r.days,
           r.village, r.crop, r.contact_phone, r.notes, r.status, r.driver_note,
           r.created_at, r.responded_at,
           p.full_name, p.avatar_path,
           case when r.status = 'accepted' or coalesce(dp.phone_public, false) then dp.phone else null end,
           (select dr.stars from public.driver_ratings dr where dr.request_id = r.id)
    from public.driver_requests r
    join public.profiles p on p.id = r.driver_id
    left join public.driver_profiles dp on dp.user_id = r.driver_id
    where r.requester_id = v_user
    order by (r.status = 'pending') desc, r.service_date desc, r.created_at desc
    limit 100;
  end if;
end;
$$;

-- Only signed-in users may call these.
revoke execute on function public.save_driver_profile(integer, text[], text[], text, text, text, text, numeric, text, text, boolean, boolean, boolean) from public, anon;
revoke execute on function public.set_driver_status(boolean, boolean) from public, anon;
revoke execute on function public.search_drivers(text, text, text, text, text, integer, integer, integer) from public, anon;
revoke execute on function public.get_driver(uuid) from public, anon;
revoke execute on function public.create_driver_request(uuid, text, date, integer, text, text, text, text) from public, anon;
revoke execute on function public.respond_to_driver_request(uuid, text, text) from public, anon;
revoke execute on function public.cancel_driver_request(uuid) from public, anon;
revoke execute on function public.rate_driver(uuid, integer, text) from public, anon;
revoke execute on function public.list_driver_requests(text) from public, anon;

grant execute on function public.save_driver_profile(integer, text[], text[], text, text, text, text, numeric, text, text, boolean, boolean, boolean) to authenticated;
grant execute on function public.set_driver_status(boolean, boolean) to authenticated;
grant execute on function public.search_drivers(text, text, text, text, text, integer, integer, integer) to authenticated;
grant execute on function public.get_driver(uuid) to authenticated;
grant execute on function public.create_driver_request(uuid, text, date, integer, text, text, text, text) to authenticated;
grant execute on function public.respond_to_driver_request(uuid, text, text) to authenticated;
grant execute on function public.cancel_driver_request(uuid) to authenticated;
grant execute on function public.rate_driver(uuid, integer, text) to authenticated;
grant execute on function public.list_driver_requests(text) to authenticated;
