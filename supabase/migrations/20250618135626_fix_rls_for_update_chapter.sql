-- Asegurarse de que la función se ejecute con los permisos del propietario
ALTER FUNCTION public.update_chapter_and_log_progress(p_chapter_id uuid, p_content text, p_job_id uuid) OWNER TO postgres;

-- Otorgar permisos para que la función pueda actualizar las tablas necesarias
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Crear una política que permita a la función actualizar capítulos
CREATE POLICY "Allow update_chapter_and_log_progress to update chapters"
ON public.chapters
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Asegurarse de que los jobs también se puedan actualizar
CREATE POLICY "Allow update_chapter_and_log_progress to update jobs"
ON public.jobs
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
