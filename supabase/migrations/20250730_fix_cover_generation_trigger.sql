-- =====================================================
-- MIGRACIÓN: Corregir trigger de generación de portada automática
-- Fecha: 2025-07-30
-- Descripción: Actualizar la función update_chapter_and_log_progress
--              para usar Google Cloud Functions en lugar de Edge Functions
--              y evitar conflictos con generación manual de portada
-- =====================================================

-- Actualizar la función update_chapter_and_log_progress para usar Google Cloud Functions
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
    v_book_ai_config jsonb;
    v_image_model_id uuid;
    v_cover_job_id uuid;
    v_request_id bigint;
    v_request_payload jsonb;
    v_headers jsonb;
    v_gcloud_url text := 'https://europe-west1-export-document-project.cloudfunctions.net/generate-book-cover';
BEGIN
    ---------------------------------------------------------------------------
    -- 1. Actualizar el contenido del capítulo y obtener el book_id
    ---------------------------------------------------------------------------
    UPDATE public.chapters
    SET content = p_content
    WHERE id = p_chapter_id
    RETURNING book_id INTO v_book_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chapter with id % not found.', p_chapter_id;
    END IF;

    ---------------------------------------------------------------------------
    -- 2. Calcular el nuevo progreso
    ---------------------------------------------------------------------------
    SELECT COUNT(*), COUNT(CASE WHEN content IS NOT NULL THEN 1 END)
    INTO v_total_chapters, v_completed_chapters
    FROM public.chapters
    WHERE book_id = v_book_id;

    IF v_total_chapters > 0 THEN
        v_progress := (v_completed_chapters * 100) / v_total_chapters;
    ELSE
        v_progress := 0;
    END IF;

    ---------------------------------------------------------------------------
    -- 3. Actualizar el estado y progreso del job
    ---------------------------------------------------------------------------
    UPDATE public.jobs
    SET progress_percentage = v_progress,
        status_message      = 'Writing chapters... (' || v_completed_chapters || '/' || v_total_chapters || ')',
        status              = CASE WHEN v_completed_chapters = v_total_chapters THEN 'completed' ELSE 'processing' END,
        updated_at          = NOW()
    WHERE id = p_job_id;

    ---------------------------------------------------------------------------
    -- 4. Al completar todos los capítulos, disparar generación de portada
    -- SOLO si no existe ya una portada (evitar duplicación)
    ---------------------------------------------------------------------------
    IF v_completed_chapters = v_total_chapters AND v_total_chapters > 0 THEN
        -- Verificar si ya existe portada para evitar duplicación
        DECLARE
            v_existing_cover_url text;
        BEGIN
            SELECT cover_image_url INTO v_existing_cover_url 
            FROM public.books 
            WHERE id = v_book_id;
            
            -- Solo generar portada si no existe una ya
            IF v_existing_cover_url IS NULL OR trim(v_existing_cover_url) = '' THEN
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
                                'Cover generation queued automatically',
                                0,
                                jsonb_build_object(
                                    'book_id', v_book_id, 
                                    'image_model_id', v_image_model_id,
                                    'auto_trigger', true
                                ))
                        RETURNING id INTO v_cover_job_id;

                        -------------------------------------------------------------------
                        -- 4b. Llamar a Google Cloud Functions (NO Edge Functions)
                        -------------------------------------------------------------------
                        v_request_payload := jsonb_build_object(
                            'book_id', v_book_id,
                            'job_id', v_cover_job_id,
                            'image_model_id', v_image_model_id,
                            'auto_trigger', true
                        );
                        
                        -- Construir headers con autorización
                        v_headers := jsonb_build_object(
                            'Content-Type', 'application/json',
                            'Authorization', 'Bearer ' || (
                                SELECT decrypted_secret 
                                FROM vault.decrypted_secrets 
                                WHERE name = 'service_role_key' 
                                LIMIT 1
                            )
                        );

                        BEGIN
                            SELECT net.http_post(
                                url := v_gcloud_url,
                                headers := v_headers,
                                body := v_request_payload,
                                timeout_milliseconds := 540000  -- 9 minutos timeout
                            ) INTO v_request_id;

                            INSERT INTO public.creation_logs (book_id, message)
                            VALUES (v_book_id, '🎨 Generación automática de portada iniciada via Google Cloud Functions (request_id: ' || v_request_id || ')');

                        EXCEPTION WHEN OTHERS THEN
                            RAISE WARNING 'Book ID %: Error al invocar generate-book-cover en Google Cloud (%).', v_book_id, SQLERRM;
                            INSERT INTO public.creation_logs (book_id, message)
                            VALUES (v_book_id, '❌ Error en generación automática de portada: ' || SQLERRM);
                            
                            -- Actualizar job como fallido
                            UPDATE public.jobs 
                            SET status = 'failed', 
                                status_message = 'Error en generación automática de portada: ' || SQLERRM
                            WHERE id = v_cover_job_id;
                        END;
                    ELSE
                        INSERT INTO public.creation_logs (book_id, message)
                        VALUES (v_book_id, '⚠️ Generación automática de portada omitida: image_generator_model_id inválido');
                    END IF;
                ELSE
                    INSERT INTO public.creation_logs (book_id, message)
                    VALUES (v_book_id, '⚠️ Generación automática de portada omitida: image_generator_model_id no configurado');
                END IF;
            ELSE
                INSERT INTO public.creation_logs (book_id, message)
                VALUES (v_book_id, '✅ Generación automática de portada omitida: ya existe portada');
            END IF;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario de la función actualizada
COMMENT ON FUNCTION public.update_chapter_and_log_progress(uuid, text, uuid) IS 
'Función actualizada que usa Google Cloud Functions para generación automática de portada y evita duplicación verificando si ya existe portada.';

-- =====================================================
-- RESUMEN DE CAMBIOS:
-- 
-- ✅ ACTUALIZADO: URL de Edge Function a Google Cloud Functions
-- ✅ AÑADIDO: Verificación de portada existente para evitar duplicación
-- ✅ MEJORADO: Headers con autorización correcta para Google Cloud
-- ✅ AÑADIDO: Timeout extendido (9 minutos) para generación de portada
-- ✅ MEJORADO: Manejo de errores y logging detallado
-- ✅ AÑADIDO: Flag auto_trigger para distinguir de generación manual
-- 
-- PROBLEMA RESUELTO:
-- - La generación manual de portada ya no dispara reescritura de capítulos
-- - La generación automática usa Google Cloud Functions (más rápida y confiable)
-- - Se evita duplicación de portadas verificando existencia previa
-- =====================================================
