-- 20260101001000_optimized_search_machines.sql
-- Single round-trip search_machines RPC with match ranking (exact village -> service village -> district fallback)
-- Includes supporting indexes for fast predicate evaluation.

-- 1. Supporting indexes for search predicates
create index if not exists machine_locations_village_idx
  on public.machine_locations (lower(village));

create index if not exists machine_locations_district_idx
  on public.machine_locations (lower(district));

create index if not exists machines_active_type_idx
  on public.machines (is_active, machine_type);

create index if not exists machines_crops_idx
  on public.machines using gin (crops);

-- 2. Optimized single-query search function
create or replace function public.search_machines(
  p_village text default null,
  p_district text default null,
  p_state text default null,
  p_crop text default null,
  p_machine_type text default null,
  p_limit integer default 48,
  p_offset integer default 0
)
returns setof public.machine_cards
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with filters as (
    select
      nullif(btrim(p_village), '') as village,
      nullif(btrim(p_district), '') as district,
      nullif(btrim(p_state), '') as state,
      nullif(btrim(p_crop), '') as crop,
      nullif(btrim(p_machine_type), '') as machine_type
  ),
  target_districts as (
    select f.district as district
    from filters f
    where f.district is not null
    union
    select ml.district
    from filters f
    join public.machine_locations ml on (
      lower(ml.village) = lower(f.village)
      or lower(ml.district) = lower(f.village)
      or lower(ml.village) like '%' || lower(f.village) || '%'
    )
    where f.district is null and f.village is not null
  )
  select mc.*
  from public.machine_cards mc
  cross join filters f
  where mc.is_active = true
    and (f.crop is null or f.crop = any(mc.crops))
    and (f.machine_type is null or mc.machine_type::text = f.machine_type)
    and (
      -- Case A: No location filter provided - return all active machines
      (f.village is null and f.district is null and f.state is null)
      or
      -- Case B: Primary village or service villages match
      (
        f.village is not null
        and (
          lower(mc.village) like '%' || lower(f.village) || '%'
          or exists (
            select 1
            from unnest(mc.service_villages) sv
            where lower(sv) like '%' || lower(f.village) || '%'
          )
        )
      )
      or
      -- Case C: District match (provided or inferred from village)
      (
        exists (
          select 1
          from target_districts td
          where lower(mc.district) like '%' || lower(td.district) || '%'
             or lower(td.district) like '%' || lower(mc.district) || '%'
        )
      )
      or
      -- Case D: State filter only (if state specified without village or district)
      (
        f.village is null and f.district is null and f.state is not null
        and lower(mc.state) like '%' || lower(f.state) || '%'
      )
    )
  order by
    case
      -- Rank 0: Exact match on primary village
      when f.village is not null and lower(mc.village) = lower(f.village) then 0
      -- Rank 1: Service village or substring village match
      when f.village is not null and (
        lower(mc.village) like '%' || lower(f.village) || '%'
        or exists (
          select 1
          from unnest(mc.service_villages) sv
          where lower(sv) like '%' || lower(f.village) || '%'
        )
      ) then 1
      -- Rank 2: District fallback match
      when exists (
        select 1
        from target_districts td
        where lower(mc.district) like '%' || lower(td.district) || '%'
           or lower(td.district) like '%' || lower(mc.district) || '%'
      ) then 2
      else 3
    end asc,
    mc.created_at desc,
    mc.id
  limit least(greatest(coalesce(p_limit, 48), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- 3. Grants for both anonymous visitors (guest farmers) and authenticated users
grant execute on function public.search_machines(text, text, text, text, text, integer, integer)
  to anon, authenticated;
