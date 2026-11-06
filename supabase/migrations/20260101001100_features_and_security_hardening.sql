-- 20260101001100_features_and_security_hardening.sql
-- Harvest Rentals: Reconciles all features, security hardening, extended crops,
-- avatars, work status, waitlist, and records into the canonical migration chain.
-- Idempotent and safe to run on fresh or existing databases.

-- 1. EXTEND CROPS & CONSTRAINTS (more_crops.sql) --------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.machines'::regclass, 'public.bookings'::regclass)
      and pg_get_constraintdef(c.oid) like '%pigeon_pea%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.machines
  drop constraint if exists machines_crops_check;
alter table public.machines
  add constraint machines_crops_check check (
    cardinality(crops) > 0
    and crops <@ array[
      'wheat', 'rice', 'maize', 'sugarcane', 'cotton', 'soybean',
      'groundnut', 'millet', 'barley', 'mustard', 'chickpea', 'pigeon_pea',
      'jowar', 'ragi', 'bajra', 'sunflower', 'sesame', 'green_gram',
      'black_gram', 'lentil'
    ]::text[]
  );

alter table public.bookings
  drop constraint if exists bookings_crop_check;
alter table public.bookings
  add constraint bookings_crop_check check (crop in (
    'wheat', 'rice', 'maize', 'sugarcane', 'cotton', 'soybean',
    'groundnut', 'millet', 'barley', 'mustard', 'chickpea', 'pigeon_pea',
    'jowar', 'ragi', 'bajra', 'sunflower', 'sesame', 'green_gram',
    'black_gram', 'lentil'
  ));

-- 2. STRUCTURE: PRICING UNIT & AVAILABILITY (security_hardening.sql) -----------
alter table public.machines
  add column if not exists pricing_unit text not null default 'per_acre';

alter table public.machines drop constraint if exists machines_pricing_unit_check;
alter table public.machines
  add constraint machines_pricing_unit_check
  check (pricing_unit in ('per_acre', 'per_hour', 'per_day'));

alter table public.machines
  add column if not exists is_available boolean not null default true;

alter table public.bookings
  add column if not exists pricing_unit text;

-- 3. AVATARS (avatars.sql) ----------------------------------------------------
alter table public.profiles
  add column if not exists avatar_path text
  check (avatar_path is null or char_length(avatar_path) <= 300);

grant update (avatar_path) on table public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. WORK STATUS, PAYMENT, & WAITLIST (work_status.sql) ------------------------
alter type public.notification_kind add value if not exists 'work_started';
alter type public.notification_kind add value if not exists 'work_completed';
alter type public.notification_kind add value if not exists 'machine_free';

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
      'village', v_booking.village,
      'crop', v_booking.crop,
      'expected_free_at', v_booking.expected_free_at
    )
  );

  return v_booking;
end;
$$;

