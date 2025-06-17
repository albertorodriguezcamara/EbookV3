-- Crear la tabla jobs
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    status_message TEXT,
    progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    error_message TEXT,
    payload JSONB, -- Para almacenar datos adicionales específicos del job si es necesario
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comentarios para la tabla y columnas
COMMENT ON TABLE public.jobs IS 'Tabla para el seguimiento de trabajos asíncronos, como la creación de libros.';
COMMENT ON COLUMN public.jobs.book_id IS 'ID del libro asociado a este trabajo.';
COMMENT ON COLUMN public.jobs.status IS 'Estado actual del trabajo (pending, processing, completed, failed).';
COMMENT ON COLUMN public.jobs.status_message IS 'Mensaje descriptivo del estado actual.';
COMMENT ON COLUMN public.jobs.progress_percentage IS 'Porcentaje de completitud del trabajo (0-100).';
COMMENT ON COLUMN public.jobs.error_message IS 'Mensaje de error si el trabajo falló.';
COMMENT ON COLUMN public.jobs.payload IS 'Datos adicionales o específicos del tipo de job.';

-- Crear un índice en book_id para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_jobs_book_id ON public.jobs(book_id);

-- Crear un índice en status para filtrar por estado
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at en la tabla jobs
CREATE TRIGGER trigger_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Realtime para la tabla jobs (si aún no está habilitado)
-- Esto se maneja generalmente desde la UI de Supabase o asegurando que la publicación 'supabase_realtime' incluya la tabla.
-- Si se necesita hacer por SQL, sería algo como:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
-- Sin embargo, es mejor verificar la configuración de la publicación existente.
-- Por ahora, asumimos que la publicación por defecto ya cubre nuevas tablas o se ajustará manualmente.

-- Asegurar que RLS está habilitado para la tabla jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para la tabla jobs:
-- Los usuarios autenticados pueden leer los jobs asociados a sus propios libros.
-- (Asumiendo que hay una forma de vincular el job al user_id a través del book_id)
-- Esta política es un ejemplo y puede necesitar ajustes basados en la lógica de la app.

-- Primero, una función auxiliar para obtener el user_id de un libro
CREATE OR REPLACE FUNCTION public.get_book_user_id(p_book_id UUID)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id FROM public.books WHERE id = p_book_id;
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Política para SELECT: los usuarios pueden ver jobs de sus libros
CREATE POLICY "Allow authenticated users to read jobs of their books" 
ON public.jobs 
FOR SELECT 
TO authenticated 
USING (auth.uid() = public.get_book_user_id(book_id));

-- Política para INSERT: los servicios (o funciones de servidor) pueden crear jobs.
-- Esto es más complejo. Normalmente, la inserción de jobs la haría el backend (Edge Functions).
-- Si los usuarios pudieran crear jobs directamente, sería un riesgo.
-- Por ahora, no se crea una política de INSERT permisiva para usuarios.
-- Se asume que las inserciones se harán con el rol 'service_role' desde el backend.

-- Política para UPDATE: similar a INSERT, los updates de progreso los haría el backend.
-- No se crea una política de UPDATE permisiva para usuarios.

-- Política para DELETE: los jobs se borran por ON DELETE CASCADE o por el backend.
-- No se crea una política de DELETE permisiva para usuarios.


-- Considerar añadir políticas para roles específicos si es necesario, por ejemplo, un rol 'admin'.
CREATE POLICY "Allow admin full access to jobs" 
ON public.jobs 
FOR ALL 
TO service_role -- O un rol admin específico si lo tienes
USING (true); -- O una condición específica para admin, ej. get_my_claim('role') = 'admin'


-- Nota: Reemplaza YYYYMMDDHHMMSS con la fecha y hora actual al nombrar el archivo.
-- Ejemplo: 20231027103000_create_jobs_table.sql
