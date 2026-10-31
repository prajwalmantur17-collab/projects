-- Two-way live tracking: BOTH the machine owner and the farmer share their
-- position for a confirmed booking, so each can see the other on the map.
-- Run this after 20260101000500_live_tracking.sql.

-- One row per (booking, role) instead of one row per booking.
alter table public.booking_live_locations
  add column if not exists role text not null default 'owner'
  check (role in ('owner', 'farmer'));

alter table public.booking_live_locations
  drop constraint if exists booking_live_locations_pkey;

alter table public.booking_live_locations
  add primary key (booking_id, role);

-- The caller's role on the booking is decided by the server, never the client.
drop function if exists public.share_live_location(uuid, double precision, double precision, double precision);

create or replace function public.share_live_location(
  p_booking_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_heading double precision default null
)
returns public.booking_live_locations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_role text;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_row public.booking_live_locations;
begin
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'HR_NOT_FOUND: booking not found' using errcode = 'P0001';
  end if;

  if v_booking.owner_id = v_user_id then
    v_role := 'owner';
  elsif v_booking.farmer_id = v_user_id then
    v_role := 'farmer';
  else
    raise exception 'HR_NOT_OWNER: not your booking' using errcode = 'P0001';
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception 'HR_INVALID_STATE: booking is not confirmed' using errcode = 'P0001';
  end if;

  -- Sharing is allowed from the day before the service date until the day after,
  -- so nobody's location is shared days ahead of the job.
  if v_booking.service_date < v_today - 1 or v_booking.service_date > v_today + 1 then
    raise exception 'HR_OUT_OF_WINDOW: live location is available around the service date'
      using errcode = 'P0001';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    raise exception 'HR_INVALID_INPUT: invalid coordinates' using errcode = 'P0001';
  end if;

  insert into public.booking_live_locations (
    booking_id, role, owner_id, farmer_id, latitude, longitude, heading, updated_at
  ) values (
    v_booking.id,
    v_role,
    v_booking.owner_id,
    v_booking.farmer_id,
    p_latitude,
    p_longitude,
    case when p_heading between 0 and 360 then p_heading else null end,
    now()
  )
  on conflict (booking_id, role) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        heading = excluded.heading,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.stop_live_location(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;

  delete from public.booking_live_locations
  where booking_id = p_booking_id
    and (
      (role = 'owner' and owner_id = v_user_id)
      or (role = 'farmer' and farmer_id = v_user_id)
    );
end;
$$;

revoke all on function public.share_live_location(uuid, double precision, double precision, double precision) from public, anon;
revoke all on function public.stop_live_location(uuid) from public, anon;
grant execute on function public.share_live_location(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function public.stop_live_location(uuid) to authenticated;

notify pgrst, 'reload schema';
