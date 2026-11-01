-- Profile bootstrap, machine search, and all booking state changes.
-- Booking writes go through SECURITY DEFINER functions so state transitions
-- and notifications stay consistent, and clients never write rows directly.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      'Farmer'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger harvest_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, full_name)
  select
    u.id,
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
      'Farmer'
    )
  from auth.users u
  where u.id = v_user_id
  on conflict (id) do nothing;

  select * into v_profile from public.profiles where id = v_user_id;
  if v_profile.id is null then
    raise exception 'HR_NOT_FOUND: profile could not be created' using errcode = 'P0001';
  end if;
  return v_profile;
end;
$$;

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    if coalesce(current_setting('harvest.allow_role_change', true), 'off') <> 'on' then
      raise exception 'HR_ROLE_ALREADY_SET: account type cannot be changed' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

create or replace function public.set_user_role(p_role public.user_role)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  if p_role is null then
    raise exception 'HR_INVALID_INPUT: account type is required' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where id = v_user_id for update;
  if v_profile.id is null then
    v_profile := public.ensure_profile();
    select * into v_profile from public.profiles where id = v_user_id for update;
  end if;

  if v_profile.role is not null then
    raise exception 'HR_ROLE_ALREADY_SET: account type is already set' using errcode = 'P0001';
  end if;

  perform set_config('harvest.allow_role_change', 'on', true);
  update public.profiles
    set role = p_role
    where id = v_user_id
    returning * into v_profile;
  perform set_config('harvest.allow_role_change', 'off', true);

  return v_profile;
end;
$$;

create or replace function public.search_machines(
  p_village text default null,
  p_district text default null,
  p_state text default null,
  p_crop text default null,
  p_machine_type text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns setof public.machine_cards
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with filters as (
    select
      nullif(btrim(p_village), '') as village,
      nullif(btrim(p_district), '') as district,
      nullif(btrim(p_state), '') as state,
      nullif(btrim(p_crop), '') as crop,
      nullif(btrim(p_machine_type), '') as machine_type
  )
  select mc.*
  from public.machine_cards mc
  cross join filters f
  where mc.is_active
    and (
      f.village is null
      or exists (
        select 1
        from public.machine_locations ml
        where ml.machine_id = mc.id
          and ml.village ilike '%' || f.village || '%'
      )
    )
    and (
      f.district is null
      or exists (
        select 1
        from public.machine_locations ml
        where ml.machine_id = mc.id
          and ml.district ilike '%' || f.district || '%'
      )
    )
    and (
      f.state is null
      or exists (
        select 1
        from public.machine_locations ml
        where ml.machine_id = mc.id
          and ml.state ilike '%' || f.state || '%'
      )
    )
    and (f.crop is null or f.crop = any (mc.crops))
    and (f.machine_type is null or mc.machine_type::text = f.machine_type)
  order by
    case
      when f.village is null then 0
      when lower(mc.village) = lower(f.village) then 0
      else 1
    end,
    mc.updated_at desc,
    mc.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.create_booking(
  p_machine_id uuid,
  p_service_date date,
  p_acreage numeric,
  p_village text,
  p_crop text,
  p_contact_phone text,
  p_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_farmer public.profiles;
  v_machine public.machines;
  v_village text;
  v_notes text;
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;

  select * into v_farmer from public.profiles where id = v_user_id;
  if v_farmer.id is null or v_farmer.role is distinct from 'farmer' then
    raise exception 'HR_ROLE_REQUIRED: only farmer accounts can book' using errcode = 'P0001';
  end if;

  select * into v_machine from public.machines where id = p_machine_id for update;
  if v_machine.id is null then
    raise exception 'HR_NOT_FOUND: machine not found' using errcode = 'P0001';
  end if;
  if v_machine.owner_id = v_user_id then
    raise exception 'HR_OWN_MACHINE: you cannot book your own machine' using errcode = 'P0001';
  end if;
  if not v_machine.is_active then
    raise exception 'HR_MACHINE_INACTIVE: listing is paused' using errcode = 'P0001';
  end if;

  if p_service_date is null then
    raise exception 'HR_INVALID_INPUT: service date is required' using errcode = 'P0001';
  end if;
  if p_service_date < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'HR_PAST_DATE: service date must be today or later' using errcode = 'P0001';
  end if;

  v_village := btrim(coalesce(p_village, ''));
  if char_length(v_village) < 2 or char_length(v_village) > 80 then
    raise exception 'HR_INVALID_INPUT: invalid village' using errcode = 'P0001';
  end if;

  if p_acreage is null or p_acreage < 0.1 or p_acreage > 500 then
    raise exception 'HR_INVALID_INPUT: invalid acreage' using errcode = 'P0001';
  end if;

  if p_contact_phone is null or p_contact_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'HR_INVALID_INPUT: invalid contact phone' using errcode = 'P0001';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'HR_INVALID_INPUT: notes are too long' using errcode = 'P0001';
  end if;

  if p_crop is null or not (p_crop = any (v_machine.crops)) then
    raise exception 'HR_CROP_NOT_SUPPORTED: crop not supported by this machine' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.machine_blackout_dates bd
    where bd.machine_id = v_machine.id and bd.unavailable_on = p_service_date
  ) then
    raise exception 'HR_BLACKOUT: owner is unavailable on that date' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.machine_id = v_machine.id
      and b.service_date = p_service_date
      and b.status = 'confirmed'
      and b.completed_at is null
  ) then
    raise exception 'HR_DATE_TAKEN: machine is already booked on that date' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.machine_id = v_machine.id
      and b.farmer_id = v_user_id
      and b.service_date = p_service_date
      and b.status = 'pending'
  ) then
    raise exception 'HR_DUPLICATE_PENDING: duplicate pending request' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    machine_id, farmer_id, owner_id, service_date, village, acreage,
    crop, contact_phone, notes, price_per_acre, status
  ) values (
    v_machine.id, v_user_id, v_machine.owner_id, p_service_date, v_village,
    p_acreage, p_crop, p_contact_phone, v_notes, v_machine.price_per_acre, 'pending'
  )
  returning * into v_booking;

  insert into public.notifications (user_id, booking_id, kind, payload)
  values (
    v_machine.owner_id,
    v_booking.id,
    'booking_created',
    jsonb_build_object(
      'machine_type', v_machine.machine_type,
      'village', v_booking.village,
      'service_date', v_booking.service_date,
      'farmer_name', v_farmer.full_name,
      'acreage', v_booking.acreage
    )
  );

  return v_booking;
