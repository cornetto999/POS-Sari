-- Assign a role to the current authenticated user if they don't have one yet.
-- First user becomes admin, next users become cashier.
CREATE OR REPLACE FUNCTION public.ensure_my_role()
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  existing_role public.app_role;
  has_admin BOOLEAN;
  assigned_role public.app_role;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO existing_role
  FROM public.user_roles
  WHERE user_id = current_user_id
  LIMIT 1;

  IF existing_role IS NOT NULL THEN
    RETURN existing_role;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  ) INTO has_admin;

  assigned_role := CASE WHEN has_admin THEN 'cashier'::public.app_role ELSE 'admin'::public.app_role END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN assigned_role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_role() TO authenticated;
