-- Aseguramos que las políticas de acceso a books y jobs están correctamente configuradas
-- para permitir lecturas a usuarios autenticados

-- Verificar y corregir políticas para la tabla books
DO $$
BEGIN
    -- Eliminar políticas duplicadas o conflictivas si existen
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."books";
    
    -- Crear política de lectura para usuarios autenticados
    CREATE POLICY "Enable read access for authenticated users" 
    ON "public"."books"
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
END
$$;

-- Verificar y corregir políticas para la tabla jobs
DO $$
BEGIN
    -- Eliminar políticas duplicadas o conflictivas si existen
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."jobs";
    
    -- Crear política de lectura para usuarios autenticados
    CREATE POLICY "Enable read access for authenticated users" 
    ON "public"."jobs"
    FOR SELECT
    TO authenticated
    USING (book_id IN (
        SELECT id FROM public.books WHERE user_id = auth.uid()
    ));
END
$$;
