-- Añade la columna book_id a book_creation_requests para vincular la petición con el libro definitivo
-- y facilitar las suscripciones/consultas desde el frontend.

-- Solo crear la columna si no existe (idempotencia al aplicar varias veces en entornos distintos)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'book_creation_requests'
          AND column_name = 'book_id'
    ) THEN
        ALTER TABLE public.book_creation_requests
            ADD COLUMN book_id uuid REFERENCES public.books(id);
    END IF;
END $$;

-- Índice para acelerar búsquedas por book_id (consultas y realtime ﬁlter)
CREATE INDEX IF NOT EXISTS book_creation_requests_book_id_idx
    ON public.book_creation_requests(book_id);
