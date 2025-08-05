-- Migración para implementar galería de portadas
-- Permite múltiples portadas por libro con historial completo

-- Crear tabla para almacenar múltiples portadas por libro
CREATE TABLE IF NOT EXISTS public.book_covers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_path TEXT NOT NULL, -- Ruta en Supabase Storage
    is_active BOOLEAN DEFAULT false, -- Solo una portada puede estar activa por libro
    model_used TEXT, -- Modelo de IA usado para generar esta portada
    provider_used TEXT, -- Proveedor de IA usado (Recraft, OpenAI, etc.)
    generation_prompt TEXT, -- Prompt usado para generar la imagen
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX idx_book_covers_book_id ON public.book_covers(book_id);
CREATE INDEX idx_book_covers_active ON public.book_covers(book_id, is_active) WHERE is_active = true;
CREATE INDEX idx_book_covers_created_at ON public.book_covers(created_at DESC);

-- RLS (Row Level Security) para book_covers
ALTER TABLE public.book_covers ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo puedan ver/editar portadas de sus propios libros
CREATE POLICY "Users can view covers of their own books" ON public.book_covers
    FOR SELECT USING (
        book_id IN (
            SELECT id FROM public.books WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert covers for their own books" ON public.book_covers
    FOR INSERT WITH CHECK (
        book_id IN (
            SELECT id FROM public.books WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update covers of their own books" ON public.book_covers
    FOR UPDATE USING (
        book_id IN (
            SELECT id FROM public.books WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete covers of their own books" ON public.book_covers
    FOR DELETE USING (
        book_id IN (
            SELECT id FROM public.books WHERE user_id = auth.uid()
        )
    );

-- Función para asegurar que solo una portada esté activa por libro
CREATE OR REPLACE FUNCTION ensure_single_active_cover()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se está marcando una portada como activa
    IF NEW.is_active = true THEN
        -- Desactivar todas las otras portadas del mismo libro
        UPDATE public.book_covers 
        SET is_active = false, updated_at = NOW()
        WHERE book_id = NEW.book_id AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para ejecutar la función
CREATE TRIGGER trigger_ensure_single_active_cover
    BEFORE INSERT OR UPDATE ON public.book_covers
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_active_cover();

-- Migrar portadas existentes de la tabla books a book_covers
INSERT INTO public.book_covers (book_id, image_url, image_path, is_active, created_at)
SELECT 
    id as book_id,
    cover_image_url as image_url,
    CASE 
        WHEN cover_image_url LIKE '%/book-covers/%' THEN 
            substring(cover_image_url from 'book-covers/(.+)')
        ELSE 
            'covers/' || id || '_migrated.png'
    END as image_path,
    true as is_active, -- La portada actual se marca como activa
    created_at
FROM public.books 
WHERE cover_image_url IS NOT NULL AND cover_image_url != '';

-- Función para obtener la portada activa de un libro (para compatibilidad)
CREATE OR REPLACE FUNCTION get_active_cover_url(book_id_param UUID)
RETURNS TEXT AS $$
DECLARE
    cover_url TEXT;
BEGIN
    SELECT image_url INTO cover_url
    FROM public.book_covers
    WHERE book_id = book_id_param AND is_active = true
    LIMIT 1;
    
    RETURN cover_url;
END;
$$ LANGUAGE plpgsql;

-- Vista para mantener compatibilidad con consultas existentes
CREATE OR REPLACE VIEW books_with_active_cover AS
SELECT 
    b.*,
    bc.image_url as active_cover_url,
    bc.id as active_cover_id
FROM public.books b
LEFT JOIN public.book_covers bc ON b.id = bc.book_id AND bc.is_active = true;

-- Comentarios para documentación
COMMENT ON TABLE public.book_covers IS 'Almacena múltiples portadas por libro con historial completo';
COMMENT ON COLUMN public.book_covers.is_active IS 'Solo una portada puede estar activa por libro';
COMMENT ON COLUMN public.book_covers.model_used IS 'Modelo de IA usado para generar esta portada';
COMMENT ON COLUMN public.book_covers.generation_prompt IS 'Prompt usado para generar la imagen';
COMMENT ON FUNCTION ensure_single_active_cover() IS 'Asegura que solo una portada esté activa por libro';
COMMENT ON FUNCTION get_active_cover_url(UUID) IS 'Obtiene la URL de la portada activa de un libro';
COMMENT ON VIEW books_with_active_cover IS 'Vista para compatibilidad con consultas existentes';
