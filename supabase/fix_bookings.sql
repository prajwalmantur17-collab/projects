-- ==============================================================================
-- Harvest Rentals - booking fix for projects set up with all_in_one_setup.sql
--
-- all_in_one_setup.sql never created the booking functions (create_booking,
-- respond_to_booking, cancel_booking), the notifications table, or the
-- bookings RLS/grants. The app calls rpc('create_booking'), which then fails
-- with PGRST202 and shows "We could not send your request".
--
-- Run this once in Supabase Dashboard > SQL Editor. It is safe to re-run.
-- ==============================================================================

-- 1. Notifications table -------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  kind public.notification_kind not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id)
  where is_read = false;

-- 2. Booking indexes (double-booking protection) -------------------------------
create index if not exists bookings_farmer_created_idx
  on public.bookings (farmer_id, created_at desc);
create index if not exists bookings_owner_created_idx
  on public.bookings (owner_id, created_at desc);
create index if not exists bookings_machine_date_idx
  on public.bookings (machine_id, service_date);
create index if not exists bookings_service_date_idx
  on public.bookings (service_date);

create unique index if not exists bookings_one_confirmed_per_machine_date
  on public.bookings (machine_id, service_date)
  where status = 'confirmed' and completed_at is null;
create unique index if not exists bookings_one_pending_per_farmer_machine_date
  on public.bookings (machine_id, farmer_id, service_date)
  where status = 'pending';

-- 3. updated_at trigger for bookings -------------------------------------------
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

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();

-- 4. Booking functions ----------------------------------------------------------
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

-- Blocks marking a date unavailable when a confirmed booking already exists.
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

drop trigger if exists machine_blackout_dates_guard_conflict on public.machine_blackout_dates;
create trigger machine_blackout_dates_guard_conflict
  before insert on public.machine_blackout_dates
  for each row execute function public.guard_blackout_conflict();

-- 5. Function permissions -------------------------------------------------------
revoke all on function public.create_booking(uuid, date, numeric, text, text, text, text) from public, anon;
revoke all on function public.respond_to_booking(uuid, text, text) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.guard_blackout_conflict() from public, anon, authenticated;

grant execute on function public.create_booking(uuid, date, numeric, text, text, text, text) to authenticated;
grant execute on function public.respond_to_booking(uuid, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- 6. Row level security ---------------------------------------------------------
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;
alter table public.machine_blackout_dates enable row level security;

-- Bookings: readable by the two parties only. Writes go through the functions.
revoke all on table public.bookings from anon, authenticated;
grant select on table public.bookings to authenticated;

drop policy if exists bookings_select_participants on public.bookings;
create policy bookings_select_participants
  on public.bookings for select
  to authenticated
  using (farmer_id = auth.uid() or owner_id = auth.uid());

-- Notifications: users read their own and may mark them as read.
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Blackout dates: visible to signed-in users, managed by the machine owner.
revoke all on table public.machine_blackout_dates from anon, authenticated;
grant select, insert, delete on table public.machine_blackout_dates to authenticated;

drop policy if exists machine_blackout_dates_select_visible on public.machine_blackout_dates;
create policy machine_blackout_dates_select_visible
  on public.machine_blackout_dates for select
  to authenticated
  using (
    exists (
      select 1 from public.machines m
      where m.id = machine_blackout_dates.machine_id
    )
  );

drop policy if exists machine_blackout_dates_insert_owner on public.machine_blackout_dates;
create policy machine_blackout_dates_insert_owner
  on public.machine_blackout_dates for insert
  to authenticated
  with check (
    exists (
      select 1 from public.machines m
      where m.id = machine_blackout_dates.machine_id
        and m.owner_id = auth.uid()
    )
  );

drop policy if exists machine_blackout_dates_delete_owner on public.machine_blackout_dates;
create policy machine_blackout_dates_delete_owner
  on public.machine_blackout_dates for delete
  to authenticated
  using (
    exists (
      select 1 from public.machines m
      where m.id = machine_blackout_dates.machine_id
        and m.owner_id = auth.uid()
    )
  );

-- 7. Realtime (live booking updates and notifications) -------------------------
do $$
begin
  alter publication supabase_realtime add table public.bookings;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- 8. Make the API see the new functions right away ------------------------------
notify pgrst, 'reload schema';
