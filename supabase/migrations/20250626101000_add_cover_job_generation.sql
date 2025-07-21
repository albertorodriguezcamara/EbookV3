-- supabase/migrations/20250626101000_add_cover_job_generation.sql
-- Mejora de la función update_chapter_and_log_progress para crear un job de portada
-- y pasar su UUID a la Edge Function generate-book-cover.
--
-- IMPORTANTE: requiere que la extensión pg_net esté instalada y que la variable
-- v_project_ref y v_provided_service_key estén configuradas correctamente.

CREATE OR REPLACE FUNCTION public.update_chapter_and_log_progress(
    p_chapter_id uuid,
    p_content text,
    p_job_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_book_id uuid;
    v_total_chapters integer;
    v_completed_chapters integer;
    v_progress integer;
    v_book_ai_config jsonb;
    v_image_model_id uuid;
    v_supabase_url text;
    v_service_role_key text;
    v_request_payload jsonb;
    v_request_id bigint;
    v_cover_job_id uuid; -- <–– nuevo job específico para la portada
    v_project_ref text := 'ydorhokujupnxpyrxczv';
    v_provided_service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb3Job2t1anVwbnhweXJ4Y3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDEzMTA0MCwiZXhwIjoyMDU1NzA3MDQwfQ.PW51n-DXxQ9h7xONqIZXmPgryG09tHoVNk8Tw7msEps';
BEGIN
    ---------------------------------------------------------------------------
    -- 1. Actualizar contenido del capítulo y obtener book_id
    ---------------------------------------------------------------------------
    UPDATE public.chapters
    SET content = p_content
    WHERE id = p_chapter_id
    RETURNING book_id INTO v_book_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chapter with id % not found.', p_chapter_id;
    END IF;

    ---------------------------------------------------------------------------
    -- 2. Calcular progreso
    ---------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_total_chapters FROM public.chapters WHERE book_id = v_book_id;
    SELECT COUNT(*) INTO v_completed_chapters
      FROM public.chapters
      WHERE book_id = v_book_id AND content IS NOT NULL AND content <> '';

    v_progress := CASE WHEN v_total_chapters > 0 THEN (v_completed_chapters * 100) / v_total_chapters ELSE 0 END;

    ---------------------------------------------------------------------------
    -- 3. Actualizar job de escritura
    ---------------------------------------------------------------------------
    UPDATE public.jobs
    SET progress_percentage = v_progress,
        status_message      = 'Writing chapters... (' || v_completed_chapters || '/' || v_total_chapters || ')',
        status              = CASE WHEN v_completed_chapters = v_total_chapters THEN 'completed' ELSE 'processing' END,
        updated_at          = NOW()
    WHERE id = p_job_id;

    ---------------------------------------------------------------------------
    -- 4. Al completar todos los capítulos, disparar generación de portada
    ---------------------------------------------------------------------------
    IF v_completed_chapters = v_total_chapters AND v_total_chapters > 0 THEN
        SELECT ai_config INTO v_book_ai_config FROM public.books WHERE id = v_book_id;

        IF v_book_ai_config ? 'image_generator_model_id' AND
           COALESCE(trim(v_book_ai_config ->> 'image_generator_model_id'), '') <> '' THEN
            BEGIN
                v_image_model_id := (v_book_ai_config ->> 'image_generator_model_id')::uuid;
            EXCEPTION WHEN invalid_text_representation THEN
                RAISE WARNING 'Book ID %: image_generator_model_id no es UUID válido (%).', v_book_id, v_book_ai_config ->> 'image_generator_model_id';
                v_image_model_id := NULL;
            END;

            IF v_image_model_id IS NOT NULL THEN
                -------------------------------------------------------------------
                -- 4a. Crear un nuevo job para la generación de portada
                -------------------------------------------------------------------
                INSERT INTO public.jobs (book_id, status, status_message, progress_percentage, payload)
                VALUES (v_book_id,
                        'pending',
                        'Cover generation queued',
                        0,
                        jsonb_build_object('book_id', v_book_id, 'image_model_id', v_image_model_id))
                RETURNING id INTO v_cover_job_id;

                -------------------------------------------------------------------
                -- 4b. Llamar a la función edge
                -------------------------------------------------------------------
                v_supabase_url     := 'https://' || v_project_ref || '.supabase.co/functions/v1/generate-book-cover';
                v_service_role_key := v_provided_service_key;

                v_request_payload := jsonb_build_object(
                    'book_id', v_book_id,
                    'job_id',  v_cover_job_id
                );

                BEGIN
                    SELECT net.http_post(
                        url                 := v_supabase_url,
                        body                := v_request_payload,
                        headers             := jsonb_build_object(
                                                'Content-Type', 'application/json',
                                                'Authorization', 'Bearer ' || v_service_role_key
                                              ),
                        timeout_milliseconds := 10000
                    ) INTO v_request_id;

                    INSERT INTO public.creation_logs (book_id, message)
                    VALUES (v_book_id, 'Cover generation triggered. Request ID: ' || v_request_id);

                EXCEPTION WHEN OTHERS THEN
                    RAISE WARNING 'Book ID %: Error al invocar generate-book-cover (%).', v_book_id, SQLERRM;
                    INSERT INTO public.creation_logs (book_id, message)
                    VALUES (v_book_id, 'Failed to trigger cover generation: ' || SQLERRM);
                END;
            ELSE
                INSERT INTO public.creation_logs (book_id, message)
                VALUES (v_book_id, 'Cover generation skipped: image_generator_model_id invalid.');
            END IF;
        ELSE
            INSERT INTO public.creation_logs (book_id, message)
            VALUES (v_book_id, 'Cover generation skipped: image_generator_model_id not configured.');
        END IF;
    END IF;
END;
$function$;

-- Opcional: concesión de permisos (ajusta el rol si fuera necesario)
-- GRANT EXECUTE ON FUNCTION public.update_chapter_and_log_progress(uuid, text, uuid) TO supabase_functions;
