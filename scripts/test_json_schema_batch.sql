-- Script para probar la nueva implementación con JSON Schema estructurado
-- Crear un libro de prueba pequeño para validar el procesamiento por lotes

-- 1. Crear libro de prueba
INSERT INTO books (
    id,
    title,
    target_number_of_chapters,
    language,
    ai_model_id,
    user_id,
    created_at,
    updated_at,
    status
) VALUES (
    'test-json-schema-' || extract(epoch from now())::text,
    'Libro de Prueba - JSON Schema Estructurado',
    8, -- Solo 8 capítulos para prueba rápida
    'es',
    (SELECT id FROM ai_models WHERE name LIKE '%gemini-2.5%' LIMIT 1),
    'alberto.rodriguez.camara@gmail.com',
    now(),
    now(),
    'draft'
) 
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    updated_at = now();

-- 2. Obtener el ID del libro creado
DO $$
DECLARE
    test_book_id TEXT;
    test_job_id TEXT;
BEGIN
    -- Obtener el libro de prueba más reciente
    SELECT id INTO test_book_id 
    FROM books 
    WHERE title LIKE '%JSON Schema Estructurado%' 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Generar ID único para el job
    test_job_id := 'job-json-schema-test-' || extract(epoch from now())::text;
    
    -- 3. Crear job para generar esquema
    INSERT INTO jobs (
        id,
        book_id,
        job_type,
        status,
        batch_size,
        created_at,
        updated_at,
        status_message
    ) VALUES (
        test_job_id,
        test_book_id,
        'generate_outline',
        'pending',
        8, -- Procesar todos los capítulos en un solo lote
        now(),
        now(),
        'Listo para probar JSON Schema estructurado'
    );
    
    -- Mostrar información del test
    RAISE NOTICE 'TEST CREADO:';
    RAISE NOTICE 'Book ID: %', test_book_id;
    RAISE NOTICE 'Job ID: %', test_job_id;
    RAISE NOTICE 'Capítulos objetivo: 8 (lote único)';
    RAISE NOTICE '';
    RAISE NOTICE 'Para ejecutar el test, llama a la función Cloud con:';
    RAISE NOTICE 'POST https://europe-west1-export-document-pro.cloudfunctions.net/generate-book-outline';
    RAISE NOTICE 'Body: {"job_id": "%", "book_id": "%"}', test_job_id, test_book_id;
END $$;

-- 4. Verificar configuración
SELECT 
    b.id as book_id,
    b.title,
    b.target_number_of_chapters,
    am.name as ai_model,
    ap.name as ai_provider,
    j.id as job_id,
    j.status as job_status,
    j.batch_size
FROM books b
JOIN ai_models am ON b.ai_model_id = am.id
JOIN ai_providers ap ON am.ai_provider_id = ap.id
JOIN jobs j ON j.book_id = b.id
WHERE b.title LIKE '%JSON Schema Estructurado%'
ORDER BY b.created_at DESC
LIMIT 1;
