-- supabase/migrations/20250626125000_fix_outline_trigger_cover_jobs.sql
-- Ajuste del trigger 'trigger_generate_outline' para evitar que los jobs de portada
-- (cuyo payload contiene 'image_model_id') vuelvan a invocar la generación de esquema
-- y provoquen sobrescritura o repetición innecesaria.
--
-- IMPORTANTE: Solo redefine la función. El trigger ya existe y seguirá apuntando
-- a esta misma función.

CREATE OR REPLACE FUNCTION public.trigger_generate_outline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Necesario para poder acceder a secretos en "vault"
SET search_path = public, vault
AS $$
DECLARE
  v_url text := 'https://ydorhokujupnxpyrxczv.supabase.co/functions/v1/generate-book-outline';
  v_payload jsonb;
  v_headers jsonb;
  v_request_id bigint;
BEGIN
  ---------------------------------------------------------------------------
  -- 0. FILTRO: Si el job es de portada (payload incluye 'image_model_id'),
  --    no invocamos la Edge Function de esquema y salimos.
  ---------------------------------------------------------------------------
  IF NEW.payload ? 'image_model_id' THEN
    RETURN NEW;
  END IF;

  ---------------------------------------------------------------------------
  -- 1. Construir payload y cabeceras
  ---------------------------------------------------------------------------
  v_payload := jsonb_build_object('book_id', NEW.book_id, 'job_id', NEW.id);
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
  );

  ---------------------------------------------------------------------------
  -- 2. Invocar la función Edge de forma asíncrona (pg_net)
  ---------------------------------------------------------------------------
  SELECT net.http_post(
    url     := v_url,
    headers := v_headers,
    body    := v_payload
  ) INTO v_request_id;

  RETURN NEW;
END;
$$;
