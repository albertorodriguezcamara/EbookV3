-- =====================================================
-- MIGRACIÓN: Corregir trigger_generate_outline para filtrar por tipo de job
-- Fecha: 2025-07-30
-- Descripción: La función trigger_generate_outline se dispara para TODOS los jobs
--              incluyendo jobs de portada, causando reescritura innecesaria de capítulos.
--              Esta migración añade filtros para que solo procese jobs de esquema.
-- =====================================================

-- Actualizar la función trigger_generate_outline para filtrar por tipo de job
CREATE OR REPLACE FUNCTION public.trigger_generate_outline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
DECLARE
  -- URL actualizada de Google Cloud Functions con procesamiento por lotes
  v_url text := 'https://europe-west1-export-document-project.cloudfunctions.net/generate-book-outline';
  v_payload jsonb;
  v_headers jsonb;
  v_request_id bigint;
  v_job_type text;
BEGIN
  -- Solo procesar jobs que estén en estado 'pending'
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Obtener el tipo de job del payload
  v_job_type := NEW.payload->>'type';
  
  -- FILTRO CRÍTICO: Solo procesar jobs de esquema/outline, NO jobs de portada
  IF v_job_type IS NULL OR v_job_type NOT IN ('generate_outline', 'create_book') THEN
    -- Log para debugging: job ignorado
    INSERT INTO public.creation_logs (book_id, message) 
    VALUES (
      NEW.book_id, 
      '🔄 Job ignorado por trigger_generate_outline: tipo=' || COALESCE(v_job_type, 'NULL') || ', job_id=' || NEW.id::text
    );
    
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
  -- Timeout extendido para libros grandes (15 minutos)
  SELECT net.http_post(
    url := v_url,
    headers := v_headers,
    body := v_payload,
    timeout_milliseconds := 900000  -- 15 minutos timeout
  ) INTO v_request_id;

  -- Log de la invocación para debugging
  INSERT INTO public.creation_logs (book_id, message) 
  VALUES (
    NEW.book_id, 
    '🚀 Esquema iniciado via Google Cloud Functions (job_id: ' || NEW.id::text || ', request_id: ' || v_request_id || ')'
  );

  RETURN NEW;
END;
$$;

-- Comentario de la función actualizada
COMMENT ON FUNCTION public.trigger_generate_outline() IS 
'Función actualizada que filtra jobs por tipo para evitar que jobs de portada disparen la generación de esquemas y reescritura de capítulos.';

-- =====================================================
-- RESUMEN DE CAMBIOS:
-- 
-- ✅ AÑADIDO: Filtro por tipo de job (solo 'generate_outline' y 'create_book')
-- ✅ BLOQUEADO: Jobs de portada ('generate_cover_manual') ya no disparan esquemas
-- ✅ MEJORADO: Logging detallado para debugging de jobs ignorados
-- ✅ MANTENIDO: Funcionalidad original para jobs de esquema
-- 
-- PROBLEMA RESUELTO:
-- - La regeneración manual de portada ya NO dispara reescritura de capítulos
-- - Solo jobs de esquema/creación de libro disparan el procesamiento batch
-- - Se mantiene el logging para poder hacer debugging si es necesario
-- =====================================================
