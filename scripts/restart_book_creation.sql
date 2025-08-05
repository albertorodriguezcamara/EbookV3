-- Script para reactivar la creación de un libro desde donde se detuvo
-- Libro: Daily Grace: A 2025 Devotional for Reflection and Spiritual Growth
-- ID: d78e16b7-e093-451f-af11-80431be225f4
-- Estado: 60 capítulos creados, necesita continuar desde capítulo 61

-- 1. Crear un nuevo job para continuar la generación
INSERT INTO jobs (
    id,
    book_id,
    status,
    status_message,
    progress_percentage,
    payload,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'd78e16b7-e093-451f-af11-80431be225f4',
    'pending',
    'Reiniciando generación desde capítulo 61 - optimización aplicada',
    0,
    jsonb_build_object(
        'action', 'continue_outline_generation',
        'start_chapter', 61,
        'restart_reason', 'timeout_recovery_with_optimization'
    ),
    NOW(),
    NOW()
);

-- 2. Crear log de reinicio
INSERT INTO book_creation_logs (
    id,
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
    gen_random_uuid(),
    'd78e16b7-e093-451f-af11-80431be225f4',
    'outline',
    'Proceso reiniciado manualmente desde capítulo 61 con optimización de contexto',
    'completed',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'Sistema',
    NOW(),
    NOW()
);

-- 3. Verificar estado actual del libro
SELECT 
    'Estado del libro:' as info,
    b.title,
    COUNT(c.id) as chapters_created,
    MAX(c.order_number) as last_chapter,
    b.target_number_of_chapters,
    CASE 
        WHEN b.target_number_of_chapters IS NULL THEN 'No definido'
        ELSE (COUNT(c.id)::text || '/' || b.target_number_of_chapters::text)
    END as progress
FROM books b
LEFT JOIN chapters c ON b.id = c.book_id
WHERE b.id = 'd78e16b7-e093-451f-af11-80431be225f4'
GROUP BY b.id, b.title, b.target_number_of_chapters;

-- 4. Verificar último job creado
SELECT 
    'Último job creado:' as info,
    id,
    status,
    status_message,
    created_at
FROM jobs 
WHERE book_id = 'd78e16b7-e093-451f-af11-80431be225f4'
ORDER BY created_at DESC 
LIMIT 1;
