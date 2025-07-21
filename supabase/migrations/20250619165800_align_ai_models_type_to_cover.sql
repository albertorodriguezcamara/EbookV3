-- 1. Actualizar los modelos existentes que usen 'portada' para que usen 'cover'.
UPDATE public.ai_models
SET type = 'cover'
WHERE type = 'portada';

-- 2. Eliminar la restricción existente para poder modificarla.
ALTER TABLE public.ai_models
DROP CONSTRAINT IF EXISTS ai_models_type_check;

-- 3. Añadir la nueva restricción con 'cover' y eliminando 'portada' (si existiera de una migración anterior).
ALTER TABLE public.ai_models
ADD CONSTRAINT ai_models_type_check
CHECK ((type = ANY (ARRAY['writer'::text, 'editor'::text, 'image'::text, 'cover'::text])));
