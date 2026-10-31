-- ==============================================================================
-- HarvestRental - Complete All-In-One Idempotent Supabase Setup Script
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- It creates all tables, RPC functions, RLS policies, and storage buckets safely.
-- ==============================================================================

-- 1. Safely create enum types if they don't already exist
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('farmer', 'owner');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.machine_type AS ENUM (
    'combine_harvester',
    'tractor_harvester',
    'reaper',
    'thresher',
    'baler',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_kind AS ENUM (
    'booking_created',
    'booking_confirmed',
    'booking_rejected',
    'booking_cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Core Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'Farmer' CHECK (char_length(full_name) BETWEEN 1 AND 120),
  role public.user_role,
  preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'kn', 'hi')),
  village text CHECK (village IS NULL OR char_length(village) BETWEEN 2 AND 80),
  district text CHECK (district IS NULL OR char_length(district) BETWEEN 2 AND 80),
  state text CHECK (state IS NULL OR char_length(state) BETWEEN 2 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  machine_type public.machine_type NOT NULL,
  model text CHECK (model IS NULL OR char_length(model) <= 80),
  price_per_acre numeric(10, 2) NOT NULL CHECK (price_per_acre BETWEEN 1 AND 1000000),
  pricing_unit text NOT NULL DEFAULT 'per_acre',
  crops text[] NOT NULL,
  phone text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  latitude double precision CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  image_path text CHECK (image_path IS NULL OR char_length(image_path) <= 500),
  is_active boolean NOT NULL DEFAULT true,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure columns exist if table was previously created without them
DO $$ BEGIN
  ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS pricing_unit text NOT NULL DEFAULT 'per_acre';
EXCEPTION WHEN others THEN null;
END $$;

-- Ensure both is_active and is_available exist if table was previously created without them
DO $$ BEGIN
  ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;
EXCEPTION WHEN others THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.machine_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines (id) ON DELETE CASCADE,
  village text NOT NULL CHECK (char_length(village) BETWEEN 2 AND 80),
  district text NOT NULL CHECK (char_length(district) BETWEEN 2 AND 80),
  state text NOT NULL CHECK (char_length(state) BETWEEN 2 AND 80),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.machine_blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines (id) ON DELETE CASCADE,
  unavailable_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (machine_id, unavailable_on)
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines (id) ON DELETE RESTRICT,
  farmer_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  owner_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  service_date date NOT NULL,
  village text NOT NULL CHECK (char_length(village) BETWEEN 2 AND 80),
  acreage numeric(6, 2) NOT NULL CHECK (acreage BETWEEN 0.1 AND 500),
  crop text NOT NULL,
  contact_phone text NOT NULL CHECK (contact_phone ~ '^[6-9][0-9]{9}$'),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  price_per_acre numeric(10, 2) NOT NULL CHECK (price_per_acre > 0),
  status public.booking_status NOT NULL DEFAULT 'pending',
  owner_note text CHECK (owner_note IS NULL OR char_length(owner_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  cancelled_at timestamptz
);

-- 3. Public Machine Cards View
CREATE OR REPLACE VIEW public.machine_cards AS
SELECT
  m.id,
  m.owner_id,
  m.machine_type,
  m.model,
  m.price_per_acre,
  COALESCE(m.pricing_unit, 'per_acre') AS pricing_unit,
  m.crops,
  m.phone,
  m.latitude,
  m.longitude,
  m.image_path,
  m.is_active,
  m.is_available,
  m.created_at,
  m.updated_at,
  COALESCE(p.full_name, 'Machine Owner') AS owner_name,
  COALESCE(primary_location.village, 'Local') AS village,
  COALESCE(primary_location.district, 'Local') AS district,
  COALESCE(primary_location.state, 'India') AS state,
  COALESCE(service_villages.villages, ARRAY[]::text[]) AS service_villages
FROM public.machines m
LEFT JOIN public.profiles p ON p.id = m.owner_id
LEFT JOIN LATERAL (
  SELECT ml.village, ml.district, ml.state
  FROM public.machine_locations ml
  WHERE ml.machine_id = m.id
  ORDER BY ml.is_primary DESC, ml.created_at ASC
  LIMIT 1
) primary_location ON true
LEFT JOIN LATERAL (
  SELECT array_agg(ml.village ORDER BY ml.is_primary DESC, ml.village) AS villages
  FROM public.machine_locations ml
  WHERE ml.machine_id = m.id
) service_villages ON true;

-- 4. User Profile Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      'Farmer'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS harvest_on_auth_user_created ON auth.users;
CREATE TRIGGER harvest_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'HR_UNAUTHORIZED: sign in required' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.profiles (id, full_name)
  SELECT
    u.id,
    COALESCE(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
      'Farmer'
    )
  FROM auth.users u
  WHERE u.id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(p_role public.user_role)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'HR_UNAUTHORIZED: sign in required' USING errcode = 'P0001';
  END IF;

  UPDATE public.profiles
  SET role = p_role, updated_at = now()
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    INSERT INTO public.profiles (id, role)
    VALUES (v_user_id, p_role)
    RETURNING * INTO v_profile;
  END IF;

  RETURN v_profile;
END;
$$;

-- 5. Search Machines RPC Function (Allows public & anon search)
CREATE OR REPLACE FUNCTION public.search_machines(
  p_village text DEFAULT NULL,
  p_district text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_crop text DEFAULT NULL,
  p_machine_type text DEFAULT NULL,
  p_limit integer DEFAULT 48,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public.machine_cards
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT mc.*
  FROM public.machine_cards mc
  WHERE
    mc.is_active = true
    AND (
      p_crop IS NULL OR p_crop = '' OR p_crop = ANY(mc.crops)
    )
    AND (
      p_machine_type IS NULL OR p_machine_type = '' OR mc.machine_type::text = p_machine_type
    )
    AND (
      p_village IS NULL OR p_village = ''
      OR lower(mc.village) LIKE '%' || lower(trim(p_village)) || '%'
      OR lower(mc.district) LIKE '%' || lower(trim(p_village)) || '%'
      OR lower(trim(p_village)) LIKE '%' || lower(mc.district) || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(mc.service_villages) sv
        WHERE lower(sv) LIKE '%' || lower(trim(p_village)) || '%'
      )
    )
    AND (
      p_district IS NULL OR p_district = ''
      OR lower(mc.district) LIKE '%' || lower(trim(p_district)) || '%'
      OR lower(trim(p_district)) LIKE '%' || lower(mc.district) || '%'
    )
  ORDER BY
    CASE
      WHEN p_village IS NOT NULL AND p_village <> '' AND (lower(mc.district) LIKE '%' || lower(trim(p_village)) || '%' OR lower(mc.village) LIKE '%' || lower(trim(p_village)) || '%') THEN 0
      ELSE 1
    END,
    mc.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- 6. Helper Function to set service locations
CREATE OR REPLACE FUNCTION public.set_machine_locations(
  p_machine_id uuid,
  p_locations jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_loc jsonb;
BEGIN
  DELETE FROM public.machine_locations WHERE machine_id = p_machine_id;
  FOR v_loc IN SELECT * FROM jsonb_array_elements(p_locations) LOOP
    INSERT INTO public.machine_locations (
      machine_id,
      village,
      district,
      state,
      is_primary
    ) VALUES (
      p_machine_id,
      btrim(v_loc->>'village'),
      btrim(v_loc->>'district'),
      btrim(v_loc->>'state'),
      COALESCE((v_loc->>'is_primary')::boolean, false)
    );
  END LOOP;
END;
$$;

-- 7. Permissions & Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.machine_cards TO anon, authenticated;
GRANT SELECT ON public.machines TO anon, authenticated;
GRANT SELECT ON public.machine_locations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_machines TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_machine_locations TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role TO authenticated;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "public_read_machines" ON public.machines;
CREATE POLICY "public_read_machines" ON public.machines
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "public_read_locations" ON public.machine_locations;
CREATE POLICY "public_read_locations" ON public.machine_locations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_machines" ON public.machines;
CREATE POLICY "auth_insert_machines" ON public.machines
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_machines" ON public.machines;
CREATE POLICY "auth_update_machines" ON public.machines
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_delete_machines" ON public.machines;
CREATE POLICY "auth_delete_machines" ON public.machines
  FOR DELETE TO authenticated USING (true);

-- 8. Supabase Storage Setup for Machine Photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'machine-images',
  'machine-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "machine_images_public_read" ON storage.objects;
CREATE POLICY "machine_images_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'machine-images');

DROP POLICY IF EXISTS "machine_images_auth_insert" ON storage.objects;
CREATE POLICY "machine_images_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'machine-images');
