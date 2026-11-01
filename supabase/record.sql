-- Harvest Rentals: "My record" page (earnings, spending, acres, hours, by-crop breakdown)
-- Safe to run repeatedly in the Supabase SQL editor.

-- 1. Hours worked column on bookings -------------------------------------------
alter table public.bookings
  add column if not exists hours_worked numeric(6, 2) check (hours_worked is null or (hours_worked >= 0 and hours_worked <= 1000));

-- 2. set_work_hours -----------------------------------------------------------
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

-- 3. get_my_record ------------------------------------------------------------
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

  select coalesce(role::text, 'farmer') into v_role
  from public.profiles
  where id = v_user_id;

  if v_role is null then
    v_role := 'farmer';
  end if;

  -- Years with completed jobs for this user (unfiltered by p_year so dropdown has all choices)
  select coalesce(jsonb_agg(y), '[]'::jsonb)
  into v_years
  from (
    select distinct extract(year from service_date)::int as y
    from public.bookings
    where (case when v_role = 'owner' then owner_id = v_user_id else farmer_id = v_user_id end)
      and status = 'confirmed'
      and completed_at is not null
    order by y desc
  ) y_sub;

  -- Summary metrics
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
    and (p_year is null or extract(year from service_date) = p_year);

  if v_total_hours is not null then
    v_total_hours := round(v_total_hours, 1);
  end if;
  v_total_acres := round(v_total_acres, 2);
  v_total_amount := round(v_total_amount, 2);

  -- Farmer by_crop breakdown
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
        and (p_year is null or extract(year from service_date) = p_year)
      group by crop
    ) c_sub;
  end if;

  -- Latest 200 completed jobs
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
    'items', v_items
  );
end;
$$;

revoke all on function public.set_work_hours(uuid, numeric) from public, anon;
grant execute on function public.set_work_hours(uuid, numeric) to authenticated;

revoke all on function public.get_my_record(int) from public, anon;
grant execute on function public.get_my_record(int) to authenticated;

notify pgrst, 'reload schema';
