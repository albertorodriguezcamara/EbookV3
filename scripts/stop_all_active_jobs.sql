-- SCRIPT PARA DETENER TODOS LOS JOBS ACTIVOS
-- Fecha: 2025-08-04
-- Descripción: Detiene todos los jobs en estado 'processing' o 'pending' que están causando colisiones

-- 1. ACTUALIZAR TODOS LOS JOBS ACTIVOS A 'FAILED' (PAUSADOS MANUALMENTE)
UPDATE jobs 
SET 
    status = 'failed',
    status_message = '🛑 PAUSADO MANUALMENTE para evitar colisiones - ' || COALESCE(status_message, 'Sin mensaje previo'),
    updated_at = NOW()
WHERE status IN ('processing', 'pending');

-- 2. VERIFICAR LOS JOBS QUE FUERON PAUSADOS (AHORA EN STATUS 'FAILED')
SELECT 
    id,
    book_id,
    status,
    status_message,
    progress_percentage,
    created_at,
    updated_at
FROM jobs 
WHERE status_message LIKE '%PAUSADO MANUALMENTE%'
ORDER BY updated_at DESC;

-- 3. OPCIONAL: Ver resumen de jobs por estado
SELECT 
    status,
    COUNT(*) as total_jobs,
    MIN(created_at) as oldest_job,
    MAX(updated_at) as most_recent_update
FROM jobs 
GROUP BY status 
ORDER BY total_jobs DESC;

-- JOBS ESPECÍFICOS QUE SERÁN PAUSADOS:
-- c22c657a-da1c-4aff-9477-e173da7e4667 (book: 63313691-c23d-4eb7-bf03-f21872978a87) - Generando esquema 1-20
-- 08bfbd6a-25ac-4fda-a4c3-4851d07ffcb0 (book: f8eddfa1-8ca2-4094-a6bb-d83359cceb36) - Generando portada
-- 4b508890-2995-4755-abee-2d2d2da07123 (book: 90b8c153-d112-449d-9ca3-af5796c248b2) - Generando portada
-- 24612d35-69e1-434c-aaaa-3966bbbd1e11 (book: 3c7d5daa-7e5e-4c19-9110-711681bf5caf) - Generando esquema 1-20
-- 888e3035-d50c-4302-a4af-5815e5e5377a (book: 642993b3-1399-44b6-b107-07a60b55551a) - Generando esquema 1-5
-- c8dd3c97-04b5-4995-aee8-e53525868e27 (book: 92d5c9f0-7cd0-4be0-bb05-ed860bfaa968) - Generando esquema 1-5
-- 8a668c85-d568-43d5-be5f-3da49dc5fcc3 (book: dedb67d5-32a3-4737-8e5a-bafee8f649fa) - Generando esquema 1-5
-- d15eae69-233c-4dfe-8842-edd47cc6d3a7 (book: 5451ad10-a72c-4b8a-9b08-df699c7f9e3a) - Generando esquema 1-5
-- 4188813a-6781-462a-9526-1d69fd8c72af (book: 2daac448-246d-4e34-a7ef-bfa942e7619e) - Generando esquema 1-20
-- 9f645a2d-5e00-4725-b8a1-7641c655517b (book: 808339cd-bc38-455f-ac19-b340e23c5de5) - Generando esquema 1-20
