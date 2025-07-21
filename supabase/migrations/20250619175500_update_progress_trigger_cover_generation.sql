-- supabase/migrations/20250619175500_update_progress_trigger_cover_generation.sql

-- Revierte la función a su estado anterior si es necesario (ajusta según tu versión anterior exacta)
-- Para revertir, necesitarías el código original de la función.
-- Ejemplo de cómo podría ser un DROP:
-- DROP FUNCTION IF EXISTS public.update_chapter_and_log_progress(uuid, text, uuid);
-- A continuación, deberías reinsertar la definición original de la función si quieres una reversión completa.

-- Nueva versión de la función
CREATE OR REPLACE FUNCTION public.update_chapter_and_log_progress(p_chapter_id uuid, p_content text, p_job_id uuid)
 RETURNS void
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
    v_service_role_key text; -- MUY IMPORTANTE: Gestionar de forma segura
    v_request_payload jsonb;
    v_request_id bigint;
    v_project_ref text := 'ydorhokujupnxpyrxczv';
    v_provided_service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb3Job2t1anVwbnhweXJ4Y3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDEzMTA0MCwiZXhwIjoyMDU1NzA3MDQwfQ.PW51n-DXxQ9h7xONqIZXmPgryG09tHoVNk8Tw7msEps';
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

    -- Paso 4: Si todos los capítulos están completos, verificar y disparar la generación de portada
    IF v_completed_chapters = v_total_chapters AND v_total_chapters > 0 THEN
        -- Obtener la configuración de IA del libro
        SELECT ai_config INTO v_book_ai_config FROM public.books WHERE id = v_book_id;

        -- Verificar si existe image_generator_model_id en ai_config y no es una cadena vacía
        IF v_book_ai_config IS NOT NULL AND v_book_ai_config ? 'image_generator_model_id' AND
           v_book_ai_config->>'image_generator_model_id' IS NOT NULL AND
           trim(v_book_ai_config->>'image_generator_model_id') <> ''
        THEN
            BEGIN
                v_image_model_id := (v_book_ai_config->>'image_generator_model_id')::uuid;
            EXCEPTION
                WHEN invalid_text_representation THEN -- Captura error si no es un UUID válido
                    RAISE WARNING 'Book ID %: image_generator_model_id en ai_config no es un UUID válido: %', v_book_id, v_book_ai_config->>'image_generator_model_id';
                    v_image_model_id := NULL;
            END;

            IF v_image_model_id IS NOT NULL THEN
                v_supabase_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/generate-book-cover';
                v_service_role_key := v_provided_service_key; 

                RAISE NOTICE 'Libro ID %: Todos los capítulos completados. Intentando generar portada (Modelo ID: %). URL: %', v_book_id, v_image_model_id, v_supabase_url;

                v_request_payload := jsonb_build_object('book_id', v_book_id);

                BEGIN
                    SELECT net.http_post(
                        url := v_supabase_url,
                        body := v_request_payload,
                        headers := jsonb_build_object(
                            'Content-Type', 'application/json',
                            'Authorization', 'Bearer ' || v_service_role_key
                        ),
                        timeout_milliseconds := 10000 -- Aumentado a 10 segundos
                    )
                    INTO v_request_id;

                    RAISE NOTICE 'Libro ID %: Llamada a generate-book-cover iniciada. Request ID de pg_net: %', v_book_id, v_request_id;
                    
                    INSERT INTO public.creation_logs (book_id, message)
                    VALUES (v_book_id, 'Attempting to trigger book cover generation.'); -- id and created_at have defaults

                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE WARNING 'Libro ID %: Error al invocar generate-book-cover con pg_net: %', v_book_id, SQLERRM;
                        INSERT INTO public.creation_logs (book_id, message)
                        VALUES (v_book_id, 'Failed to trigger book cover generation via pg_net. Error: ' || SQLERRM); -- id and created_at have defaults
                END;
            ELSE
                RAISE NOTICE 'Libro ID %: Todos los capítulos completados, pero image_generator_model_id en ai_config no es un UUID válido o es nulo.', v_book_id;
                INSERT INTO public.creation_logs (book_id, message)
                VALUES (v_book_id, 'Cover generation skipped: image_generator_model_id is invalid or null.'); -- id and created_at have defaults
            END IF;
        ELSE
            RAISE NOTICE 'Libro ID %: Todos los capítulos completados. No se generará portada porque ai_config.image_generator_model_id no está configurado o ai_config es nulo.', v_book_id;
             INSERT INTO public.creation_logs (book_id, message)
             VALUES (v_book_id, 'Cover generation skipped: image_generator_model_id not configured.'); -- id and created_at have defaults
        END IF;
    END IF;

END;
$function$;

-- Comandos GRANT opcionales (descomentar y ajustar si es necesario):
-- GRANT EXECUTE ON FUNCTION public.update_chapter_and_log_progress(uuid, text, uuid) TO supabase_functions; -- O el rol que usa tu API
-- GRANT USAGE ON SCHEMA net TO supabase_functions; -- O el rol que usa tu API
-- GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions; -- O el rol que usa tu API

-- Nota: Asegúrate de que la extensión pg_net esté habilitada en tu base de datos:
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
