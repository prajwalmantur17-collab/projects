-- =====================================================================
-- Harvest Rentals - security hardening + structure fixes (idempotent)
-- Principles: least privilege, defence in depth, no trust in the client.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. STRUCTURE: pricing unit (per acre / hour / day) was never stored
-- ---------------------------------------------------------------
alter table public.machines
  add column if not exists pricing_unit text not null default 'per_acre';

alter table public.machines drop constraint if exists machines_pricing_unit_check;
alter table public.machines
  add constraint machines_pricing_unit_check
  check (pricing_unit in ('per_acre', 'per_hour', 'per_day'));

-- Allowed crop values enforced in the database, not only in the app.
alter table public.machines drop constraint if exists machines_crops_check;
alter table public.machines
  add constraint machines_crops_check
  check (crops <@ array['wheat','rice','maize','sugarcane','cotton','soybean','groundnut',
    'millet','barley','mustard','chickpea','pigeon_pea','jowar','ragi','bajra','sunflower',
    'sesame','green_gram','black_gram','lentil']::text[]);

alter table public.bookings drop constraint if exists bookings_crop_check;
alter table public.bookings
  add constraint bookings_crop_check
  check (crop in ('wheat','rice','maize','sugarcane','cotton','soybean','groundnut',
    'millet','barley','mustard','chickpea','pigeon_pea','jowar','ragi','bajra','sunflower',
    'sesame','green_gram','black_gram','lentil'));

-- Public directory view (intentionally SECURITY DEFINER: it exposes only
-- non-sensitive columns and owner display name). pricing_unit added last.
create or replace view public.machine_cards as
 select m.id, m.owner_id, m.machine_type, m.model, m.price_per_acre, m.crops, m.phone,
        m.latitude, m.longitude, m.image_path, m.is_active, m.is_available,
        m.created_at, m.updated_at,
        coalesce(p.full_name, 'Machine Owner'::text) as owner_name,
        coalesce(primary_location.village, 'Local'::text) as village,
        coalesce(primary_location.district, 'Local'::text) as district,
        coalesce(primary_location.state, 'India'::text) as state,
        coalesce(service_villages.villages, array[]::text[]) as service_villages,
        m.pricing_unit
   from public.machines m
   left join public.profiles p on p.id = m.owner_id
   left join lateral (
        select ml.village, ml.district, ml.state
          from public.machine_locations ml
         where ml.machine_id = m.id
         order by ml.is_primary desc, ml.created_at
         limit 1) primary_location on true
   left join lateral (
        select array_agg(ml.village order by ml.is_primary desc, ml.village) as villages
          from public.machine_locations ml
         where ml.machine_id = m.id) service_villages on true;

comment on view public.machine_cards is
  'Public machine directory. SECURITY DEFINER on purpose (reads owner display name). Read-only.';

