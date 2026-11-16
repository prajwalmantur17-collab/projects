-- Machines: with / without driver, extra price for the driver, per-trip pricing.
alter table public.machines
  add column if not exists driver_mode text,
  add column if not exists driver_extra numeric;

alter table public.machines
  add constraint machines_driver_mode_check
  check (driver_mode is null or driver_mode in ('with', 'without', 'both'));
alter table public.machines
  add constraint machines_driver_extra_check
  check (driver_extra is null or (driver_extra >= 0 and driver_extra <= 1000000));

alter table public.machines drop constraint machines_pricing_unit_check;
alter table public.machines
  add constraint machines_pricing_unit_check
  check (pricing_unit = any (array['per_acre', 'per_hour', 'per_day', 'per_trip']));

-- Bookings: driver choice, factory destination, who is renting.
alter table public.bookings
  add column if not exists with_driver boolean,
  add column if not exists destination_factory text,
  add column if not exists renter_type text not null default 'farmer';

alter table public.bookings
  add constraint bookings_destination_factory_check
  check (destination_factory is null or char_length(destination_factory) <= 80);
alter table public.bookings
  add constraint bookings_renter_type_check
  check (renter_type in ('farmer', 'factory'));

alter table public.bookings drop constraint bookings_pricing_unit_check;
alter table public.bookings
  add constraint bookings_pricing_unit_check
  check (pricing_unit = any (array['per_acre', 'per_hour', 'per_day', 'per_trip']));

-- Machine cards: expose the new columns (appended at the end).
create or replace view public.machine_cards as
select m.id,
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
    coalesce(p.full_name, 'Machine Owner'::text) as owner_name,
    coalesce(primary_location.village, 'Local'::text) as village,
    coalesce(primary_location.district, 'Local'::text) as district,
    coalesce(primary_location.state, 'India'::text) as state,
    coalesce(service_villages.villages, array[]::text[]) as service_villages,
    m.pricing_unit,
    m.driver_mode,
    m.driver_extra
   from machines m
     left join profiles p on p.id = m.owner_id
     left join lateral ( select ml.village, ml.district, ml.state
           from machine_locations ml
          where ml.machine_id = m.id
          order by ml.is_primary desc, ml.created_at
         limit 1) primary_location on true
     left join lateral ( select array_agg(ml.village order by ml.is_primary desc, ml.village) as villages
           from machine_locations ml
          where ml.machine_id = m.id) service_villages on true
  where m.deleted_at is null and (m.is_active = true or m.owner_id = (select auth.uid() as uid));

