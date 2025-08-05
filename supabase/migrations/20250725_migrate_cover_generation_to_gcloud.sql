-- supabase/migrations/20250725_migrate_cover_generation_to_gcloud.sql
-- Fecha: 2025-07-25
-- Propósito: Migrar generación de portada a Google Cloud Functions y evitar duplicación

-- ===== FUNCIÓN ACTUALIZADA CON CONTROL DE DUPLICACIÓN =====
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
    v_existing_cover_url text;
    v_gcloud_url text := 'https://europe-west1-export-document-project.cloudfunctions.net/generate-book-cover';
    v_request_payload jsonb;
    v_request_id bigint;
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

    -- Paso 4: CONTROL DE DUPLICACIÓN - Solo generar portada si todos los capítulos están completos Y no existe portada
    IF v_completed_chapters = v_total_chapters AND v_total_chapters > 0 THEN
        
        -- ===== VERIFICAR SI YA EXISTE PORTADA (CONTROL DE DUPLICACIÓN) =====
        SELECT cover_image_url INTO v_existing_cover_url 
        FROM public.books 
        WHERE id = v_book_id;

        IF v_existing_cover_url IS NOT NULL AND trim(v_existing_cover_url) != '' THEN
            -- Ya existe portada, evitar duplicación
            RAISE NOTICE 'Libro ID %: DUPLICACIÓN EVITADA - Ya existe portada: %', v_book_id, v_existing_cover_url;
            
            INSERT INTO public.creation_logs (book_id, message)
            VALUES (v_book_id, 'Generación de portada omitida - ya existe portada (duplicación evitada)');
            
            RETURN; -- Salir sin generar portada
        END IF;

        -- ===== VERIFICAR CONFIGURACIÓN DE IA =====
        SELECT ai_config INTO v_book_ai_config FROM public.books WHERE id = v_book_id;

        -- Verificar si existe image_generator_model_id en ai_config
        IF v_book_ai_config IS NOT NULL AND v_book_ai_config ? 'image_generator_model_id' AND
           v_book_ai_config->>'image_generator_model_id' IS NOT NULL AND
           trim(v_book_ai_config->>'image_generator_model_id') <> ''
        THEN
            BEGIN
                v_image_model_id := (v_book_ai_config->>'image_generator_model_id')::uuid;
            EXCEPTION
                WHEN invalid_text_representation THEN
                    RAISE WARNING 'Libro ID %: image_generator_model_id no es un UUID válido: %', v_book_id, v_book_ai_config->>'image_generator_model_id';
                    v_image_model_id := NULL;
            END;

            IF v_image_model_id IS NOT NULL THEN
                -- ===== INVOCAR GOOGLE CLOUD FUNCTION PARA GENERAR PORTADA =====
                RAISE NOTICE 'Libro ID %: Todos los capítulos completados. Generando portada con Google Cloud Functions', v_book_id;

                v_request_payload := jsonb_build_object(
                    'book_id', v_book_id,
                    'job_id', p_job_id
                );

                BEGIN
                    -- Llamar a Google Cloud Function con timeout extendido
                    SELECT net.http_post(
                        url := v_gcloud_url,
                        body := v_request_payload,
                        headers := jsonb_build_object(
                            'Content-Type', 'application/json',
                            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
                        ),
                        timeout_milliseconds := 600000 -- 10 minutos para Google Cloud
                    )
                    INTO v_request_id;

                    RAISE NOTICE 'Libro ID %: Llamada a generate-book-cover (Google Cloud) iniciada. Request ID: %', v_book_id, v_request_id;
                    
                    INSERT INTO public.creation_logs (book_id, message)
                    VALUES (v_book_id, 'Iniciando generación de portada con Google Cloud Functions (request_id: ' || v_request_id || ')');

                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE WARNING 'Libro ID %: Error al invocar generate-book-cover en Google Cloud: %', v_book_id, SQLERRM;
                        
                        INSERT INTO public.creation_logs (book_id, message)
                        VALUES (v_book_id, 'Error al invocar generación de portada: ' || SQLERRM);
                        
                        -- Actualizar job como fallido solo para la portada
                        UPDATE public.jobs
                        SET 
                            status = 'failed',
                            status_message = 'Capítulos completados, pero falló generación de portada: ' || SQLERRM
                        WHERE id = p_job_id;
                END;
            ELSE
                RAISE NOTICE 'Libro ID %: image_generator_model_id no válido, omitiendo generación de portada', v_book_id;
                INSERT INTO public.creation_logs (book_id, message)
                VALUES (v_book_id, 'Generación de portada omitida: image_generator_model_id no válido');
            END IF;
        ELSE
            RAISE NOTICE 'Libro ID %: No se generará portada - ai_config.image_generator_model_id no configurado', v_book_id;
            INSERT INTO public.creation_logs (book_id, message)
            VALUES (v_book_id, 'Generación de portada omitida: image_generator_model_id no configurado');
        END IF;
    END IF;

END;
$function$;

-- ===== COMENTARIOS Y DOCUMENTACIÓN =====
COMMENT ON FUNCTION public.update_chapter_and_log_progress(uuid, text, uuid) IS 
'Función actualizada para migración a Google Cloud Functions. 
Incluye control de duplicación para evitar regeneración de portadas existentes.
Migrada el 2025-07-25 para resolver problema de duplicación de contenido.';

-- ===== LOG DE MIGRACIÓN =====
INSERT INTO public.creation_logs (book_id, message)
SELECT 
    id as book_id,
    'MIGRACIÓN: Función de generación de portada migrada a Google Cloud Functions con control de duplicación'
FROM public.books 
WHERE cover_image_url IS NOT NULL
LIMIT 1; -- Solo insertar un log general, no uno por cada libro

-- ===== VERIFICACIÓN POST-MIGRACIÓN =====
-- Esta query puede ejecutarse para verificar que la migración fue exitosa
-- SELECT 'Migración completada: update_chapter_and_log_progress actualizada para Google Cloud Functions' as status;