-- ---------------------------------------------------------------
-- 2. FUNCTIONS: ownership check + least-privilege EXECUTE
-- ---------------------------------------------------------------
create or replace function public.set_machine_locations(p_machine_id uuid, p_locations jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
$function$;

-- Cap page size so one call cannot dump the whole table.
create or replace function public.search_machines(
  p_village text default null, p_district text default null, p_state text default null,
  p_crop text default null, p_machine_type text default null,
  p_limit integer default 48, p_offset integer default 0)
returns setof public.machine_cards
language sql
stable security definer
set search_path = public, pg_temp
as $function$
  select mc.*
  from public.machine_cards mc
  where mc.is_active = true
    and (p_crop is null or p_crop = '' or p_crop = any(mc.crops))
    and (p_machine_type is null or p_machine_type = '' or mc.machine_type::text = p_machine_type)
    and (p_village is null or p_village = ''
         or lower(mc.village) like '%' || lower(trim(p_village)) || '%'
         or exists (select 1 from unnest(mc.service_villages) sv
                    where lower(sv) like '%' || lower(trim(p_village)) || '%'))
    and (p_district is null or p_district = ''
         or lower(mc.district) like '%' || lower(trim(p_district)) || '%')
  order by mc.created_at desc
  limit least(greatest(coalesce(p_limit, 48), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

-- Start from zero, then grant only what each role needs.
revoke execute on all functions in schema public from public, anon, authenticated;

-- Public (not signed in) browsing
grant execute on function public.search_machines(text, text, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.busy_machine_ids() to anon, authenticated;
grant execute on function public.get_machine_status(uuid) to anon, authenticated;

-- Signed-in only
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.complete_work(uuid, numeric, text) to authenticated;
grant execute on function public.create_booking(uuid, date, numeric, text, text, text, text) to authenticated;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.get_my_record(integer) to authenticated;
grant execute on function public.join_waitlist(uuid) to authenticated;
grant execute on function public.leave_waitlist(uuid) to authenticated;
grant execute on function public.record_payment(uuid, numeric, text) to authenticated;
grant execute on function public.reset_my_record() to authenticated;
grant execute on function public.respond_to_booking(uuid, text, text) to authenticated;
grant execute on function public.restore_my_record() to authenticated;
grant execute on function public.set_machine_locations(uuid, jsonb) to authenticated;
grant execute on function public.set_user_role(public.user_role) to authenticated;
grant execute on function public.set_work_hours(uuid, numeric) to authenticated;
grant execute on function public.share_live_location(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function public.start_work(uuid, timestamptz) to authenticated;
grant execute on function public.stop_live_location(uuid) to authenticated;
-- Trigger functions (handle_new_user, touch_updated_at, guards) get no API access.

-- Future functions are private by default.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------
-- 3. TABLE PRIVILEGES: RLS is the lock, grants are the second lock
-- ---------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on public.machines, public.machine_locations, public.machine_cards to anon;

revoke truncate, references, trigger on all tables in schema public from authenticated;
-- Writes to these tables happen only through the RPC functions above.
revoke insert, update, delete on public.bookings, public.booking_live_locations,
  public.machine_waitlist, public.machine_locations from authenticated;
revoke insert, delete on public.notifications from authenticated;
revoke insert, update, delete on public.machine_cards from authenticated;

-- ---------------------------------------------------------------
-- 4. ROW LEVEL SECURITY: fix the two critical holes + speed up
--    ((select auth.uid()) is evaluated once, not per row)
-- ---------------------------------------------------------------
-- CRITICAL: any signed-in user could insert/update ANY machine.
drop policy if exists auth_insert_machines on public.machines;
drop policy if exists auth_update_machines on public.machines;
create policy machines_insert_own on public.machines
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy machines_update_own on public.machines
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Profiles: only yourself, people you share a booking with, or active machine owners.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_related on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (select 1 from public.bookings b
                where (b.farmer_id = (select auth.uid()) and b.owner_id = profiles.id)
                   or (b.owner_id = (select auth.uid()) and b.farmer_id = profiles.id))
    or exists (select 1 from public.machines m where m.owner_id = profiles.id and m.is_active)
  );
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists bookings_select_participants on public.bookings;
create policy bookings_select_participants on public.bookings
  for select to authenticated
  using (farmer_id = (select auth.uid()) or owner_id = (select auth.uid()));

drop policy if exists booking_live_locations_select_participants on public.booking_live_locations;
create policy booking_live_locations_select_participants on public.booking_live_locations
  for select to authenticated
  using (owner_id = (select auth.uid()) or farmer_id = (select auth.uid()));

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists machine_waitlist_select_own on public.machine_waitlist;
create policy machine_waitlist_select_own on public.machine_waitlist
  for select to authenticated using (farmer_id = (select auth.uid()));

drop policy if exists machine_blackout_dates_insert_owner on public.machine_blackout_dates;
drop policy if exists machine_blackout_dates_delete_owner on public.machine_blackout_dates;
create policy machine_blackout_dates_insert_owner on public.machine_blackout_dates
  for insert to authenticated
  with check (exists (select 1 from public.machines m
    where m.id = machine_blackout_dates.machine_id and m.owner_id = (select auth.uid())));
create policy machine_blackout_dates_delete_owner on public.machine_blackout_dates
  for delete to authenticated
  using (exists (select 1 from public.machines m
    where m.id = machine_blackout_dates.machine_id and m.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------
-- 5. STORAGE: users write only inside their own folder; no bucket listing
--    (public image URLs keep working: buckets stay public)
-- ---------------------------------------------------------------
drop policy if exists machine_images_auth_insert on storage.objects;
drop policy if exists machine_images_public_read on storage.objects;
drop policy if exists avatars_public_read on storage.objects;
drop policy if exists machine_images_insert_own on storage.objects;
drop policy if exists machine_images_select_own on storage.objects;
drop policy if exists machine_images_delete_own on storage.objects;
drop policy if exists avatars_select_own on storage.objects;

create policy machine_images_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'machine-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy machine_images_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'machine-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy machine_images_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'machine-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------
-- 6. PERFORMANCE: index every foreign key
-- ---------------------------------------------------------------
create index if not exists booking_live_locations_farmer_idx on public.booking_live_locations (farmer_id);
create index if not exists booking_live_locations_owner_idx on public.booking_live_locations (owner_id);
create index if not exists machine_locations_machine_idx on public.machine_locations (machine_id);
create index if not exists machine_waitlist_farmer_idx on public.machine_waitlist (farmer_id);
create index if not exists machines_owner_idx on public.machines (owner_id);
create index if not exists notifications_booking_idx on public.notifications (booking_id);
