-- Store per-user product PIN securely and verify via RPC.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS product_pin_hash TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_pin TEXT;
BEGIN
  raw_pin := COALESCE(NEW.raw_user_meta_data->>'product_pin', '');

  INSERT INTO public.profiles (user_id, display_name, product_pin_hash)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    CASE
      WHEN raw_pin <> '' THEN crypt(raw_pin, gen_salt('bf'))
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_my_product_pin(_pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.product_pin_hash IS NOT NULL
      AND p.product_pin_hash = crypt(_pin, p.product_pin_hash)
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_my_product_pin(TEXT) TO authenticated;
