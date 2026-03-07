-- Allow authenticated users to set/update their own product PIN securely.
CREATE OR REPLACE FUNCTION public.set_my_product_pin(_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;

  UPDATE public.profiles
  SET product_pin_hash = crypt(_pin, gen_salt('bf'))
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, product_pin_hash)
    VALUES (auth.uid(), crypt(_pin, gen_salt('bf')))
    ON CONFLICT (user_id)
    DO UPDATE SET product_pin_hash = EXCLUDED.product_pin_hash;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_product_pin(TEXT) TO authenticated;
