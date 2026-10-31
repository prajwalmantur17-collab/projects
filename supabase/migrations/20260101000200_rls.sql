-- Row Level Security and least-privilege table grants.
-- Anonymous users get no data access. Signed-in users can read shared listing
-- data, but booking writes happen only through the RPCs in the previous file.

grant usage on schema public to authenticated;

alter table public.profiles enable row level security;
alter table public.machines enable row level security;
alter table public.machine_locations enable row level security;
alter table public.machine_blackout_dates enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;

-- Profiles: no email or phone is stored here. Names and saved villages are
-- visible to signed-in users so listings and bookings can show who is who.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, preferred_language, village, district, state)
  on table public.profiles to authenticated;

create policy profiles_select_signed_in
  on public.profiles for select
  to authenticated
  using (true);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Machines: active listings are public within the app; paused listings are
-- visible to their owner and to anyone with a booking for that machine.
revoke all on table public.machines from anon, authenticated;
grant select on table public.machines to authenticated;
grant insert (
  owner_id, machine_type, model, price_per_acre, crops, phone,
  latitude, longitude, image_path
) on table public.machines to authenticated;
grant update (
  machine_type, model, price_per_acre, crops, phone,
  latitude, longitude, image_path, is_active
) on table public.machines to authenticated;
grant delete on table public.machines to authenticated;

create policy machines_select_visible
  on public.machines for select
  to authenticated
  using (
    is_active
    or owner_id = auth.uid()
    or exists (
      select 1
      from public.bookings b
      where b.machine_id = machines.id
        and (b.farmer_id = auth.uid() or b.owner_id = auth.uid())
    )
  );

create policy machines_insert_owner
  on public.machines for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

create policy machines_update_owner
  on public.machines for update
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

create policy machines_delete_owner
  on public.machines for delete
  to authenticated
  using (owner_id = auth.uid());

-- Service locations are read-only to clients; set_machine_locations() owns
-- replacement so a machine always has exactly one primary village.
revoke all on table public.machine_locations from anon, authenticated;
grant select on table public.machine_locations to authenticated;

create policy machine_locations_select_visible
  on public.machine_locations for select
  to authenticated
  using (
    exists (
      select 1 from public.machines m
      where m.id = machine_locations.machine_id
    )
  );

-- Blackout dates can be managed directly by the machine owner.
revoke all on table public.machine_blackout_dates from anon, authenticated;
grant select, insert, delete on table public.machine_blackout_dates to authenticated;

create policy machine_blackout_dates_select_visible
  on public.machine_blackout_dates for select
  to authenticated
  using (
    exists (
      select 1 from public.machines m
      where m.id = machine_blackout_dates.machine_id
    )
  );

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

-- Bookings: read-only to the two parties. Inserts/updates go through the
-- booking RPCs, which enforce valid transitions and create notifications.
revoke all on table public.bookings from anon, authenticated;
grant select on table public.bookings to authenticated;

create policy bookings_select_participants
  on public.bookings for select
  to authenticated
  using (farmer_id = auth.uid() or owner_id = auth.uid());

-- Notifications: users can only read and mark their own as read.
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The view is the only listing read model exposed to the app.
revoke all on table public.machine_cards from anon, authenticated;
grant select on table public.machine_cards to authenticated;
