-- Función para invocar 'generate-book-outline'
CREATE OR REPLACE FUNCTION public.trigger_generate_outline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Importante para usar secretos
SET search_path = public, vault
AS $$
DECLARE
  v_url text := 'https://ydorhokujupnxpyrxczv.supabase.co/functions/v1/generate-book-outline';
  v_payload jsonb;
  v_headers jsonb;
  v_request_id bigint;
BEGIN
  v_payload := jsonb_build_object('book_id', NEW.book_id, 'job_id', NEW.id);
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
  );

  -- Invocar la función Edge de forma asíncrona
  SELECT net.http_post(
    url := v_url,
    headers := v_headers,
    body := v_payload
  ) INTO v_request_id;

  RETURN NEW;
END;
$$;

-- Trigger en la tabla 'jobs'
DROP TRIGGER IF EXISTS on_new_job_generate_outline ON public.jobs;
CREATE TRIGGER on_new_job_generate_outline
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_outline();


-- Función para invocar 'write-chapter-content'
CREATE OR REPLACE FUNCTION public.trigger_write_chapter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_url text := 'https://ydorhokujupnxpyrxczv.supabase.co/functions/v1/write-chapter-content';
  v_payload jsonb;
  v_headers jsonb;
  v_job_id uuid;
  v_request_id bigint;
BEGIN
  SELECT id INTO v_job_id
  FROM public.jobs
  WHERE book_id = NEW.book_id AND status = 'processing'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object('chapter_id', NEW.id, 'job_id', v_job_id);
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
  );

  SELECT net.http_post(
    url := v_url,
    headers := v_headers,
    body := v_payload
  ) INTO v_request_id;

  RETURN NEW;
END;
$$;

-- Trigger en la tabla 'chapters'
DROP TRIGGER IF EXISTS on_new_chapter_write_content ON public.chapters;
CREATE TRIGGER on_new_chapter_write_content
  AFTER INSERT ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_write_chapter();
