-- Allow all authenticated users to add products.
DROP POLICY IF EXISTS "Admin manages products" ON public.products;

CREATE POLICY "Authenticated add products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (true);
