-- Isolate products by account so each authenticated user only sees/manages their own records.
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.products
ALTER COLUMN owner_user_id SET DEFAULT auth.uid();

-- Backfill legacy rows (created before ownership existed) to the oldest user as a safe one-time default.
UPDATE public.products
SET owner_user_id = (
  SELECT au.id
  FROM auth.users au
  ORDER BY au.created_at ASC
  LIMIT 1
)
WHERE owner_user_id IS NULL;

ALTER TABLE public.products
ALTER COLUMN owner_user_id SET NOT NULL;

DROP POLICY IF EXISTS "Authenticated read products" ON public.products;
DROP POLICY IF EXISTS "Admin manages products" ON public.products;
DROP POLICY IF EXISTS "Authenticated add products" ON public.products;
DROP POLICY IF EXISTS "Admin updates products" ON public.products;
DROP POLICY IF EXISTS "Authenticated update products" ON public.products;
DROP POLICY IF EXISTS "Admin deletes products" ON public.products;

CREATE POLICY "Users read own products"
ON public.products
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "Users insert own products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users update own products"
ON public.products
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users delete own products"
ON public.products
FOR DELETE
TO authenticated
USING (owner_user_id = auth.uid());
