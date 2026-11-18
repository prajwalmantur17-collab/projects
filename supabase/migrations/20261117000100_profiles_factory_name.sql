-- Sugar factory accounts: a farmer-mode profile with a factory name is a factory renter.
-- (Already applied live.)
alter table public.profiles add column if not exists factory_name text;
alter table public.profiles drop constraint if exists profiles_factory_name_check;
alter table public.profiles add constraint profiles_factory_name_check
  check (factory_name is null or char_length(btrim(factory_name)) between 2 and 80);
