-- Isolate customers and utang records per authenticated account.

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.customers
ALTER COLUMN owner_user_id SET DEFAULT auth.uid();

-- Backfill legacy rows to oldest account as one-time fallback.
UPDATE public.customers
SET owner_user_id = (
  SELECT au.id
  FROM auth.users au
  ORDER BY au.created_at ASC
  LIMIT 1
)
WHERE owner_user_id IS NULL;

ALTER TABLE public.customers
ALTER COLUMN owner_user_id SET NOT NULL;

ALTER TABLE public.utang_ledger
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.utang_ledger
ALTER COLUMN owner_user_id SET DEFAULT auth.uid();

UPDATE public.utang_ledger ul
SET owner_user_id = COALESCE(
  ul.created_by,
  c.owner_user_id,
  (
    SELECT au.id
    FROM auth.users au
    ORDER BY au.created_at ASC
    LIMIT 1
  )
)
FROM public.customers c
WHERE ul.customer_id = c.id
  AND ul.owner_user_id IS NULL;

UPDATE public.utang_ledger
SET owner_user_id = (
  SELECT au.id
  FROM auth.users au
  ORDER BY au.created_at ASC
  LIMIT 1
)
WHERE owner_user_id IS NULL;

ALTER TABLE public.utang_ledger
ALTER COLUMN owner_user_id SET NOT NULL;

DROP POLICY IF EXISTS "Authenticated read customers" ON public.customers;
DROP POLICY IF EXISTS "Admin manages customers" ON public.customers;
DROP POLICY IF EXISTS "Admin updates customers" ON public.customers;
DROP POLICY IF EXISTS "Admin deletes customers" ON public.customers;

CREATE POLICY "Users read own customers"
ON public.customers
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "Users insert own customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users update own customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users delete own customers"
ON public.customers
FOR DELETE
TO authenticated
USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Read utang" ON public.utang_ledger;
DROP POLICY IF EXISTS "Insert utang" ON public.utang_ledger;
DROP POLICY IF EXISTS "Admin updates utang" ON public.utang_ledger;
DROP POLICY IF EXISTS "Admin deletes utang" ON public.utang_ledger;

CREATE POLICY "Users read own utang"
ON public.utang_ledger
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "Users insert own utang"
ON public.utang_ledger
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = auth.uid()
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = utang_ledger.customer_id
      AND c.owner_user_id = auth.uid()
  )
  AND (
    sale_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.sales s
      WHERE s.id = utang_ledger.sale_id
        AND s.cashier_id = auth.uid()
    )
  )
);

CREATE POLICY "Users update own utang"
ON public.utang_ledger
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid() AND created_by = auth.uid());

CREATE POLICY "Users delete own utang"
ON public.utang_ledger
FOR DELETE
TO authenticated
USING (owner_user_id = auth.uid());
