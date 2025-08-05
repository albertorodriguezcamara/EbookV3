-- Migración: Añadir campo book_bible a la tabla books
-- Fecha: 2025-07-30
-- Descripción: Añade campo JSONB para almacenar la "biblia del libro" generada por IA

-- Añadir columna book_bible si no existe
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS book_bible JSONB DEFAULT '{}';

-- Añadir comentario descriptivo
COMMENT ON COLUMN books.book_bible IS 'Biblia del libro generada por IA con personajes, temas, estructura y guías de coherencia';

-- Crear índice para búsquedas eficientes en el book_bible
CREATE INDEX IF NOT EXISTS idx_books_book_bible_gin ON books USING gin(book_bible);

-- Actualizar función de trigger si es necesario para incluir book_bible en logs
-- (Opcional: solo si queremos trackear cambios en el book_bible)

-- Migración completada: Campo book_bible añadido exitosamente
