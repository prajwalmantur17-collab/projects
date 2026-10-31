-- Enable Realtime for booking requests and in-app notifications.
-- The app subscribes with filters on farmer_id / owner_id / user_id; changes
-- are still filtered by the RLS SELECT policies.

-- Full row images let filtered UPDATE/DELETE events reach the correct client
-- even when the filter column itself did not change.
alter table public.bookings replica identity full;
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
