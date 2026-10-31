-- Live machine tracking (Uber-style) for confirmed bookings.
-- The machine owner opts in by pressing "Share live location" on a confirmed
-- booking. The farmer on that booking can then watch the position in realtime.
-- Clients never write the table directly: they call the RPCs below.

create table public.booking_live_locations (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  heading double precision check (heading is null or heading between 0 and 360),
  updated_at timestamptz not null default now()
);

alter table public.booking_live_locations enable row level security;
alter table public.booking_live_locations replica identity full;

revoke all on table public.booking_live_locations from anon, authenticated;
grant select on table public.booking_live_locations to authenticated;

-- Only the owner and the farmer of the booking can see the position.
create policy booking_live_locations_select_participants
  on public.booking_live_locations for select
  to authenticated
  using (owner_id = auth.uid() or farmer_id = auth.uid());

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
  v_row public.booking_live_locations;
begin
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'HR_NOT_FOUND: booking not found' using errcode = 'P0001';
  end if;
  if v_booking.owner_id <> v_user_id then
    raise exception 'HR_NOT_OWNER: not your booking' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'HR_INVALID_STATE: booking is not confirmed' using errcode = 'P0001';
  end if;

  -- Sharing is only allowed on the service day. For demos, relax this check
  -- (for example to `<= current date + 1`) or book a service for today.
  if v_booking.service_date <> (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'HR_NOT_TODAY: live location can be shared on the service date only'
      using errcode = 'P0001';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    raise exception 'HR_INVALID_INPUT: invalid coordinates' using errcode = 'P0001';
  end if;

  insert into public.booking_live_locations (
    booking_id, owner_id, farmer_id, latitude, longitude, heading, updated_at
  ) values (
    v_booking.id,
    v_booking.owner_id,
    v_booking.farmer_id,
    p_latitude,
    p_longitude,
    case when p_heading between 0 and 360 then p_heading else null end,
    now()
  )
  on conflict (booking_id) do update
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
    and owner_id = v_user_id;
end;
$$;

-- If a booking is cancelled (or otherwise leaves "confirmed"), stop sharing.
create or replace function public.clear_live_location_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'confirmed' then
    delete from public.booking_live_locations where booking_id = new.id;
  end if;
  return new;
end;
$$;

create trigger bookings_clear_live_location
  after update of status on public.bookings
  for each row execute function public.clear_live_location_on_status_change();

revoke all on function public.share_live_location(uuid, double precision, double precision, double precision) from public, anon;
revoke all on function public.stop_live_location(uuid) from public, anon;
revoke all on function public.clear_live_location_on_status_change() from public, anon, authenticated;

grant execute on function public.share_live_location(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function public.stop_live_location(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'booking_live_locations'
  ) then
    alter publication supabase_realtime add table public.booking_live_locations;
  end if;
end;
$$;