exception
  when unique_violation then
    if sqlerrm like '%bookings_one_confirmed_per_machine_date%' then
      raise exception 'HR_DATE_TAKEN: machine is already booked on that date' using errcode = 'P0001';
    elsif sqlerrm like '%bookings_one_pending_per_farmer_machine_date%' then
      raise exception 'HR_DUPLICATE_PENDING: duplicate pending request' using errcode = 'P0001';
    else
      raise;
    end if;
end;
$$;

create or replace function public.respond_to_booking(
  p_booking_id uuid,
  p_decision text,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_machine public.machines;
  v_note text;
begin
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'HR_NOT_FOUND: booking not found' using errcode = 'P0001';
  end if;
  if v_booking.owner_id <> v_user_id then
    raise exception 'HR_NOT_OWNER: not your booking' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'pending' then
    raise exception 'HR_INVALID_STATE: booking is no longer pending' using errcode = 'P0001';
  end if;
  if p_decision is null or p_decision not in ('confirmed', 'rejected') then
    raise exception 'HR_INVALID_DECISION: decision must be confirmed or rejected' using errcode = 'P0001';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'HR_INVALID_INPUT: note is too long' using errcode = 'P0001';
  end if;

  if p_decision = 'confirmed' then
    select * into v_machine from public.machines where id = v_booking.machine_id for update;
    if v_machine.id is null then
      raise exception 'HR_NOT_FOUND: machine not found' using errcode = 'P0001';
    end if;
    if not v_machine.is_active then
      raise exception 'HR_MACHINE_PAUSED: reactivate the listing first' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.machine_blackout_dates bd
      where bd.machine_id = v_booking.machine_id
        and bd.unavailable_on = v_booking.service_date
    ) then
      raise exception 'HR_BLACKOUT: that date is blocked' using errcode = 'P0001';
    end if;
  end if;

  update public.bookings
  set
    status = p_decision::public.booking_status,
    owner_note = case when p_decision = 'rejected' then v_note else owner_note end,
    responded_at = now()
  where id = v_booking.id
  returning * into v_booking;

  insert into public.notifications (user_id, booking_id, kind, payload)
  values (
    v_booking.farmer_id,
    v_booking.id,
    case
      when p_decision = 'confirmed' then 'booking_confirmed'::public.notification_kind
      else 'booking_rejected'::public.notification_kind
    end,
    jsonb_build_object(
      'service_date', v_booking.service_date,
      'machine_type', (select machine_type from public.machines where id = v_booking.machine_id)
    )
  );

  return v_booking;
exception
  when unique_violation then
    if sqlerrm like '%bookings_one_confirmed_per_machine_date%' then
      raise exception 'HR_DATE_TAKEN: machine is already booked on that date' using errcode = 'P0001';
    else
      raise;
    end if;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'HR_NOT_FOUND: booking not found' using errcode = 'P0001';
  end if;
  if v_booking.farmer_id <> v_user_id then
    raise exception 'HR_NOT_OWNER: not your booking' using errcode = 'P0001';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'HR_INVALID_STATE: booking cannot be cancelled' using errcode = 'P0001';
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_at = now()
  where id = v_booking.id
  returning * into v_booking;

  insert into public.notifications (user_id, booking_id, kind, payload)
  values (
    v_booking.owner_id,
    v_booking.id,
    'booking_cancelled',
    jsonb_build_object(
      'service_date', v_booking.service_date,
      'machine_type', (select machine_type from public.machines where id = v_booking.machine_id)
    )
  );

  return v_booking;
