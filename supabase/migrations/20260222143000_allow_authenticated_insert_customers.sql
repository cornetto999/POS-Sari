-- Allow any authenticated user to create customer records.
DROP POLICY IF EXISTS "Admin manages customers" ON public.customers;

CREATE POLICY "Authenticated add customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (true);
