-- Function to safely and completely delete or deactivate a machine.
-- Owned by the machine owner; cleans up service locations, blackout dates,
-- and cancels pending bookings.
CREATE OR REPLACE FUNCTION public.delete_machine(p_machine_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_has_bookings boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'HR_UNAUTHORIZED: sign in required' USING errcode = 'P0001';
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.machines
  WHERE id = p_machine_id;

  IF v_owner_id IS NULL THEN
    RETURN true;
  END IF;

  IF v_owner_id <> v_user_id THEN
    RAISE EXCEPTION 'HR_NOT_OWNER: not your machine' USING errcode = 'P0001';
  END IF;

  -- 1. Cancel pending bookings
  UPDATE public.bookings
  SET status = 'cancelled',
      owner_note = COALESCE(owner_note, 'Machine listing removed by owner'),
      cancelled_at = now()
  WHERE machine_id = p_machine_id
    AND status = 'pending';

  -- 2. Deactivate the machine immediately
  UPDATE public.machines
  SET is_active = false,
      is_available = false
  WHERE id = p_machine_id;

  -- 3. Delete blackout dates
  DELETE FROM public.machine_blackout_dates
  WHERE machine_id = p_machine_id;

  -- 4. Delete service locations so it never appears in search_machines or machine_cards
  DELETE FROM public.machine_locations
  WHERE machine_id = p_machine_id;

  -- 5. If no bookings reference it, hard delete the machine row
  SELECT EXISTS (
    SELECT 1 FROM public.bookings WHERE machine_id = p_machine_id
  ) INTO v_has_bookings;

  IF NOT v_has_bookings THEN
    DELETE FROM public.machines WHERE id = p_machine_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_machine(uuid) TO authenticated;
