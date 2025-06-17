-- Añadir la columna book_attributes a la tabla books
ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS book_attributes JSONB;

-- Comentario para la nueva columna
COMMENT ON COLUMN public.books.book_attributes IS 'Atributos dinámicos del libro, capturados durante el wizard de creación.';

-- Asegurar que la tabla books tenga una columna updated_at
ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Crear la función para actualizar updated_at si no existe una genérica
-- (Reutilizar la de la migración de jobs si es la misma o crear una específica si se prefiere)
-- CREATE OR REPLACE FUNCTION public.update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--    NEW.updated_at = now();
--    RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- Crear el trigger para actualizar updated_at en la tabla books si no existe
-- Comprobar primero si ya existe un trigger similar para no duplicarlo.
DO $$
BEGIN
   IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'trigger_books_updated_at'
   ) THEN
      CREATE TRIGGER trigger_books_updated_at
      BEFORE UPDATE ON public.books
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column(); -- Asegúrate que esta función existe y es correcta
   END IF;
END
$$;

-- Nota: Reemplaza YYYYMMDDHHMMSS con la fecha y hora actual al nombrar el archivo.
-- Ejemplo: 20231027103500_add_book_attributes_to_books.sql
