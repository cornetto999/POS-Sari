-- Ensure all authenticated users can read the full customers list.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read customers" ON public.customers;

CREATE POLICY "Authenticated read customers"
ON public.customers
FOR SELECT
TO authenticated
USING (true);
