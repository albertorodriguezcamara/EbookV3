-- Añade la columna ai_config para configuración de agentes IA por libro
ALTER TABLE public.books
ADD COLUMN ai_config jsonb NULL;
