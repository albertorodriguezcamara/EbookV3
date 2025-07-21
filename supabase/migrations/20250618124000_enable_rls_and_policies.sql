-- 1. Habilitar RLS en las tablas clave
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_logs ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas antiguas (si existen) para una aplicación limpia
DROP POLICY IF EXISTS "Users can view their own books." ON public.books;
DROP POLICY IF EXISTS "Users can insert their own books." ON public.books;
DROP POLICY IF EXISTS "Users can update their own books." ON public.books;
DROP POLICY IF EXISTS "Users can delete their own books." ON public.books;

DROP POLICY IF EXISTS "Users can view their own jobs." ON public.jobs;
DROP POLICY IF EXISTS "Users can view their own chapters." ON public.chapters;
DROP POLICY IF EXISTS "Users can view their own creation logs." ON public.creation_logs;

-- 3. Políticas para la tabla 'books'
-- Los usuarios pueden ver sus propios libros.
CREATE POLICY "Users can view their own books."
ON public.books FOR SELECT
USING (auth.uid() = user_id);

-- Los usuarios pueden crear libros para sí mismos.
CREATE POLICY "Users can insert their own books."
ON public.books FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar sus propios libros.
CREATE POLICY "Users can update their own books."
ON public.books FOR UPDATE
USING (auth.uid() = user_id);

-- Los usuarios pueden borrar sus propios libros.
CREATE POLICY "Users can delete their own books."
ON public.books FOR DELETE
USING (auth.uid() = user_id);

-- 4. Políticas para tablas relacionadas (jobs, chapters, creation_logs)
-- El acceso se basa en la propiedad del libro principal.

-- Los usuarios solo pueden ver los jobs de sus libros.
CREATE POLICY "Users can view their own jobs."
ON public.jobs FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.books
    WHERE books.id = jobs.book_id AND books.user_id = auth.uid()
  )
);

-- Los usuarios solo pueden ver los capítulos de sus libros.
CREATE POLICY "Users can view their own chapters."
ON public.chapters FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.books
    WHERE books.id = chapters.book_id AND books.user_id = auth.uid()
  )
);

-- Los usuarios solo pueden ver los logs de sus libros.
CREATE POLICY "Users can view their own creation logs."
ON public.creation_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.books
    WHERE books.id = creation_logs.book_id AND books.user_id = auth.uid()
  )
);
