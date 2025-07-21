import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callAI } from '../ai-service/index.ts'

// Definición de tipos para mayor claridad y seguridad
interface OutlinePayload {
  book_id: string;
  job_id: string;
  start_chapter?: number;
  end_chapter?: number;
}

interface ChapterOutline {
  title: string;
  synopsis: string;
}

serve(async (req) => {
  // 1. Validar método y parsear payload de forma segura
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: OutlinePayload;
  try {
    payload = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  const { book_id, job_id, start_chapter, end_chapter } = payload;

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log(`Función generate-book-outline iniciada para job_id: ${job_id}`);

    // 2. Actualizar estado inicial del job y logs
    await supabaseClient.from('jobs').update({ 
        status: 'processing', 
        status_message: 'Generando el esquema de capítulos...',
        progress_percentage: 15 
    }).eq('id', job_id);

    await supabaseClient.from('creation_logs').insert({ 
        book_id: book_id, 
        message: 'Estamos pensando en la estructura perfecta para tu libro...' 
    });

    // 3. Obtener todos los datos necesarios
    const { data: bookData, error: bookError } = await supabaseClient
      .from('books')
      .select('*')
      .eq('id', book_id)
      .single();

    if (bookError) throw bookError;
    console.log('Datos del libro (bookData) obtenidos.');

    // --- INICIO: Obtener configuración de IA --- 
    const editorModelIdentifier = bookData.ai_config?.editor_model_id;
    if (!editorModelIdentifier) {
      throw new Error('Modelo de IA para editor no configurado. Falta `editor_model_id` en el objeto `ai_config` del libro.');
    }

    const { data: modelData, error: modelError } = await supabaseClient
      .from('ai_models')
      .select('*, ai_providers(*)')
      .eq('id', editorModelIdentifier)
      .single();

    if (modelError) throw new Error(`Error al buscar el modelo de IA '${editorModelIdentifier}' (editor): ${modelError.message}`);
    if (!modelData) throw new Error(`Modelo de IA '${editorModelIdentifier}' (editor) no encontrado.`);
    if (!modelData.ai_providers) throw new Error(`Proveedor de IA no encontrado para el modelo '${editorModelIdentifier}'.`);

    const providerData = modelData.ai_providers;
    const apiKey = providerData.api_key;
    const baseUrl = providerData.base_url;
    const actualModelNameForAPI = modelData.name;

    if (!apiKey || !baseUrl) {
      throw new Error(`API key o Base URL no configuradas para el proveedor del modelo '${actualModelNameForAPI}'.`);
    }
    console.log(`--- CONFIGURACIÓN DE IA OBTENIDA (Modelo: ${actualModelNameForAPI}) ---`);

    // --- INICIO: Obtener instrucciones ---
    const { data: instructionsData, error: instructionsError } = await supabaseClient
      .from('category_instructions')
      .select('instructions')
      .eq('category', bookData.category)
      .eq('subcategory', bookData.subcategory) // Maneja tanto valor como nulo
      .maybeSingle();

    if (instructionsError) {
        console.warn(`Error al buscar instrucciones para ${bookData.category}/${bookData.subcategory}, se continuará sin ellas.`);
    }
    // --- FIN: Obtener instrucciones ---

    // 4. PROCESAMIENTO POR LOTES PARA GENERAR EL ESQUEMA
    const targetNumberOfChapters = bookData.book_attributes?.target_number_of_chapters || 10;
    console.log(`Número total de capítulos a generar: ${targetNumberOfChapters}`);

    const BATCH_SIZE = 20; // tamaño de lote estándar
    // Determinar rango actual
    const startChapter = start_chapter && start_chapter > 0 ? start_chapter : 1;
    const endChapter = end_chapter && end_chapter >= startChapter ? end_chapter : Math.min(startChapter + BATCH_SIZE - 1, targetNumberOfChapters);
    

    const systemPrompt = `Eres un autor y editor experto. Tu tarea es crear un esquema de capítulos coherente y bien estructurado. La respuesta DEBE ser un objeto JSON válido que contenga una única clave "chapters", y su valor debe ser un array de objetos. Cada objeto debe tener las claves "title" y "synopsis". NO añadas texto introductorio, explicaciones, ni el bloque de código markdown \`\`\`json. Solo el objeto JSON.`;

    // Función auxiliar recursiva que divide el rango si el parseo falla
    const generateWithFallback = async (start: number, end: number): Promise<ChapterOutline[]> => {
        const chaptersCount = end - start + 1;
        const userPrompt = `La idea del libro es: "${bookData.idea}". El libro es de la categoría "${bookData.category} / ${bookData.subcategory}". El idioma debe ser: ${bookData.language}. Las instrucciones específicas para esta categoría son: "${instructionsData?.instructions || 'No hay instrucciones específicas.'}". Por favor, genera un esquema para ${chaptersCount} capítulos, concretamente los capítulos del ${start} al ${end} de un total de ${targetNumberOfChapters}.`;

        const aiResult = await callAI({
            config: { providerName: providerData.name, apiKey, baseUrl, modelName: actualModelNameForAPI },
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            temperature: 0.7,
            max_tokens: 4096,
        });

        if (aiResult.error || !aiResult.content) {
            throw new Error(`La API de IA respondió con un error para los capítulos ${start}-${end}: ${aiResult.error || 'Contenido vacío.'}`);
        }

        const aiContent = aiResult.content;
        let parsedAiResponse: { chapters: ChapterOutline[] };

        try {
            parsedAiResponse = JSON.parse(aiContent);
        } catch (e) {
            const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
            if (jsonMatch && jsonMatch[0]) {
                try {
                    parsedAiResponse = JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    // Si aún falla y podemos dividir, dividimos el rango.
                    if (chaptersCount > 1) {
                        const mid = Math.floor((start + end) / 2);
                        const firstHalf = await generateWithFallback(start, mid);
                        const secondHalf = await generateWithFallback(mid + 1, end);
                        return [...firstHalf, ...secondHalf];
                    }
                    console.error(`Contenido original de la IA que falló el parseo en el rango ${start}-${end}:`, aiContent);
                    throw new Error(`Falló el parseo del JSON incluso después de limpiar para capítulos ${start}-${end}: ${e2.message}.`);
                }
            } else {
                if (chaptersCount > 1) {
                    const mid = Math.floor((start + end) / 2);
                    const firstHalf = await generateWithFallback(start, mid);
                    const secondHalf = await generateWithFallback(mid + 1, end);
                    return [...firstHalf, ...secondHalf];
                }
                throw new Error(`No se encontró objeto JSON válido para capítulos ${start}-${end}.`);
            }
        }

        if (!parsedAiResponse.chapters || !Array.isArray(parsedAiResponse.chapters)) {
            throw new Error(`La respuesta de la IA para capítulos ${start}-${end} no tiene el formato esperado.`);
        }

        // Guardar log de esta llamada
        await supabaseClient.from('ai_prompts_log').insert({
            book_id: book_id,
            phase: `outline-${start}-${end}`,
            prompt_text: `SYSTEM: ${systemPrompt}\n\nUSER: ${userPrompt}`,
            response_text: JSON.stringify(parsedAiResponse),
            model_used: actualModelNameForAPI
        });

        return parsedAiResponse.chapters;
    };

    console.log(`--- INICIANDO LOTE (${startChapter}-${endChapter}) ---`);
    await supabaseClient.from('jobs').update({
        status_message: `Generando esquema para capítulos ${startChapter}-${endChapter}...`,
        progress_percentage: Math.round((endChapter / targetNumberOfChapters) * 30) // hasta 30% mientras generamos esquema
    }).eq('id', job_id);

    // Generar capítulos del rango actual
    const batchChapters = await generateWithFallback(startChapter, endChapter);
    console.log(`Lote (${startChapter}-${endChapter}) procesado, ${batchChapters.length} capítulos obtenidos.`);

    // Persistir capítulos en DB
    const chaptersToInsert = batchChapters.map((chapter, idx) => ({
        book_id: book_id,
        title: chapter.title,
        synopsis: chapter.synopsis,
        order_number: startChapter + idx,
        content: null
    }));

    // Insertar o actualizar capítulos SIN tocar la columna 'content' si ya fue escrita
    await supabaseClient.from('chapters').upsert(chaptersToInsert, {
        onConflict: 'book_id,order_number',
        updateColumns: ['title', 'synopsis'] // evita sobreescribir 'content'
    });

    // Si aún quedan capítulos por generar, invocar la siguiente tanda y responder 202
    if (endChapter < targetNumberOfChapters) {
        const nextStart = endChapter + 1;
        const nextEnd = Math.min(nextStart + BATCH_SIZE - 1, targetNumberOfChapters);

        await supabaseClient.functions.invoke('generate-book-outline', {
            body: JSON.stringify({ book_id, job_id, start_chapter: nextStart, end_chapter: nextEnd }),
        });

        return new Response(JSON.stringify({ success: true, message: `Lote ${startChapter}-${endChapter} procesado. Continuando...` }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Si llegamos aquí es el último lote




    // 5. Actualizar estado del job para el siguiente paso
    await supabaseClient.from('jobs').update({ 
        status: 'processing', // Aún no ha terminado, pasa a la escritura
        status_message: 'Esquema de capítulos generado. Iniciando escritura de capítulos.',
        progress_percentage: 30
    }).eq('id', job_id);
    
    await supabaseClient.from('creation_logs').insert({ 
        book_id: book_id, 
        message: '¡Ya tenemos el esqueleto de tu historia! Ahora vamos a darle vida.' 
    });

    return new Response(JSON.stringify({ success: true, message: 'Outline generated and chapters created successfully.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`Error fatal en generate-book-outline para el job ${job_id}:`, error);
    await supabaseClient.from('jobs').update({
        status: 'failed',
        status_message: `Error en generate-book-outline: ${error.message}`,
        progress_percentage: -1,
    }).eq('id', job_id);
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
