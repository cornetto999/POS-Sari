-- Allow authenticated users to update product fields (e.g., restock, price changes).
DROP POLICY IF EXISTS "Admin updates products" ON public.products;

CREATE POLICY "Authenticated update products"
ON public.products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