end;
$$;

-- Blocking a date that already has a confirmed booking would leave the farmer
-- with a confirmed but serviceable-looking request. The machine row lock makes
-- this consistent with confirmations, which lock the same row.
create or replace function public.guard_blackout_conflict()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_machine public.machines;
begin
  select * into v_machine from public.machines where id = new.machine_id for update;
  if v_machine.id is null then
    raise exception 'HR_NOT_FOUND: machine not found' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.bookings b
    where b.machine_id = new.machine_id
      and b.service_date = new.unavailable_on
      and b.status = 'confirmed'
  ) then
    raise exception 'HR_BLACKOUT_CONFLICT: a confirmed booking exists on that date'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger machine_blackout_dates_guard_conflict
  before insert on public.machine_blackout_dates
  for each row execute function public.guard_blackout_conflict();

create or replace function public.set_machine_locations(
  p_machine_id uuid,
  p_locations jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_element jsonb;
  v_village text;
  v_district text;
  v_state text;
  v_primary_count integer := 0;
  v_villages text[] := array[]::text[];
begin
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;

  select owner_id into v_owner_id from public.machines where id = p_machine_id;
  if v_owner_id is null then
    raise exception 'HR_NOT_FOUND: machine not found' using errcode = 'P0001';
  end if;
  if v_owner_id <> v_user_id then
    raise exception 'HR_NOT_OWNER: not your machine' using errcode = 'P0001';
  end if;

  if p_locations is null or jsonb_typeof(p_locations) <> 'array' then
    raise exception 'HR_LOCATION_REQUIRED: locations must be an array' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_locations) < 1 or jsonb_array_length(p_locations) > 8 then
    raise exception 'HR_LOCATION_REQUIRED: add between 1 and 8 villages' using errcode = 'P0001';
  end if;

  for v_element in select * from jsonb_array_elements(p_locations)
  loop
    if jsonb_typeof(v_element) <> 'object' then
      raise exception 'HR_INVALID_INPUT: invalid location' using errcode = 'P0001';
    end if;

    v_village := btrim(coalesce(v_element ->> 'village', ''));
    v_district := btrim(coalesce(v_element ->> 'district', ''));
    v_state := btrim(coalesce(v_element ->> 'state', ''));

    if char_length(v_village) < 2 or char_length(v_village) > 80
      or char_length(v_district) < 2 or char_length(v_district) > 80
      or char_length(v_state) < 2 or char_length(v_state) > 80 then
      raise exception 'HR_INVALID_INPUT: invalid village, district, or state' using errcode = 'P0001';
    end if;

    if lower(v_village) = any (v_villages) then
      raise exception 'HR_INVALID_INPUT: duplicate village' using errcode = 'P0001';
    end if;
    v_villages := array_append(v_villages, lower(v_village));

    if coalesce((v_element ->> 'is_primary')::boolean, false) then
      v_primary_count := v_primary_count + 1;
    end if;
  end loop;

  if v_primary_count <> 1 then
    raise exception 'HR_LOCATION_REQUIRED: exactly one primary village is required' using errcode = 'P0001';
  end if;

  delete from public.machine_locations where machine_id = p_machine_id;

  insert into public.machine_locations (machine_id, village, district, state, is_primary)
  select
    p_machine_id,
    btrim(element ->> 'village'),
    btrim(element ->> 'district'),
    btrim(element ->> 'state'),
    coalesce((element ->> 'is_primary')::boolean, false)
  from jsonb_array_elements(p_locations) as element;

  update public.machines set updated_at = now() where id = p_machine_id;
end;
$$;

-- Only signed-in users may call these functions. Table privileges are set in
-- the RLS migration; functions enforce ownership independently.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.ensure_profile() from public, anon;
revoke all on function public.guard_profile_role() from public, anon, authenticated;
revoke all on function public.set_user_role(public.user_role) from public, anon;
revoke all on function public.search_machines(text, text, text, text, text, integer, integer) from public, anon;
revoke all on function public.create_booking(uuid, date, numeric, text, text, text, text) from public, anon;
revoke all on function public.respond_to_booking(uuid, text, text) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.guard_blackout_conflict() from public, anon, authenticated;
revoke all on function public.set_machine_locations(uuid, jsonb) from public, anon;

grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.set_user_role(public.user_role) to authenticated;
grant execute on function public.search_machines(text, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.create_booking(uuid, date, numeric, text, text, text, text) to authenticated;
grant execute on function public.respond_to_booking(uuid, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.set_machine_locations(uuid, jsonb) to authenticated;
