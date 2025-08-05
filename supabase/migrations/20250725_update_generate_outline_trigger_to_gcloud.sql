-- Migración para actualizar el trigger generate-book-outline para usar Google Cloud Functions
-- Fecha: 2025-07-25
-- Propósito: Cambiar la URL del trigger para llamar a la función migrada en Google Cloud
-- Optimizada para libros grandes (150+ capítulos) sin timeouts

-- Actualizar la función del trigger para usar la nueva URL de Google Cloud
CREATE OR REPLACE FUNCTION public.trigger_generate_outline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  -- NUEVA URL: Google Cloud Functions en lugar de Supabase Edge Function
  v_url text := 'https://europe-west1-export-document-project.cloudfunctions.net/generate-book-outline';
  v_payload jsonb;
  v_headers jsonb;
  v_request_id bigint;
BEGIN
  -- Solo procesar jobs que estén en estado 'pending'
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Construir payload con los mismos parámetros que espera la función
  v_payload := jsonb_build_object(
    'book_id', NEW.book_id, 
    'job_id', NEW.id
  );
  
  -- Construir headers con autorización usando el service role key
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      SELECT decrypted_secret 
      FROM vault.decrypted_secrets 
      WHERE name = 'service_role_key' 
      LIMIT 1
    )
  );

  -- Realizar la llamada HTTP a Google Cloud Functions
  SELECT net.http_post(
    url := v_url,
    headers := v_headers,
    body := v_payload,
    timeout_milliseconds := 900000  -- 15 minutos timeout para libros grandes
  ) INTO v_request_id;

  -- Log de la invocación para debugging (opcional)
  INSERT INTO public.creation_logs (book_id, message) 
  VALUES (
    NEW.book_id, 
    'Iniciando generación de esquema de capítulos via Google Cloud Functions (request_id: ' || v_request_id || ')'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, registrar el problema pero no fallar el trigger
    INSERT INTO public.creation_logs (book_id, message) 
    VALUES (
      NEW.book_id, 
      'Error al invocar generate-book-outline: ' || SQLERRM
    );
    RETURN NEW;
END;
$$;

-- El trigger ya existe, no necesitamos recrearlo, solo actualizar la función
-- DROP TRIGGER IF EXISTS on_new_job_generate_outline ON public.jobs;
-- CREATE TRIGGER on_new_job_generate_outline
--   AFTER INSERT ON public.jobs
--   FOR EACH ROW
--   EXECUTE FUNCTION public.trigger_generate_outline();

-- Comentario informativo
COMMENT ON FUNCTION public.trigger_generate_outline() IS 
'Trigger function actualizada para llamar a generate-book-outline en Google Cloud Functions. 
URL: https://europe-west1-export-document-project.cloudfunctions.net/generate-book-outline
Migrado desde Supabase Edge Functions el 2025-07-25 para evitar timeouts con libros grandes (150+ capítulos).
Configuración: 8GiB memoria, 15 minutos timeout, procesamiento por lotes optimizado.';
