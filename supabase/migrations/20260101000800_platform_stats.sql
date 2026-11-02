-- RPC to safely expose real platform counts to visitors without exposing private profile rows
create or replace function public.get_platform_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  total_machines int;
  available_machines int;
  total_farmers int;
  total_users int;
  confirmed_bookings int;
  result json;
begin
  select count(*) into total_machines from public.machines where is_active = true;
  select count(*) into available_machines from public.machines where is_active = true and is_available = true;
  select count(*) into total_farmers from public.profiles where role = 'farmer';
  select count(*) into total_users from public.profiles;
  select count(*) into confirmed_bookings from public.bookings where status = 'confirmed';
  
  result := json_build_object(
    'total_machines', coalesce(total_machines, 0),
    'available_machines', coalesce(available_machines, 0),
    'total_farmers', coalesce(total_farmers, 0),
    'total_users', coalesce(total_users, 0),
    'confirmed_bookings', coalesce(confirmed_bookings, 0)
  );
  
  return result;
end;
$$;

grant execute on function public.get_platform_stats() to anon, authenticated;
