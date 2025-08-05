-- =====================================================
-- MIGRACIÓN: Crear función RPC insert_book_creation_log
-- Fecha: 2025-08-04
-- Descripción: Crear función para insertar logs intermedios separados
--              que permitan mostrar el progreso en tiempo real en el frontend.
-- =====================================================

-- Crear función RPC para insertar logs intermedios
CREATE OR REPLACE FUNCTION public.insert_book_creation_log(
  p_book_id UUID,
  p_step_type TEXT,
  p_step_detail TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'in_progress',
  p_ai_request TEXT DEFAULT NULL,
  p_ai_response TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_duration_seconds INTEGER DEFAULT NULL,
  p_word_count INTEGER DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT NULL,
  p_ai_model TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Insertar nuevo log y retornar el ID
  INSERT INTO public.book_creation_logs (
    book_id,
    step_type,
    step_detail,
    status,
    ai_request,
    ai_response,
    error_message,
    duration_seconds,
    word_count,
    tokens_used,
    ai_model,
    created_at,
    updated_at
  ) VALUES (
    p_book_id,
    p_step_type,
    p_step_detail,
    p_status,
    p_ai_request,
    p_ai_response,
    p_error_message,
    p_duration_seconds,
    p_word_count,
    p_tokens_used,
    p_ai_model,
    NOW(),
    NOW()
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION public.insert_book_creation_log IS 
'Función RPC para insertar logs intermedios separados durante la creación de libros, permitiendo mostrar el progreso en tiempo real en el frontend.';

-- =====================================================
-- RESUMEN DE LA FUNCIÓN:
-- 
-- ✅ PERMITE: Crear logs intermedios separados para cada paso
-- ✅ RETORNA: UUID del log creado para referencias futuras
-- ✅ FLEXIBLE: Todos los parámetros opcionales excepto book_id, step_type
-- ✅ SEGURIDAD: SECURITY DEFINER para bypass de RLS
-- ✅ TIEMPO REAL: Los logs aparecerán inmediatamente en el frontend
-- 
-- USO TÍPICO:
-- SELECT insert_book_creation_log(
--   'book-uuid',
--   'book_bible',
--   'Enviando prompt a IA...',
--   'in_progress',
--   'PROMPT TEXT...',
--   NULL
-- );
-- =====================================================
