-- Limpiar políticas RLS duplicadas en la tabla 'books'

-- Las políticas en Supabase a menudo se nombran automáticamente como 'policy_name_1', 'policy_name_2', etc.
-- si se crean desde la UI con el mismo nombre. Identificaremos y eliminaremos las duplicadas.
-- Asumimos que los nombres son predecibles o los encontramos con una consulta previa.
-- En este caso, los nombres son casi idénticos, diferenciados por un punto final.

-- Eliminar políticas de DELETE duplicadas
-- Dejamos la que no tiene punto al final.
DROP POLICY IF EXISTS "Users can delete their own books." ON public.books;

-- Eliminar políticas de UPDATE duplicadas
-- Dejamos la que no tiene punto al final.
DROP POLICY IF EXISTS "Users can update their own books." ON public.books;

-- Eliminar políticas de SELECT duplicadas
-- Dejamos la que no tiene punto al final.
DROP POLICY IF EXISTS "Users can view their own books." ON public.books;
