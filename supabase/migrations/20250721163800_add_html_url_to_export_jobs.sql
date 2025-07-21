-- Añade la columna 'html_url' a la tabla 'export_jobs' para almacenar la URL del archivo HTML intermedio.
ALTER TABLE public.export_jobs
ADD COLUMN html_url TEXT;
