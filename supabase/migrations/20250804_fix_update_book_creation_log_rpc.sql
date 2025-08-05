-- Migración para agregar el parámetro p_ai_request a la función update_book_creation_log
-- Fecha: 2025-08-04
-- Propósito: Permitir que las funciones de backend guarden los prompts de IA en los logs

-- Eliminar la función existente
DROP FUNCTION IF EXISTS update_book_creation_log(uuid, text, text, text, integer, integer, integer);

-- Recrear la función con el parámetro p_ai_request incluido
CREATE OR REPLACE FUNCTION update_book_creation_log(
    p_log_id uuid,
    p_status text DEFAULT NULL,
    p_ai_request text DEFAULT NULL,
    p_ai_response text DEFAULT NULL,
    p_error_message text DEFAULT NULL,
    p_duration_seconds integer DEFAULT NULL,
    p_word_count integer DEFAULT NULL,
    p_tokens_used integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE book_creation_logs 
    SET 
        status = COALESCE(p_status, status),
        ai_request = COALESCE(p_ai_request, ai_request),
        ai_response = COALESCE(p_ai_response, ai_response),
        error_message = COALESCE(p_error_message, error_message),
        duration_seconds = COALESCE(p_duration_seconds, duration_seconds),
        word_count = COALESCE(p_word_count, word_count),
        tokens_used = COALESCE(p_tokens_used, tokens_used),
        completed_at = CASE 
            WHEN p_status = 'completed' THEN NOW() 
            ELSE completed_at 
        END,
        updated_at = NOW()
    WHERE id = p_log_id;
    
    -- Retornar true si se actualizó al menos una fila
    RETURN FOUND;
END;
$$;

-- Comentario explicativo
COMMENT ON FUNCTION update_book_creation_log IS 'Actualiza un log de creación de libro con parámetros opcionales, incluyendo ai_request para guardar prompts de IA';
