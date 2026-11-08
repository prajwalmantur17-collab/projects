-- Fixes "42P17 infinite recursion detected in policy for relation machines".
-- Policies on machines must not query tables whose policies query machines.
-- SECURITY DEFINER boolean helpers break the loop. Safe to re-run.

create or replace function public.is_machine_booking_participant(p_machine_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    where b.machine_id = p_machine_id
      and (b.farmer_id = (select auth.uid()) or b.owner_id = (select auth.uid()))
  );
$$;

revoke execute on function public.is_machine_booking_participant(uuid) from public, anon;
grant execute on function public.is_machine_booking_participant(uuid) to authenticated;

create or replace function public.current_user_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'owner'
  );
$$;

revoke execute on function public.current_user_is_owner() from public, anon;
grant execute on function public.current_user_is_owner() to authenticated;

drop policy if exists machines_select_related on public.machines;
create policy machines_select_related on public.machines
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_machine_booking_participant(id)
  );

drop policy if exists machines_insert_own on public.machines;
create policy machines_insert_own on public.machines
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.current_user_is_owner()
  );
