-- Harvest Rentals: work status, payment record and "notify me when free" waiting list.
-- Run this ONCE in the Supabase SQL editor, after fix_bookings.sql. Safe to run again.
--
-- How a booking moves now:
--   pending -> confirmed (owner accepts) -> working (owner taps Start work)
--   -> completed (owner taps Job completed, optional UPI/cash record)
-- The status column does not change. "Working" and "completed" are read from the
-- new timestamp columns, so nothing about the existing booking rules is touched.

-- 1. New notification kinds ----------------------------------------------------
alter type public.notification_kind add value if not exists 'work_started';
alter type public.notification_kind add value if not exists 'work_completed';
alter type public.notification_kind add value if not exists 'machine_free';

-- 2. Booking columns -----------------------------------------------------------
alter table public.bookings
  add column if not exists work_started_at timestamptz,
  add column if not exists expected_free_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists amount_paid numeric(12, 2),
  add column if not exists paid_at timestamptz;

alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method is null or payment_method in ('upi', 'cash'));

alter table public.bookings drop constraint if exists bookings_amount_paid_check;
alter table public.bookings
  add constraint bookings_amount_paid_check
  check (amount_paid is null or amount_paid between 0 and 100000000);

create index if not exists bookings_machine_working_idx
  on public.bookings (machine_id)
  where status = 'confirmed' and work_started_at is not null and completed_at is null;

-- 3. Waiting list --------------------------------------------------------------
create table if not exists public.machine_waitlist (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique (machine_id, farmer_id)
);

create index if not exists machine_waitlist_machine_idx on public.machine_waitlist (machine_id);

alter table public.machine_waitlist enable row level security;
revoke all on table public.machine_waitlist from anon, authenticated;
grant select on table public.machine_waitlist to authenticated;

drop policy if exists machine_waitlist_select_own on public.machine_waitlist;
create policy machine_waitlist_select_own
  on public.machine_waitlist for select
  to authenticated
  using (farmer_id = auth.uid());

-- 4. Owner: start work ---------------------------------------------------------
create or replace function public.start_work(
  p_booking_id uuid,
  p_expected_free_at timestamptz default null
)
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
  if v_booking.owner_id <> v_user_id then
    raise exception 'HR_NOT_OWNER: not your booking' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'confirmed' or v_booking.completed_at is not null then
    raise exception 'HR_INVALID_STATE: booking is not accepted or already finished' using errcode = 'P0001';
  end if;
  if v_booking.work_started_at is not null then
    raise exception 'HR_INVALID_STATE: work already started' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.bookings b
    where b.machine_id = v_booking.machine_id
      and b.id <> v_booking.id
      and b.status = 'confirmed'
      and b.work_started_at is not null
      and b.completed_at is null
  ) then
    raise exception 'HR_MACHINE_BUSY: this machine is already working on another job' using errcode = 'P0001';
  end if;
  if p_expected_free_at is not null and p_expected_free_at < now() - interval '1 hour' then
    raise exception 'HR_INVALID_INPUT: expected time is in the past' using errcode = 'P0001';
  end if;

  update public.bookings
  set work_started_at = now(), expected_free_at = p_expected_free_at
  where id = v_booking.id
  returning * into v_booking;

  insert into public.notifications (user_id, booking_id, kind, payload)
  values (
    v_booking.farmer_id,
    v_booking.id,
    'work_started',
    jsonb_build_object(
      'service_date', v_booking.service_date,
      'machine_type', (select machine_type from public.machines where id = v_booking.machine_id)
    )
  );

  return v_booking;
end;
$$;

-- 5. Owner: job completed (+ optional payment record) --------------------------
create or replace function public.complete_work(
  p_booking_id uuid,
  p_amount numeric default null,
  p_payment_method text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_machine_type public.machine_type;
  v_method text := nullif(btrim(coalesce(p_payment_method, '')), '');
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
  if v_booking.status <> 'confirmed' or v_booking.completed_at is not null then
    raise exception 'HR_INVALID_STATE: booking is not accepted or already finished' using errcode = 'P0001';
  end if;
  if v_method is not null and v_method not in ('upi', 'cash') then
    raise exception 'HR_INVALID_INPUT: payment method must be upi or cash' using errcode = 'P0001';
  end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 100000000) then
    raise exception 'HR_INVALID_INPUT: amount is not valid' using errcode = 'P0001';
  end if;

  update public.bookings
  set
    work_started_at = coalesce(work_started_at, now()),
    completed_at = now(),
    payment_method = v_method,
    amount_paid = case when v_method is not null then p_amount else null end,
    paid_at = case when v_method is not null then now() else null end
  where id = v_booking.id
  returning * into v_booking;

  select machine_type into v_machine_type from public.machines where id = v_booking.machine_id;

  insert into public.notifications (user_id, booking_id, kind, payload)
  values (
    v_booking.farmer_id,
    v_booking.id,
    'work_completed',
    jsonb_build_object(
      'service_date', v_booking.service_date,
      'machine_type', v_machine_type,
      'amount', v_booking.amount_paid,
      'payment_method', v_booking.payment_method
    )
  );

  -- Tell everyone waiting for this machine that it is free again.
  insert into public.notifications (user_id, booking_id, kind, payload)
  select
    w.farmer_id,
    null,
    'machine_free',
    jsonb_build_object('machine_id', v_booking.machine_id, 'machine_type', v_machine_type)
  from public.machine_waitlist w
  where w.machine_id = v_booking.machine_id
    and w.expires_at > now()
    and w.farmer_id <> v_booking.farmer_id;

  delete from public.machine_waitlist where machine_id = v_booking.machine_id;

  return v_booking;
