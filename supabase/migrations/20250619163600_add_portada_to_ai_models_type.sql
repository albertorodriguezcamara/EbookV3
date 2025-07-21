-- Primero, eliminamos la restricción existente para poder modificarla.
ALTER TABLE public.ai_models
DROP CONSTRAINT ai_models_type_check;

-- Luego, añadimos la nueva restricción con el tipo 'portada' incluido en la lista de valores permitidos.
ALTER TABLE public.ai_models
ADD CONSTRAINT ai_models_type_check
CHECK ((type = ANY (ARRAY['writer'::text, 'editor'::text, 'image'::text, 'portada'::text])));