-- Search: a machine with no crops listed (tractor, trailer) fits any crop.
create or replace function public.search_machines(p_village text default null::text, p_district text default null::text, p_state text default null::text, p_crop text default null::text, p_machine_type text default null::text, p_limit integer default 48, p_offset integer default 0)
 returns setof machine_cards
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with filters as (
    select
      nullif(btrim(p_village), '') as village,
      nullif(btrim(p_district), '') as district,
      nullif(btrim(p_state), '') as state,
      nullif(btrim(p_crop), '') as crop,
      nullif(btrim(p_machine_type), '') as machine_type
  ),
  target_districts as (
    select f.district as district
    from filters f
    where f.district is not null
    union
    select ml.district
    from filters f
    join public.machine_locations ml on (
      lower(ml.village) = lower(f.village)
      or lower(ml.district) = lower(f.village)
      or lower(ml.village) like '%' || lower(f.village) || '%'
    )
    where f.district is null and f.village is not null
  )
  select mc.*
  from public.machine_cards mc
  cross join filters f
  where mc.is_active = true
    and (f.crop is null or cardinality(mc.crops) = 0 or f.crop = any(mc.crops))
    and (f.machine_type is null or mc.machine_type::text = f.machine_type)
    and (
      (f.village is null and f.district is null and f.state is null)
      or
      (
        f.village is not null
        and (
          lower(mc.village) like '%' || lower(f.village) || '%'
          or exists (
            select 1
            from unnest(mc.service_villages) sv
            where lower(sv) like '%' || lower(f.village) || '%'
          )
        )
      )
      or
      (
        exists (
          select 1
          from target_districts td
          where lower(mc.district) like '%' || lower(td.district) || '%'
             or lower(td.district) like '%' || lower(mc.district) || '%'
        )
      )
      or
      (
        f.village is null and f.district is null and f.state is not null
        and lower(mc.state) like '%' || lower(f.state) || '%'
      )
    )
  order by
    case
      when f.village is not null and lower(mc.village) = lower(f.village) then 0
      when f.village is not null and (
        lower(mc.village) like '%' || lower(f.village) || '%'
        or exists (
          select 1
          from unnest(mc.service_villages) sv
          where lower(sv) like '%' || lower(f.village) || '%'
        )
      ) then 1
      when exists (
        select 1
        from target_districts td
        where lower(mc.district) like '%' || lower(td.district) || '%'
           or lower(td.district) like '%' || lower(mc.district) || '%'
      ) then 2
      else 3
    end asc,
    mc.created_at desc,
    mc.id
  limit least(greatest(coalesce(p_limit, 48), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

-- Booking: replace the 7-argument function (an extra overload would confuse the API).
drop function public.create_booking(uuid, date, numeric, text, text, text, text);

create function public.create_booking(
  p_machine_id uuid,
  p_service_date date,
  p_acreage numeric,
  p_village text,
  p_crop text,
  p_contact_phone text,
  p_notes text default null,
  p_with_driver boolean default null,
  p_destination_factory text default null,
  p_renter_type text default 'farmer'
)
 returns bookings
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_farmer public.profiles;
  v_machine public.machines;
  v_village text;
  v_notes text;
  v_factory text;
  v_renter text;
  v_with_driver boolean;
  v_rate numeric;
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

  v_factory := nullif(btrim(coalesce(p_destination_factory, '')), '');
  if v_factory is not null and char_length(v_factory) > 80 then
    raise exception 'HR_INVALID_INPUT: factory name is too long' using errcode = 'P0001';
  end if;

  v_renter := coalesce(nullif(btrim(coalesce(p_renter_type, '')), ''), 'farmer');
  if v_renter not in ('farmer', 'factory') then
    raise exception 'HR_INVALID_INPUT: invalid renter type' using errcode = 'P0001';
  end if;

  -- A machine with no crops listed (tractor, trailer) works for any crop.
  if p_crop is null
     or (cardinality(v_machine.crops) > 0 and not (p_crop = any (v_machine.crops))) then
    raise exception 'HR_CROP_NOT_SUPPORTED: crop not supported by this machine' using errcode = 'P0001';
  end if;

  -- Driver choice: the owner decides what is offered.
  if v_machine.driver_mode is null then
    v_with_driver := null;
  elsif v_machine.driver_mode = 'with' then
    v_with_driver := true;
  elsif v_machine.driver_mode = 'without' then
    v_with_driver := false;
  else
    v_with_driver := coalesce(p_with_driver, false);
  end if;

  v_rate := v_machine.price_per_acre
    + case
        when v_machine.driver_mode = 'both' and v_with_driver
          then coalesce(v_machine.driver_extra, 0)
        else 0
      end;

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
    crop, contact_phone, notes, price_per_acre, pricing_unit, status,
    with_driver, destination_factory, renter_type
  ) values (
    v_machine.id, v_user_id, v_machine.owner_id, p_service_date, v_village,
    p_acreage, p_crop, p_contact_phone, v_notes, v_rate,
    coalesce(v_machine.pricing_unit, 'per_acre'), 'pending',
    v_with_driver, v_factory, v_renter
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
      'pricing_unit', v_booking.pricing_unit,
      'with_driver', v_booking.with_driver,
      'renter_type', v_booking.renter_type
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
$function$;

revoke all on function public.create_booking(uuid, date, numeric, text, text, text, text, boolean, text, text) from public, anon;
grant execute on function public.create_booking(uuid, date, numeric, text, text, text, text, boolean, text, text) to authenticated;
