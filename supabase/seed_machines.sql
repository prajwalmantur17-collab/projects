-- ==============================================================================
-- HarvestRental - Sample Machinery Seed Data
-- Run this in the Supabase SQL Editor if you want to populate your live database
-- with realistic harvesters across Karnataka, Punjab, Haryana, and UP.
-- ==============================================================================

DO $$
DECLARE
  m1_id uuid := gen_random_uuid();
  m2_id uuid := gen_random_uuid();
  m3_id uuid := gen_random_uuid();
  m4_id uuid := gen_random_uuid();
  m5_id uuid := gen_random_uuid();
  m6_id uuid := gen_random_uuid();
  m7_id uuid := gen_random_uuid();
  m8_id uuid := gen_random_uuid();
BEGIN
  -- 1. Kubota DC-68G (Mandya, Karnataka)
  INSERT INTO public.machines (id, machine_type, model, price_per_acre, crops, phone, latitude, longitude, image_path, is_active, is_available)
  VALUES (m1_id, 'combine_harvester', 'Kubota DC-68G (Rubber Tracked)', 2400, ARRAY['rice', 'wheat', 'soybean'], '9845123456', 12.5238, 76.8966, 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80', true, true);

  INSERT INTO public.machine_locations (machine_id, village, district, state, is_primary)
  VALUES
    (m1_id, 'Mandya', 'Mandya', 'Karnataka', true),
    (m1_id, 'Maddur', 'Mandya', 'Karnataka', false),
    (m1_id, 'Pandavapura', 'Mandya', 'Karnataka', false);

  -- 2. Preet 987 (Khanna, Punjab)
  INSERT INTO public.machines (id, machine_type, model, price_per_acre, crops, phone, latitude, longitude, image_path, is_active, is_available)
  VALUES (m2_id, 'combine_harvester', 'Preet 987 (with Straw Chopper)', 1800, ARRAY['wheat', 'rice', 'barley', 'mustard'], '9876543210', 30.7071, 76.2198, 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80', true, true);

  INSERT INTO public.machine_locations (machine_id, village, district, state, is_primary)
  VALUES
    (m2_id, 'Khanna', 'Ludhiana', 'Punjab', true),
    (m2_id, 'Samrala', 'Ludhiana', 'Punjab', false),
    (m2_id, 'Doraha', 'Ludhiana', 'Punjab', false);

  -- 3. Claas Crop Tiger 33 (Belagavi, Karnataka)
  INSERT INTO public.machines (id, machine_type, model, price_per_acre, crops, phone, latitude, longitude, image_path, is_active, is_available)
  VALUES (m3_id, 'combine_harvester', 'Claas Crop Tiger 33 Terra Trac', 2600, ARRAY['rice', 'sugarcane', 'soybean', 'maize'], '9900112233', 15.8497, 74.4977, 'https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?auto=format&fit=crop&w=800&q=80', true, true);

  INSERT INTO public.machine_locations (machine_id, village, district, state, is_primary)
  VALUES
    (m3_id, 'Belagavi', 'Belagavi', 'Karnataka', true),
    (m3_id, 'Gokak', 'Belagavi', 'Karnataka', false),
    (m3_id, 'Bailhongal', 'Belagavi', 'Karnataka', false);

  -- 4. John Deere W70 (Karnal, Haryana)
  INSERT INTO public.machines (id, machine_type, model, price_per_acre, crops, phone, latitude, longitude, image_path, is_active, is_available)
  VALUES (m4_id, 'combine_harvester', 'John Deere W70 SynchroSmart', 2100, ARRAY['rice', 'wheat', 'maize'], '9412345678', 29.6857, 76.9905, 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=800&q=80', true, true);

  INSERT INTO public.machine_locations (machine_id, village, district, state, is_primary)
  VALUES
    (m4_id, 'Karnal', 'Karnal', 'Haryana', true),
    (m4_id, 'Nilokheri', 'Karnal', 'Haryana', false),
    (m4_id, 'Gharaunda', 'Karnal', 'Haryana', false);

  -- 5. Mahindra Applitrac Reaper & Thresher (Meerut, UP)
  INSERT INTO public.machines (id, machine_type, model, price_per_acre, crops, phone, latitude, longitude, image_path, is_active, is_available)
  VALUES (m5_id, 'tractor_harvester', 'Mahindra Applitrac Reaper (55HP)', 1400, ARRAY['wheat', 'mustard', 'chickpea', 'barley'], '9123456789', 28.9845, 77.7064, 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=800&q=80', true, true);

  INSERT INTO public.machine_locations (machine_id, village, district, state, is_primary)
  VALUES
    (m5_id, 'Meerut', 'Meerut', 'Uttar Pradesh', true),
    (m5_id, 'Mawana', 'Meerut', 'Uttar Pradesh', false);

  -- 6. Kartar 4000 Paddy Special (Shimoga, Karnataka)
  INSERT INTO public.machines (id, machine_type, model, price_per_acre, crops, phone, latitude, longitude, image_path, is_active, is_available)
  VALUES (m6_id, 'combine_harvester', 'Kartar 4000 Paddy Special (10ft)', 2350, ARRAY['rice', 'maize', 'groundnut'], '9741238901', 13.9299, 75.5681, 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&w=800&q=80', true, true);

  INSERT INTO public.machine_locations (machine_id, village, district, state, is_primary)
  VALUES
    (m6_id, 'Shimoga', 'Shivamogga', 'Karnataka', true),
    (m6_id, 'Bhadravati', 'Shivamogga', 'Karnataka', false);

  -- 7. New Holland BC5060 Baler (Moga, Punjab)
  INSERT INTO public.machines (id, machine_type, model, price_per_acre, crops, phone, latitude, longitude, image_path, is_active, is_available)
  VALUES (m7_id, 'baler', 'New Holland BC5060 Straw Baler', 950, ARRAY['rice', 'wheat'], '9814098765', 30.8165, 75.1717, 'https://images.unsplash.com/photo-1627920769842-6887c6df05ca?auto=format&fit=crop&w=800&q=80', true, true);

  INSERT INTO public.machine_locations (machine_id, village, district, state, is_primary)
  VALUES
    (m7_id, 'Moga', 'Moga', 'Punjab', true),
    (m7_id, 'Baghapurana', 'Moga', 'Punjab', false);

  -- 8. BCS Reaper Binder (Kolhapur, Maharashtra)
  INSERT INTO public.machines (id, machine_type, model, price_per_acre, crops, phone, latitude, longitude, image_path, is_active, is_available)
  VALUES (m8_id, 'reaper', 'BCS Self-Propelled Reaper Binder', 1600, ARRAY['wheat', 'rice', 'soybean', 'millet'], '9822334455', 16.705, 74.2433, 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=800&q=80', true, true);

  INSERT INTO public.machine_locations (machine_id, village, district, state, is_primary)
  VALUES
    (m8_id, 'Kolhapur', 'Kolhapur', 'Maharashtra', true),
    (m8_id, 'Hatkanangle', 'Kolhapur', 'Maharashtra', false);
END $$;
