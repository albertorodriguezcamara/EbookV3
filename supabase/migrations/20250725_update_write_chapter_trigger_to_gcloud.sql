-- Migración para actualizar el trigger write-chapter-content para usar Google Cloud Functions
-- Fecha: 2025-07-25
-- Propósito: Cambiar la URL del trigger para llamar a la función migrada en Google Cloud
-- ACTUALIZACIÓN: Agregar rate limiting para evitar bloqueos por demasiadas llamadas HTTP concurrentes

-- Crear tabla para cola de procesamiento de capítulos (si no existe)
CREATE TABLE IF NOT EXISTS public.chapter_processing_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id),
  job_id uuid NOT NULL REFERENCES public.jobs(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  error_message text
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_chapter_queue_status ON public.chapter_processing_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_chapter_queue_chapter ON public.chapter_processing_queue(chapter_id);

-- Función mejorada del trigger con rate limiting
CREATE OR REPLACE FUNCTION public.trigger_write_chapter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_job_id uuid;
  v_pending_count integer;
  v_processing_count integer;
BEGIN
  -- Solo procesar si el capítulo no tiene contenido
  IF NEW.content IS NOT NULL AND LENGTH(trim(NEW.content)) > 0 THEN
    RETURN NEW;
  END IF;

  -- Buscar el job activo para este libro
  SELECT id INTO v_job_id
  FROM public.jobs
  WHERE book_id = NEW.book_id AND status = 'processing'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Si no hay job activo, no hacer nada
  IF v_job_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar si ya está en la cola
  IF EXISTS (SELECT 1 FROM public.chapter_processing_queue WHERE chapter_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Contar capítulos pendientes y en procesamiento para rate limiting
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'processing')
  INTO v_pending_count, v_processing_count
  FROM public.chapter_processing_queue
  WHERE job_id = v_job_id;

  -- Rate limiting: máximo 10 capítulos en procesamiento simultáneo
  IF v_processing_count >= 10 THEN
    -- Agregar a la cola para procesamiento posterior
    INSERT INTO public.chapter_processing_queue (chapter_id, job_id, status)
    VALUES (NEW.id, v_job_id, 'pending');
    
    INSERT INTO public.creation_logs (book_id, message) 
    VALUES (NEW.book_id, 'Capítulo "' || NEW.title || '" agregado a cola (rate limiting activo)');
    
    RETURN NEW;
  END IF;

  -- Procesar inmediatamente si hay capacidad
  PERFORM public.process_chapter_immediately(NEW.id, v_job_id);
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log del error para debugging
    INSERT INTO public.creation_logs (book_id, message) 
    VALUES (NEW.book_id, 'ERROR en trigger_write_chapter: ' || SQLERRM);
    RETURN NEW;
END;
$$;

-- Función para procesar un capítulo inmediatamente
CREATE OR REPLACE FUNCTION public.process_chapter_immediately(p_chapter_id uuid, p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_url text := 'https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content';
  v_payload jsonb;
  v_headers jsonb;
  v_request_id bigint;
  v_book_id uuid;
  v_title text;
BEGIN
  -- Obtener información del capítulo
  SELECT book_id, title INTO v_book_id, v_title
  FROM public.chapters
  WHERE id = p_chapter_id;

  -- Agregar a la cola como 'processing'
  INSERT INTO public.chapter_processing_queue (chapter_id, job_id, status)
  VALUES (p_chapter_id, p_job_id, 'processing')
  ON CONFLICT (chapter_id) DO UPDATE SET 
    status = 'processing',
    processed_at = now();

  -- Construir payload
  v_payload := jsonb_build_object('chapter_id', p_chapter_id, 'job_id', p_job_id);
  
  -- Construir headers
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
  );

  -- Realizar la llamada HTTP a Google Cloud Functions
  SELECT net.http_post(
    url := v_url,
    headers := v_headers,
    body := v_payload
  ) INTO v_request_id;

  -- Log de la invocación
  INSERT INTO public.creation_logs (book_id, message) 
  VALUES (v_book_id, 'Procesando capítulo "' || v_title || '" via Google Cloud Functions (request_id: ' || v_request_id || ')');

EXCEPTION
  WHEN OTHERS THEN
    -- Marcar como fallido en la cola
    UPDATE public.chapter_processing_queue 
    SET status = 'failed', error_message = SQLERRM, processed_at = now()
    WHERE chapter_id = p_chapter_id;
    
    INSERT INTO public.creation_logs (book_id, message) 
    VALUES (v_book_id, 'ERROR procesando capítulo: ' || SQLERRM);
END;
$$;

-- El trigger ya existe, no necesitamos recrearlo, solo actualizar la función
-- DROP TRIGGER IF EXISTS on_new_chapter_write_content ON public.chapters;
-- CREATE TRIGGER on_new_chapter_write_content
--   AFTER INSERT ON public.chapters
--   FOR EACH ROW
--   WHEN (NEW.content IS NULL)
--   EXECUTE FUNCTION public.trigger_write_chapter();

-- Comentario informativo
COMMENT ON FUNCTION public.trigger_write_chapter() IS 
'Trigger function actualizada para llamar a write-chapter-content en Google Cloud Functions. 
URL: https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content
Migrado desde Supabase Edge Functions el 2025-07-25 para evitar timeouts con libros grandes.';
