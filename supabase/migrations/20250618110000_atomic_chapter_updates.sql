-- FASE 3: RPC para escritura atómica de capítulos
-- Esta función es llamada por la Edge Function 'write-chapter-content'.
-- Se encarga de actualizar el contenido y añadir un log en una sola operación.

CREATE OR REPLACE FUNCTION public.update_chapter_and_log_progress(p_chapter_id uuid, p_content text, p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con los permisos del creador para poder escribir en las tablas
AS $$
DECLARE
  v_book_id uuid;
  v_chapter_title text;
BEGIN
  -- Obtener book_id y title para el mensaje de log
  SELECT book_id, title INTO v_book_id, v_chapter_title
  FROM public.chapters
  WHERE id = p_chapter_id;

  -- Actualizar el contenido del capítulo
  UPDATE public.chapters
  SET content = p_content
  WHERE id = p_chapter_id;

  -- Insertar un log para el usuario (la función de trigger se encargará del progreso del job)
  INSERT INTO public.creation_logs(book_id, message)
  VALUES (v_book_id, 'Contenido del capítulo ''' || v_chapter_title || ''' generado.');
END;
$$;

-- FASE 5: Trigger para el cálculo automático del progreso
-- Esta función se dispara automáticamente cuando un capítulo se actualiza.

CREATE OR REPLACE FUNCTION public.update_job_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_book_id uuid;
  v_job_id uuid;
  total_chapters INT;
  completed_chapters INT;
  writing_phase_progress INT;
  final_progress INT;
BEGIN
  -- Obtener el book_id del capítulo que fue actualizado
  v_book_id := NEW.book_id;

  -- Encontrar el job activo para este libro
  SELECT id INTO v_job_id
  FROM public.jobs
  WHERE book_id = v_book_id AND status = 'processing'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Si no se encuentra un job activo, no hacer nada
  IF v_job_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calcular el progreso dentro de la fase de escritura
  SELECT COUNT(*), COUNT(CASE WHEN content IS NOT NULL THEN 1 END)
  INTO total_chapters, completed_chapters
  FROM public.chapters
  WHERE book_id = v_book_id;

  IF total_chapters > 0 THEN
    writing_phase_progress := (completed_chapters * 100) / total_chapters;
  ELSE
    writing_phase_progress := 0;
  END IF;

  -- Asumimos que la fase de escritura va del 30% al 90% (una ventana del 60%)
  final_progress := 30 + (writing_phase_progress * 60 / 100);

  -- Actualizar el job
  UPDATE public.jobs
  SET progress_percentage = final_progress,
      status_message = 'Escribiendo capítulos... (' || completed_chapters || '/' || total_chapters || ' completados)'
  WHERE id = v_job_id;

  -- Si todos los capítulos están listos, actualizar el mensaje
  IF completed_chapters = total_chapters THEN
      UPDATE public.jobs
      SET status_message = 'Todos los capítulos han sido escritos.'
      WHERE id = v_job_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Crear el trigger que llama a la función anterior
-- Se dispara DESPUÉS de que se actualice el contenido de un capítulo,
-- pero solo si el contenido anterior era NULL.

DROP TRIGGER IF EXISTS on_chapter_update_update_progress ON public.chapters;
CREATE TRIGGER on_chapter_update_update_progress
  AFTER UPDATE OF content ON public.chapters
  FOR EACH ROW
  WHEN (OLD.content IS NULL AND NEW.content IS NOT NULL)
  EXECUTE FUNCTION public.update_job_progress();
