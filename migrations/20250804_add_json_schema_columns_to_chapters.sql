-- Migración para añadir las columnas del JSON Schema estructurado a la tabla chapters
-- Fecha: 2025-08-04
-- Descripción: Añade columnas para almacenar narrative_function, emotional_intensity, key_elements y connections

-- 1. AÑADIR NUEVAS COLUMNAS A LA TABLA CHAPTERS
ALTER TABLE chapters 
ADD COLUMN IF NOT EXISTS narrative_function TEXT,
ADD COLUMN IF NOT EXISTS emotional_intensity INTEGER CHECK (emotional_intensity >= 1 AND emotional_intensity <= 10),
ADD COLUMN IF NOT EXISTS key_elements JSONB,
ADD COLUMN IF NOT EXISTS connections JSONB;

-- 2. AÑADIR COMENTARIOS PARA DOCUMENTAR LAS COLUMNAS
COMMENT ON COLUMN chapters.narrative_function IS 'Función narrativa específica del capítulo (ej: "desarrollo de personaje", "clímax", "resolución")';
COMMENT ON COLUMN chapters.emotional_intensity IS 'Intensidad emocional objetivo del capítulo en escala 1-10';
COMMENT ON COLUMN chapters.key_elements IS 'Array JSON de elementos clave que debe incluir el capítulo';
COMMENT ON COLUMN chapters.connections IS 'JSON con conexiones narrativas: {"references_previous": [1,2], "sets_up_future": [5,6]}';

-- 3. CREAR ÍNDICES PARA OPTIMIZAR CONSULTAS
CREATE INDEX IF NOT EXISTS idx_chapters_emotional_intensity ON chapters(emotional_intensity);
CREATE INDEX IF NOT EXISTS idx_chapters_key_elements ON chapters USING GIN(key_elements);
CREATE INDEX IF NOT EXISTS idx_chapters_connections ON chapters USING GIN(connections);

-- 4. VERIFICAR LA ESTRUCTURA ACTUALIZADA
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'chapters' 
AND table_schema = 'public'
AND column_name IN ('narrative_function', 'emotional_intensity', 'key_elements', 'connections')
ORDER BY column_name;