create or replace function public.complete_work(
  p_booking_id uuid,
  p_amount_paid numeric default null,
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
  v_waiter record;
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
  if v_booking.status <> 'confirmed' then
    raise exception 'HR_INVALID_STATE: only confirmed bookings can be completed' using errcode = 'P0001';
  end if;
  if v_booking.completed_at is not null then
    raise exception 'HR_INVALID_STATE: already completed' using errcode = 'P0001';
  end if;

  if p_payment_method is not null and p_payment_method not in ('upi', 'cash') then
    raise exception 'HR_INVALID_INPUT: payment method must be upi or cash' using errcode = 'P0001';
  end if;
  if p_amount_paid is not null and (p_amount_paid < 0 or p_amount_paid > 100000000) then
    raise exception 'HR_INVALID_INPUT: invalid amount paid' using errcode = 'P0001';
  end if;

  update public.bookings
  set
    work_started_at = coalesce(work_started_at, now()),
    completed_at = now(),
    expected_free_at = null,
    payment_method = p_payment_method,
    amount_paid = p_amount_paid,
    paid_at = case when p_payment_method is not null then now() else null end
  where id = v_booking.id
  returning * into v_booking;

  insert into public.notifications (user_id, booking_id, kind, payload)
  values (
    v_booking.farmer_id,
    v_booking.id,
    'work_completed',
    jsonb_build_object(
      'service_date', v_booking.service_date,
      'village', v_booking.village,
      'crop', v_booking.crop,
      'amount_paid', v_booking.amount_paid,
      'payment_method', v_booking.payment_method
    )
  );

  for v_waiter in
    delete from public.machine_waitlist
    where machine_id = v_booking.machine_id and expires_at > now()
    returning farmer_id
  loop
    insert into public.notifications (user_id, booking_id, kind, payload)
    values (
      v_waiter.farmer_id,
      v_booking.id,
      'machine_free',
      jsonb_build_object(
        'machine_id', v_booking.machine_id,
        'village', v_booking.village
      )
    );
  end loop;

  return v_booking;
end;
$$;

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

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'HR_NOT_FOUND: booking not found' using errcode = 'P0001';
  end if;
  if v_booking.owner_id <> v_user_id then
    raise exception 'HR_NOT_OWNER: not your booking' using errcode = 'P0001';
  end if;
  if p_payment_method not in ('upi', 'cash') then
    raise exception 'HR_INVALID_INPUT: payment method must be upi or cash' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 100000000 then
    raise exception 'HR_INVALID_INPUT: invalid amount' using errcode = 'P0001';
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

grant execute on function public.start_work(uuid, timestamptz) to authenticated;
grant execute on function public.complete_work(uuid, numeric, text) to authenticated;
grant execute on function public.record_payment(uuid, numeric, text) to authenticated;
grant execute on function public.join_waitlist(uuid) to authenticated;
grant execute on function public.leave_waitlist(uuid) to authenticated;
grant execute on function public.get_machine_status(uuid) to anon, authenticated;
grant execute on function public.busy_machine_ids() to anon, authenticated;

-- 5. "MY RECORD" METRICS (record.sql) -------------------------------------------
alter table public.bookings
  add column if not exists hours_worked numeric(6, 2) check (hours_worked is null or (hours_worked >= 0 and hours_worked <= 1000));

alter table public.profiles
  add column if not exists record_reset_at timestamptz;

create or replace function public.set_work_hours(
  p_booking_id uuid,
  p_hours numeric
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings;
begin
  if auth.uid() is null then
    raise exception 'HR_UNAUTHORIZED';
  end if;

  if p_hours is null or p_hours < 0 or p_hours > 1000 then
    raise exception 'HR_INVALID_INPUT';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception 'HR_NOT_FOUND';
  end if;

  if v_booking.owner_id <> auth.uid() then
    raise exception 'HR_NOT_OWNER';
  end if;

  if v_booking.completed_at is null then
    raise exception 'HR_INVALID_STATE';
  end if;

  update public.bookings
  set hours_worked = round(p_hours, 2),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

create or replace function public.reset_my_record()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'HR_UNAUTHORIZED';
  end if;

  update public.profiles
  set record_reset_at = v_now,
      updated_at = v_now
  where id = auth.uid();

  return v_now;
end;
$$;

create or replace function public.restore_my_record()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'HR_UNAUTHORIZED';
  end if;

  update public.profiles
  set record_reset_at = null,
      updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.get_my_record(
  p_year int default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_role text;
  v_reset_at timestamptz;
  v_years jsonb;
  v_total_jobs int := 0;
  v_total_acres numeric := 0;
  v_total_amount numeric := 0;
  v_unpaid_jobs int := 0;
  v_total_hours numeric := null;
  v_villages int := null;
  v_by_crop jsonb := null;
  v_items jsonb := '[]'::jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'HR_UNAUTHORIZED';
  end if;

  select coalesce(role::text, 'farmer'), record_reset_at
  into v_role, v_reset_at
  from public.profiles
  where id = v_user_id;

  if v_role is null then
    v_role := 'farmer';
  end if;

  select coalesce(jsonb_agg(y), '[]'::jsonb)
  into v_years
  from (
    select distinct extract(year from service_date)::int as y
    from public.bookings
    where (case when v_role = 'owner' then owner_id = v_user_id else farmer_id = v_user_id end)
      and status = 'confirmed'
      and completed_at is not null
      and (v_reset_at is null or completed_at >= v_reset_at)
    order by y desc
  ) y_sub;

  select
    count(*)::int,
    coalesce(sum(acreage), 0)::numeric,
    coalesce(sum(amount_paid) filter (where payment_method is not null), 0)::numeric,
    count(*) filter (where payment_method is null or amount_paid is null)::int,
    case
      when v_role = 'owner' then
        coalesce(sum(coalesce(hours_worked, extract(epoch from (completed_at - work_started_at))/3600)), 0)::numeric
      else null
    end,
    case
      when v_role = 'owner' then
        count(distinct village)::int
      else null
    end
  into
    v_total_jobs,
    v_total_acres,
    v_total_amount,
    v_unpaid_jobs,
    v_total_hours,
    v_villages
  from public.bookings
  where (case when v_role = 'owner' then owner_id = v_user_id else farmer_id = v_user_id end)
    and status = 'confirmed'
    and completed_at is not null
    and (v_reset_at is null or completed_at >= v_reset_at)
    and (p_year is null or extract(year from service_date) = p_year);

  if v_total_hours is not null then
    v_total_hours := round(v_total_hours, 1);
  end if;
  v_total_acres := round(v_total_acres, 2);
  v_total_amount := round(v_total_amount, 2);

  if v_role = 'farmer' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'crop', crop,
        'acres', round(crop_acres, 2),
        'amount', round(crop_amount, 2)
      ) order by crop_acres desc
    ), '[]'::jsonb)
    into v_by_crop
    from (
      select
        crop,
        coalesce(sum(acreage), 0)::numeric as crop_acres,
        coalesce(sum(amount_paid) filter (where payment_method is not null), 0)::numeric as crop_amount
      from public.bookings
      where farmer_id = v_user_id
        and status = 'confirmed'
        and completed_at is not null
        and (v_reset_at is null or completed_at >= v_reset_at)
        and (p_year is null or extract(year from service_date) = p_year)
      group by crop
    ) c_sub;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'service_date', b.service_date,
      'village', b.village,
      'acreage', b.acreage,
      'crop', b.crop,
      'amount_paid', b.amount_paid,
      'payment_method', b.payment_method,
      'hours', case
        when b.hours_worked is not null then b.hours_worked
        when b.work_started_at is not null and b.completed_at is not null then
          round((extract(epoch from (b.completed_at - b.work_started_at))/3600)::numeric, 1)
        else null
      end,
      'machine_type', coalesce(m.machine_type::text, 'combine_harvester'),
      'other_party_name', coalesce(case when v_role = 'owner' then fp.full_name else op.full_name end, 'Farmer')
    ) order by b.service_date desc, b.completed_at desc
  ), '[]'::jsonb)
  into v_items
  from (
    select b_inner.*
    from public.bookings b_inner
    where (case when v_role = 'owner' then b_inner.owner_id = v_user_id else b_inner.farmer_id = v_user_id end)
      and b_inner.status = 'confirmed'
      and b_inner.completed_at is not null
      and (v_reset_at is null or b_inner.completed_at >= v_reset_at)
      and (p_year is null or extract(year from b_inner.service_date) = p_year)
    order by b_inner.service_date desc, b_inner.completed_at desc
    limit 200
  ) b
  left join public.machines m on m.id = b.machine_id
  left join public.profiles fp on fp.id = b.farmer_id
  left join public.profiles op on op.id = b.owner_id;

  return jsonb_build_object(
    'role', v_role,
    'jobs', v_total_jobs,
    'acres', v_total_acres,
    'amount', v_total_amount,
    'unpaid_jobs', v_unpaid_jobs,
    'hours', v_total_hours,
    'villages', v_villages,
    'by_crop', v_by_crop,
    'years', v_years,
    'items', v_items,
    'reset_at', v_reset_at
  );
