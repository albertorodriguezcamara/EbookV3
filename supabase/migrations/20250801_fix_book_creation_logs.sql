-- Migración de corrección para book_creation_logs
-- Asegura que la tabla tenga la estructura correcta

-- Primero, verificar si la tabla existe y eliminarla si es necesario
DROP TABLE IF EXISTS public.book_creation_logs CASCADE;

-- Recrear la tabla con la estructura correcta
CREATE TABLE public.book_creation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    step_type TEXT NOT NULL, -- 'book_bible', 'outline', 'chapter', 'cover'
    step_detail TEXT, -- Para capítulos: número o título, para otros: descripción específica
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'error'
    ai_request TEXT, -- El prompt enviado a la IA
    ai_response TEXT, -- La respuesta recibida de la IA
    error_message TEXT, -- Mensaje de error si status = 'error'
    duration_seconds INTEGER, -- Duración del paso en segundos
    word_count INTEGER, -- Número de palabras generadas (para capítulos/bible)
    tokens_used INTEGER, -- Tokens consumidos en la petición
    ai_model TEXT, -- Modelo de IA utilizado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Índices para optimizar consultas
CREATE INDEX idx_book_creation_logs_book_id ON public.book_creation_logs(book_id);
CREATE INDEX idx_book_creation_logs_status ON public.book_creation_logs(status);
CREATE INDEX idx_book_creation_logs_step_type ON public.book_creation_logs(step_type);
CREATE INDEX idx_book_creation_logs_created_at ON public.book_creation_logs(created_at DESC);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_book_creation_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Si el status cambia a 'completed', establecer completed_at
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
        
        -- Calcular duración si no está establecida
        IF NEW.duration_seconds IS NULL THEN
            NEW.duration_seconds = EXTRACT(EPOCH FROM (NOW() - NEW.created_at))::INTEGER;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_book_creation_logs_updated_at
    BEFORE UPDATE ON public.book_creation_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_book_creation_logs_updated_at();

-- RLS (Row Level Security)
ALTER TABLE public.book_creation_logs ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver los logs de sus propios libros
CREATE POLICY "Users can view their own book creation logs" ON public.book_creation_logs
    FOR SELECT USING (
        book_id IN (
            SELECT id FROM public.books 
            WHERE user_id = auth.uid()
        )
    );

-- Política: Solo las funciones del sistema pueden insertar/actualizar logs
CREATE POLICY "System can manage book creation logs" ON public.book_creation_logs
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Función helper para insertar logs desde las Cloud Functions
CREATE OR REPLACE FUNCTION public.insert_book_creation_log(
    p_book_id UUID,
    p_step_type TEXT,
    p_step_detail TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'pending',
    p_ai_request TEXT DEFAULT NULL,
    p_ai_response TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_duration_seconds INTEGER DEFAULT NULL,
    p_word_count INTEGER DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL,
    p_ai_model TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.book_creation_logs (
        book_id, step_type, step_detail, status, ai_request, ai_response,
        error_message, duration_seconds, word_count, tokens_used, ai_model
    ) VALUES (
        p_book_id, p_step_type, p_step_detail, p_status, p_ai_request, p_ai_response,
        p_error_message, p_duration_seconds, p_word_count, p_tokens_used, p_ai_model
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función helper para actualizar logs existentes
CREATE OR REPLACE FUNCTION public.update_book_creation_log(
    p_log_id UUID,
    p_status TEXT DEFAULT NULL,
    p_ai_response TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_duration_seconds INTEGER DEFAULT NULL,
    p_word_count INTEGER DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.book_creation_logs 
    SET 
        status = COALESCE(p_status, status),
        ai_response = COALESCE(p_ai_response, ai_response),
        error_message = COALESCE(p_error_message, error_message),
        duration_seconds = COALESCE(p_duration_seconds, duration_seconds),
        word_count = COALESCE(p_word_count, word_count),
        tokens_used = COALESCE(p_tokens_used, tokens_used)
    WHERE id = p_log_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener el progreso de creación de un libro
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
    
    -- Obtener logs como JSON
    SELECT json_agg(
        json_build_object(
            'id', id,
            'step_type', step_type,
            'step_detail', step_detail,
            'status', status,
            'duration_seconds', duration_seconds,
            'word_count', word_count,
            'error_message', error_message,
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

-- Comentarios para documentación
COMMENT ON TABLE public.book_creation_logs IS 'Registra el progreso y logs de creación de libros en tiempo real';
COMMENT ON COLUMN public.book_creation_logs.step_type IS 'Tipo de paso: book_bible, outline, chapter, cover';
COMMENT ON COLUMN public.book_creation_logs.step_detail IS 'Detalle específico del paso (ej: número de capítulo)';
COMMENT ON COLUMN public.book_creation_logs.status IS 'Estado: pending, in_progress, completed, error';
COMMENT ON COLUMN public.book_creation_logs.ai_request IS 'Prompt enviado a la IA';
COMMENT ON COLUMN public.book_creation_logs.ai_response IS 'Respuesta completa de la IA';
COMMENT ON COLUMN public.book_creation_logs.tokens_used IS 'Tokens consumidos en la petición';
