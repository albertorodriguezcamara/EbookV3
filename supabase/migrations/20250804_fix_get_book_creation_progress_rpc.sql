-- Migración para corregir la función get_book_creation_progress
-- Añade los campos ai_request y ai_response que faltan para mostrar contenido de IA en el frontend

-- Función corregida para obtener el progreso de creación de un libro
CREATE OR REPLACE FUNCTION public.get_book_creation_progress(p_book_id UUID)
RETURNS TABLE (
    total_steps INTEGER,
    completed_steps INTEGER,
    current_step TEXT,
    progress_percentage NUMERIC,
    estimated_time_remaining INTEGER,
    logs JSON
) AS $$
DECLARE
    book_chapters INTEGER;
    total_expected_steps INTEGER;
    completed_count INTEGER;
    current_step_text TEXT;
    logs_json JSON;
BEGIN
    -- Obtener número de capítulos esperados del libro
    SELECT target_number_of_chapters INTO book_chapters
    FROM public.books WHERE id = p_book_id;
    
    -- Calcular pasos totales esperados: 1 (bible) + 1 (outline) + N (chapters) + 1 (cover opcional)
    total_expected_steps := 2 + COALESCE(book_chapters, 10);
    
    -- Contar pasos completados
    SELECT COUNT(*) INTO completed_count
    FROM public.book_creation_logs 
    WHERE book_id = p_book_id AND status = 'completed';
    
    -- Obtener paso actual
    SELECT COALESCE(step_type || COALESCE(' - ' || step_detail, ''), 'Iniciando...')
    INTO current_step_text
    FROM public.book_creation_logs 
    WHERE book_id = p_book_id AND status = 'in_progress'
    ORDER BY created_at DESC LIMIT 1;
    
    -- Obtener logs como JSON (CORREGIDO: incluye ai_request y ai_response)
    SELECT json_agg(
        json_build_object(
            'id', id,
            'step_type', step_type,
            'step_detail', step_detail,
            'status', status,
            'duration_seconds', duration_seconds,
            'word_count', word_count,
            'error_message', error_message,
            'ai_request', ai_request,
            'ai_response', ai_response,
            'tokens_used', tokens_used,
            'ai_model', ai_model,
            'created_at', created_at,
            'completed_at', completed_at
        ) ORDER BY created_at DESC
    ) INTO logs_json
    FROM public.book_creation_logs 
    WHERE book_id = p_book_id;
    
    RETURN QUERY SELECT 
        total_expected_steps,
        completed_count,
        COALESCE(current_step_text, 'Completado'),
        ROUND((completed_count::NUMERIC / total_expected_steps::NUMERIC) * 100, 1),
        NULL::INTEGER, -- TODO: calcular tiempo estimado basado en promedios
        COALESCE(logs_json, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario de la corrección
COMMENT ON FUNCTION public.get_book_creation_progress IS 'Obtiene el progreso de creación de un libro incluyendo logs detallados con contenido de IA (ai_request y ai_response)';
