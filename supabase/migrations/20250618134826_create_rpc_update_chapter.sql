CREATE OR REPLACE FUNCTION public.update_chapter_and_log_progress(
    p_chapter_id uuid,
    p_content text,
    p_job_id uuid
)
RETURNS void AS $$
DECLARE
    v_book_id uuid;
    v_total_chapters integer;
    v_completed_chapters integer;
    v_progress integer;
BEGIN
    -- Paso 1: Actualizar el contenido del capítulo y obtener el book_id
    UPDATE public.chapters
    SET content = p_content
    WHERE id = p_chapter_id
    RETURNING book_id INTO v_book_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chapter with id % not found.', p_chapter_id;
    END IF;

    -- Paso 2: Calcular el nuevo progreso
    SELECT count(*)
    INTO v_total_chapters
    FROM public.chapters
    WHERE book_id = v_book_id;

    SELECT count(*)
    INTO v_completed_chapters
    FROM public.chapters
    WHERE book_id = v_book_id AND content IS NOT NULL AND content != '';

    IF v_total_chapters > 0 THEN
        v_progress := (v_completed_chapters * 100) / v_total_chapters;
    ELSE
        v_progress := 0;
    END IF;

    -- Paso 3: Actualizar el estado y progreso del job
    UPDATE public.jobs
    SET
        progress_percentage = v_progress,
        status_message = 'Writing chapters... (' || v_completed_chapters || '/' || v_total_chapters || ')',
        status = CASE WHEN v_completed_chapters = v_total_chapters THEN 'completed' ELSE 'processing' END
    WHERE id = p_job_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
