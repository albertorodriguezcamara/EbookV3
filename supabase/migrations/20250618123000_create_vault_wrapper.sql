-- Wrapper function to access vault secrets, as suggested by Supabase support.
-- This is expected to fail on creation because the 'postgres' user cannot resolve 'vault.secret_get'.
CREATE OR REPLACE FUNCTION public.get_service_role_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
    -- This line will fail during function creation if the user lacks permissions.
    RETURN vault.secret_get('service_role_key'::text);
END;
$$;

-- Grant execute permission. This will not be reached if creation fails.
GRANT EXECUTE ON FUNCTION public.get_service_role_key() TO postgres;