end;
$$;

-- 6. Owner: record payment later ----------------------------------------------
create or replace function public.record_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_payment_method text
)
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
  if p_payment_method is null or p_payment_method not in ('upi', 'cash') then
    raise exception 'HR_INVALID_INPUT: payment method must be upi or cash' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 100000000 then
    raise exception 'HR_INVALID_INPUT: amount is not valid' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'HR_NOT_FOUND: booking not found' using errcode = 'P0001';
  end if;
  if v_booking.owner_id <> v_user_id then
    raise exception 'HR_NOT_OWNER: not your booking' using errcode = 'P0001';
  end if;
  if v_booking.completed_at is null then
    raise exception 'HR_INVALID_STATE: finish the job first' using errcode = 'P0001';
  end if;

  update public.bookings
  set payment_method = p_payment_method, amount_paid = p_amount, paid_at = now()
  where id = v_booking.id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- 7. Farmer: waiting list ------------------------------------------------------
create or replace function public.join_waitlist(p_machine_id uuid)
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
  if not exists (select 1 from public.profiles where id = v_user_id and role = 'farmer') then
    raise exception 'HR_NOT_FARMER: only farmers can wait for a machine' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.bookings b
    where b.machine_id = p_machine_id
      and b.status = 'confirmed'
      and b.work_started_at is not null
      and b.completed_at is null
  ) then
    raise exception 'HR_NOT_BUSY: this machine is free right now, you can book it' using errcode = 'P0001';
  end if;

  insert into public.machine_waitlist (machine_id, farmer_id)
  values (p_machine_id, v_user_id)
  on conflict (machine_id, farmer_id)
  do update set expires_at = now() + interval '7 days';
end;
$$;

create or replace function public.leave_waitlist(p_machine_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  delete from public.machine_waitlist
  where machine_id = p_machine_id and farmer_id = auth.uid();
end;
$$;

-- 8. Read helpers (no private data: only busy flag, dates, own waiting state) --
create or replace function public.get_machine_status(p_machine_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'busy', exists (
      select 1 from public.bookings b
      where b.machine_id = p_machine_id
        and b.status = 'confirmed'
        and b.work_started_at is not null
        and b.completed_at is null
    ),
    'expected_free_at', (
      select b.expected_free_at from public.bookings b
      where b.machine_id = p_machine_id
        and b.status = 'confirmed'
        and b.work_started_at is not null
        and b.completed_at is null
      order by b.work_started_at desc
      limit 1
    ),
    'booked_dates', coalesce((
      select jsonb_agg(d order by d)
      from (
        select distinct b.service_date as d
        from public.bookings b
        where b.machine_id = p_machine_id
          and b.status = 'confirmed'
          and b.completed_at is null
          and b.service_date >= (now() at time zone 'Asia/Kolkata')::date
      ) x
    ), '[]'::jsonb),
    'on_waitlist', exists (
      select 1 from public.machine_waitlist w
      where w.machine_id = p_machine_id
        and w.farmer_id = auth.uid()
        and w.expires_at > now()
    )
  );
$$;

create or replace function public.busy_machine_ids()
returns table (machine_id uuid, expected_free_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.machine_id, max(b.expected_free_at)
  from public.bookings b
  where b.status = 'confirmed'
    and b.work_started_at is not null
    and b.completed_at is null
  group by b.machine_id;
$$;

-- 9. Permissions ---------------------------------------------------------------
revoke all on function public.start_work(uuid, timestamptz) from public, anon;
revoke all on function public.complete_work(uuid, numeric, text) from public, anon;
revoke all on function public.record_payment(uuid, numeric, text) from public, anon;
revoke all on function public.join_waitlist(uuid) from public, anon;
revoke all on function public.leave_waitlist(uuid) from public, anon;
revoke all on function public.get_machine_status(uuid) from public;
revoke all on function public.busy_machine_ids() from public;

grant execute on function public.start_work(uuid, timestamptz) to authenticated;
grant execute on function public.complete_work(uuid, numeric, text) to authenticated;
grant execute on function public.record_payment(uuid, numeric, text) to authenticated;
grant execute on function public.join_waitlist(uuid) to authenticated;
grant execute on function public.leave_waitlist(uuid) to authenticated;
grant execute on function public.get_machine_status(uuid) to anon, authenticated;
grant execute on function public.busy_machine_ids() to anon, authenticated;

notify pgrst, 'reload schema';
