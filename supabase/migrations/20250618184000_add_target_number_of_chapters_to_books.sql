-- Añade la columna target_number_of_chapters a la tabla books para almacenar el número deseado de capítulos
-- y facilitar su uso en las funciones Edge.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'books'
          AND column_name = 'target_number_of_chapters'
    ) THEN
        ALTER TABLE public.books
            ADD COLUMN target_number_of_chapters integer;
    END IF;
END $$;

-- No se crea índice: la columna se consulta por id de libro, el índice primario es suficiente.
