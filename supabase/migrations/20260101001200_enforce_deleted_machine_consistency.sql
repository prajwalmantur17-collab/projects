-- 20260101001200_enforce_deleted_machine_consistency.sql
-- Harvest Rentals: Bulletproof machine deletion and booking consistency.
-- 1. Updates machine_cards view to strictly filter is_active = true for public browsing.
-- 2. Hardens delete_machine RPC: validates owner, cancels pending bookings, cleans locations, blackout dates, waitlists,
--    deactivates (is_active = false, is_available = false), and hard-deletes if no bookings exist.
-- 3. Hardens create_booking RPC: ensures machine exists, is_active is true, and is_available is true.
-- 4. Enables Realtime publication on public.machines so deletions and updates broadcast cross-device.

-- 1. Hardened machine_cards view
create or replace view public.machine_cards as
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
  m.is_available,
  m.created_at,
  m.updated_at,
  coalesce(p.full_name, 'Machine Owner') as owner_name,
  coalesce(primary_location.village, 'Local') as village,
  coalesce(primary_location.district, 'Local') as district,
  coalesce(primary_location.state, 'India') as state,
  coalesce(service_villages.villages, array[]::text[]) as service_villages,
  coalesce(m.pricing_unit, 'per_acre') as pricing_unit
from public.machines m
left join public.profiles p on p.id = m.owner_id
left join lateral (
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
) service_villages on true
where m.is_active = true;

comment on view public.machine_cards is
  'Public active machine directory. Automatically excludes deleted/inactive machines. Read-only.';

grant select on public.machine_cards to anon, authenticated;

-- 2. Hardened delete_machine RPC function
create or replace function public.delete_machine(p_machine_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_has_bookings boolean;
begin
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;

  select owner_id into v_owner_id
  from public.machines
  where id = p_machine_id;

  if v_owner_id is null then
    -- Already deleted from database
    return true;
  end if;

  if v_owner_id <> v_user_id then
    raise exception 'HR_NOT_OWNER: not your machine' using errcode = 'P0001';
  end if;

  -- 1. Cancel pending bookings and notify farmers
  update public.bookings
  set status = 'cancelled',
      owner_note = coalesce(owner_note, 'Machine listing removed by owner'),
      cancelled_at = now()
  where machine_id = p_machine_id
    and status = 'pending';

  -- 2. Deactivate the machine immediately (is_active = false, is_available = false)
  update public.machines
  set is_active = false,
      is_available = false,
      updated_at = now()
  where id = p_machine_id;

  -- 3. Delete blackout dates
  delete from public.machine_blackout_dates
  where machine_id = p_machine_id;

  -- 4. Delete service locations so it never appears in search_machines
  delete from public.machine_locations
  where machine_id = p_machine_id;

  -- 5. Clean up waitlist if any
  delete from public.machine_waitlist
  where machine_id = p_machine_id;

  -- 6. If no historical bookings reference it, permanently hard delete the machine row
  select exists (
    select 1 from public.bookings where machine_id = p_machine_id
  ) into v_has_bookings;

  if not v_has_bookings then
    delete from public.machines where id = p_machine_id;
  end if;

  return true;
end;
$$;

grant execute on function public.delete_machine(uuid) to authenticated;

-- 3. Hardened create_booking RPC (blocks any inactive, deleted, or unavailable machine)
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
  if not v_machine.is_active or not v_machine.is_available then
    raise exception 'HR_MACHINE_INACTIVE: listing is removed or paused' using errcode = 'P0001';
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

  -- Only block if an active (uncompleted) confirmed booking exists on that date
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

grant execute on function public.create_booking(uuid, date, numeric, text, text, text, text) to authenticated;

-- 4. Enable Realtime on machines table
alter table public.machines replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'machines'
  ) then
    alter publication supabase_realtime add table public.machines;
  end if;
end;
$$;

notify pgrst, 'reload schema';
