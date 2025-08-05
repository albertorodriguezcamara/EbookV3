-- =====================================================
-- MIGRACIÓN: Corregir sintaxis de vault.get_secret en trigger_generate_outline
-- Fecha: 2025-07-30
-- Descripción: La migración anterior usó vault.get_secret() que no existe.
--              Esta migración corrige la sintaxis para usar vault.decrypted_secrets
--              como se hace en las migraciones anteriores funcionando.
-- =====================================================

-- Actualizar la función trigger_generate_outline con la sintaxis correcta del vault
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
  
  -- FILTRO CORREGIDO: Permitir jobs sin tipo (creación inicial) y jobs de esquema
  -- Excluir específicamente jobs de portada y otros tipos no relacionados con esquemas
  IF v_job_type IS NOT NULL AND v_job_type IN ('generate_cover', 'export_docx', 'export_pdf') THEN
    -- Log para debugging: job ignorado
    INSERT INTO public.creation_logs (book_id, message) 
    VALUES (
      NEW.book_id, 
      '🔄 Job ignorado por trigger_generate_outline: tipo=' || v_job_type || ', job_id=' || NEW.id::text
    );
    
    RETURN NEW;
  END IF;

  -- Log para debugging: job procesado
  INSERT INTO public.creation_logs (book_id, message) 
  VALUES (
    NEW.book_id, 
    '🚀 Job procesado por trigger_generate_outline: tipo=' || COALESCE(v_job_type, 'NULL (creación inicial)') || ', job_id=' || NEW.id::text
  );

  -- Construir payload con los mismos parámetros que espera la función
  v_payload := jsonb_build_object(
    'book_id', NEW.book_id, 
    'job_id', NEW.id
  );
  
  -- Construir headers con autorización usando la sintaxis correcta del vault
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      SELECT decrypted_secret 
      FROM vault.decrypted_secrets 
      WHERE name = 'service_role_key' 
      LIMIT 1
    )
  );

  -- Realizar la llamada HTTP a Google Cloud Functions con timeout extendido (15 minutos)
  SELECT net.http_post(
    url := v_url,
    headers := v_headers,
    body := v_payload,
    timeout_milliseconds := 900000  -- 15 minutos para libros grandes
  ) INTO v_request_id;

  -- Log de éxito
  INSERT INTO public.creation_logs (book_id, message) 
  VALUES (
    NEW.book_id, 
    '📡 Llamada HTTP enviada a Google Cloud Functions para generar esquema. Request ID: ' || v_request_id::text
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log del error
    INSERT INTO public.creation_logs (book_id, message) 
    VALUES (
      NEW.book_id, 
      '❌ Error en trigger_generate_outline: ' || SQLERRM
    );
    
    -- Actualizar el job como fallido
    UPDATE public.jobs 
    SET 
      status = 'failed',
      status_message = 'Error en trigger de generación de esquema: ' || SQLERRM,
      updated_at = NOW()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_generate_outline() IS 
'Trigger que se ejecuta al insertar un job para llamar a Google Cloud Functions y generar el esquema del libro. 
Filtro corregido: permite jobs sin tipo (creación inicial) y excluye específicamente jobs de portada y exportación.
Sintaxis corregida: usa vault.decrypted_secrets en lugar de vault.get_secret().
Timeout extendido a 15 minutos para libros grandes.
Versión: 2025-07-30 - Sintaxis vault corregida';

-- =====================================================
-- RESUMEN DE CAMBIOS
-- =====================================================

-- ✅ CORREGIDO: Sintaxis del vault para obtener service_role_key
-- ✅ MANTENIDO: Filtro corregido para permitir creación inicial
-- ✅ MANTENIDO: Logging detallado para debugging de jobs procesados e ignorados
-- ✅ MANTENIDO: Manejo de errores con actualización de estado del job
-- ✅ MANTENIDO: Timeout extendido a 15 minutos para libros grandes

-- FLUJO CORREGIDO:
-- 1. books (INSERT) → job (INSERT) → trigger_generate_outline() → Google Cloud: generate-book-outline
-- 2. Jobs sin tipo o con tipo válido se procesan
-- 3. Jobs de portada/exportación se ignoran específicamente
-- 4. Sintaxis correcta del vault para obtener service_role_key
-- 5. Logging detallado para debugging