end;
$$;

grant execute on function public.set_work_hours(uuid, numeric) to authenticated;
grant execute on function public.reset_my_record() to authenticated;
grant execute on function public.restore_my_record() to authenticated;
grant execute on function public.get_my_record(int) to authenticated;

-- 6. SECURITY HARDENING FOR MACHINE CARDS VIEW & FUNCTIONS ----------------------
create or replace view public.machine_cards as
select
  m.id,
  m.owner_id,
  m.machine_type,
  m.model,
  m.price_per_acre,
  coalesce(m.pricing_unit, 'per_acre') as pricing_unit,
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
  coalesce(service_villages.villages, array[]::text[]) as service_villages
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
) service_villages on true;

-- Grant guest read on machine_cards, machines, locations
grant select on public.machine_cards to anon, authenticated;
grant select on public.machines to anon, authenticated;
grant select on public.machine_locations to anon, authenticated;

-- Hardened set_machine_locations with ownership & length validation
create or replace function public.set_machine_locations(p_machine_id uuid, p_locations jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loc jsonb;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'HR_UNAUTHORIZED: sign in required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.machines m where m.id = p_machine_id and m.owner_id = v_uid) then
    raise exception 'HR_FORBIDDEN: not your machine' using errcode = 'P0001';
  end if;
  if p_locations is null or jsonb_typeof(p_locations) <> 'array' or jsonb_array_length(p_locations) > 50 then
    raise exception 'HR_INVALID: locations must be an array of at most 50' using errcode = 'P0001';
  end if;

  delete from public.machine_locations where machine_id = p_machine_id;
  for v_loc in select * from jsonb_array_elements(p_locations) loop
    insert into public.machine_locations (machine_id, village, district, state, is_primary)
    values (
      p_machine_id,
      btrim(v_loc->>'village'),
      btrim(v_loc->>'district'),
      btrim(v_loc->>'state'),
      coalesce((v_loc->>'is_primary')::boolean, false)
    );
  end loop;
end;
$$;

grant execute on function public.set_machine_locations(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

