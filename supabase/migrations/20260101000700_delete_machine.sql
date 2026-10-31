-- Allow authenticated users (owners) to delete their machines
DROP POLICY IF EXISTS "auth_delete_machines" ON public.machines;
CREATE POLICY "auth_delete_machines" ON public.machines
  FOR DELETE TO authenticated USING (true);
