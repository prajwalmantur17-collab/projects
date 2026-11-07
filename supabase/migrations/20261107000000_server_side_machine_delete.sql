-- Server-authoritative machine deletion (already applied to the live project as
-- "server_side_machine_delete"). Safe to re-run.
--
-- A machine is "deleted" when deleted_at is set. It is never public, never bookable, never editable.
-- Booking history is always kept.

alter table public.machines add column if not exists deleted_at timestamptz;
grant select (deleted_at) on public.machines to anon, authenticated;

-- Dangerous policy from an older migration: lets any signed-in user delete any machine.
drop policy if exists auth_delete_machines on public.machines;

drop policy if exists public_read_machines on public.machines;
create policy public_read_machines on public.machines
  for select to anon, authenticated
  using (is_active = true and deleted_at is null);

drop policy if exists machines_select_related on public.machines;
create policy machines_select_related on public.machines
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.bookings b
      where b.machine_id = machines.id
        and (b.farmer_id = (select auth.uid()) or b.owner_id = (select auth.uid()))
    )
  );

drop policy if exists machines_update_own on public.machines;
create policy machines_update_own on public.machines
  for update to authenticated
  using (owner_id = (select auth.uid()) and deleted_at is null)
  with check (owner_id = (select auth.uid()) and deleted_at is null);

drop policy if exists machine_locations_select_visible on public.machine_locations;
create policy machine_locations_select_visible on public.machine_locations
  for select to anon, authenticated
  using (exists (
    select 1 from public.machines m
    where m.id = machine_locations.machine_id
      and m.deleted_at is null
      and (m.is_active or m.owner_id = (select auth.uid()))
  ));

create or replace view public.machine_cards as
 SELECT m.id,
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
    COALESCE(p.full_name, 'Machine Owner'::text) AS owner_name,
    COALESCE(primary_location.village, 'Local'::text) AS village,
    COALESCE(primary_location.district, 'Local'::text) AS district,
    COALESCE(primary_location.state, 'India'::text) AS state,
    COALESCE(service_villages.villages, ARRAY[]::text[]) AS service_villages,
    m.pricing_unit
   FROM (((machines m
     LEFT JOIN profiles p ON ((p.id = m.owner_id)))
     LEFT JOIN LATERAL ( SELECT ml.village, ml.district, ml.state
           FROM machine_locations ml
          WHERE (ml.machine_id = m.id)
          ORDER BY ml.is_primary DESC, ml.created_at
         LIMIT 1) primary_location ON (true))
     LEFT JOIN LATERAL ( SELECT array_agg(ml.village ORDER BY ml.is_primary DESC, ml.village) AS villages
           FROM machine_locations ml
          WHERE (ml.machine_id = m.id)) service_villages ON (true))
  WHERE m.deleted_at IS NULL
    AND (m.is_active = true OR m.owner_id = (select auth.uid()));

drop function if exists public.delete_machine(uuid);
drop function if exists public.delete_machine_helper(uuid);

create function public.delete_machine(p_machine_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_image text;
  v_has_bookings boolean;
  v_hard boolean := false;
begin
  if v_uid is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;

  select owner_id, image_path into v_owner, v_image
  from public.machines where id = p_machine_id for update;

  if not found then
    return jsonb_build_object('ok', true, 'hard_deleted', true, 'image_path', null);
  end if;

  if v_owner is distinct from v_uid then
    raise exception 'HR_NOT_OWNER: not your machine' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.bookings
    where machine_id = p_machine_id
      and status = 'confirmed'
      and work_started_at is not null
      and completed_at is null
  ) then
    raise exception 'HR_MACHINE_BUSY: finish the current job before deleting this machine' using errcode = 'P0001';
  end if;

  update public.bookings
  set status = 'cancelled',
      owner_note = coalesce(owner_note, 'Machine listing removed by owner'),
      cancelled_at = now()
  where machine_id = p_machine_id and status = 'pending';

  update public.machines
  set is_active = false,
      is_available = false,
      deleted_at = coalesce(deleted_at, now()),
      updated_at = now()
  where id = p_machine_id;

  delete from public.machine_blackout_dates where machine_id = p_machine_id;
  delete from public.machine_waitlist where machine_id = p_machine_id;

  select exists (select 1 from public.bookings where machine_id = p_machine_id) into v_has_bookings;

  if not v_has_bookings then
    delete from public.machine_locations where machine_id = p_machine_id;
    delete from public.machines where id = p_machine_id;
    v_hard := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'hard_deleted', v_hard,
    'image_path', case when v_hard then v_image else null end
  );
end;
$$;

revoke all on function public.delete_machine(uuid) from public, anon;
grant execute on function public.delete_machine(uuid) to authenticated;

-- create_booking: a deleted, paused or unavailable machine can never receive a booking.
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
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
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
  if v_machine.deleted_at is not null or not v_machine.is_active or not v_machine.is_available then
    raise exception 'HR_MACHINE_INACTIVE: listing is removed or paused' using errcode = 'P0001';
  end if;

  if p_service_date is null then
    raise exception 'HR_INVALID_INPUT: service date is required' using errcode = 'P0001';
  end if;
  if p_service_date < v_today then
    raise exception 'HR_PAST_DATE: service date must be today or later' using errcode = 'P0001';
  end if;
  if p_service_date > v_today + 365 then
    raise exception 'HR_INVALID_INPUT: service date is too far ahead' using errcode = 'P0001';
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
    crop, contact_phone, notes, price_per_acre, pricing_unit, status
  ) values (
    v_machine.id, v_user_id, v_machine.owner_id, p_service_date, v_village,
    p_acreage, p_crop, p_contact_phone, v_notes, v_machine.price_per_acre,
    coalesce(v_machine.pricing_unit, 'per_acre'), 'pending'
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
      'acreage', v_booking.acreage,
      'pricing_unit', v_booking.pricing_unit
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

revoke all on function public.create_booking(uuid, date, numeric, text, text, text, text) from public, anon;
grant execute on function public.create_booking(uuid, date, numeric, text, text, text, text) to authenticated;
