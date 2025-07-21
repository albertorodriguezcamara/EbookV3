import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callAI } from '../ai-service/index.ts' // <-- NUEVO: Importar el servicio de IA

const DEFAULT_TARGET_WORD_COUNT = 1500;
const DEFAULT_WORD_COUNT_MIN = 1200;
const DEFAULT_WORD_COUNT_MAX = 1800;

function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

// Estimación rápida: 1 token ≈ 4 caracteres (guía oficial)
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

interface WriteChapterPayload {
  chapter_id: string;
  job_id: string;
}

serve(async (req) => {
  let payload: WriteChapterPayload | null = null;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    payload = await req.json();
    if (!payload || !payload.chapter_id || !payload.job_id) {
      throw new Error('Invalid payload: chapter_id and job_id are required.');
    }
    const { chapter_id, job_id } = payload;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. IDEMPOTENCY CHECK
    const { data: chapterCheck, error: checkError } = await supabaseClient
      .from('chapters')
      .select('content, book_id, title, synopsis')
      .eq('id', chapter_id)
      .single();

    if (checkError) throw new Error(`Chapter check failed: ${checkError.message}`);
    if (chapterCheck.content) {
      console.log(`Chapter ${chapter_id} already has content. Skipping.`);
      return new Response(JSON.stringify({ success: true, message: 'Chapter already written. Skipped.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 2. OBTENER DATOS DEL LIBRO
    const { data: bookData, error: bookError } = await supabaseClient
      .from('books')
      .select('*')
      .eq('id', chapterCheck.book_id)
      .single();

    if (bookError) throw new Error(`Failed to get book data: ${bookError.message}`);

    await supabaseClient.from('creation_logs').insert({ 
        book_id: bookData.id, 
        message: `Dando forma al capítulo: '${chapterCheck.title}'...` 
    });

    // 3. OBTENER CONFIGURACIÓN DE IA PARA EL ROL 'WRITER'
    const writerModelIdentifier = bookData.ai_config?.writer_model_id;
    if (!writerModelIdentifier) throw new Error('Writer model not configured. Falta `writer_model_id` en el objeto `ai_config` del libro.');

    const { data: modelData, error: modelError } = await supabaseClient
        .from('ai_models')
        .select(`*, ai_providers(*)`)
        .eq('id', writerModelIdentifier)
        .single();

    if (modelError || !modelData) throw new Error(`Failed to retrieve writer model config: ${modelError?.message}`);
    if (!modelData.ai_providers) throw new Error(`Provider not found for model ${modelData.name}`);

    const { name: actualModelNameForAPI, ai_providers: providerData } = modelData;
    const apiKey = providerData.api_key;
    const baseUrl = providerData.base_url;

    if (!apiKey || !baseUrl || !providerData.name) {
      throw new Error(`API key, Base URL o nombre del proveedor no configurados para el modelo '${actualModelNameForAPI}'.`);
    }

    // 4. CONSTRUIR PROMPT PARA LA IA
    const systemPrompt = `Eres un autor experto y un escritor de novelas de talla mundial. Tu tarea es escribir el contenido de un capítulo de una novela. Debes mantenerte fiel al contexto, tono y personajes definidos. Escribe únicamente el texto del capítulo, sin añadir títulos, números de capítulo o comentarios adicionales. El idioma de salida debe ser: ${bookData.language}. Es crucial que te adhieras a la extensión de palabras solicitada en el prompt del usuario para este capítulo.`;

    const targetWordCount = (bookData.book_attributes?.target_word_count && typeof bookData.book_attributes.target_word_count === 'number' && bookData.book_attributes.target_word_count > 0)
        ? bookData.book_attributes.target_word_count
        : DEFAULT_TARGET_WORD_COUNT;

    const TOKENS_PER_WORD = 1.6;              // promedio de 1,6 tokens por palabra en español
const SAFETY_MARGIN  = 300;               // margen para signos y saltos
const MAX_TOKENS_CAP = 25000;             // límite blando bajo 65k

// ---- CÁLCULO DINÁMICO DEL PRESUPUESTO DE SALIDA ----
const MAX_OUTPUT_TOKENS = 7800; // margen bajo el límite real (~8k)

// Construimos un prompt base sin la instrucción de longitud para estimar tokens del prompt
const promptBase = `\n      Título de la novela: "${bookData.title}"\n      Idea general de la novela: ${bookData.idea}\n      Escribe el contenido completo para el capítulo titulado: "${chapterCheck.title}".\n      Sinopsis del capítulo (úsala como guía): ${chapterCheck.synopsis || 'No hay sinopsis, por favor elabora basado en el título y el contexto general.'}`;

const promptTokenCount = estimateTokens(systemPrompt) + estimateTokens(promptBase);
const outputBudgetTokens = Math.max(400, MAX_OUTPUT_TOKENS - promptTokenCount - 50); // 50 de margen de seguridad
const maxWordsSafe = Math.floor(outputBudgetTokens / TOKENS_PER_WORD);

const effectiveWordGoal = Math.min(targetWordCount, maxWordsSafe);

const targetWordCountInstruction = `Tu objetivo es escribir un capítulo de aproximadamente ${effectiveWordGoal} palabras (máximo ${maxWordsSafe}). Desarrolla la historia en varios párrafos.`;

    const userPromptBase = `\n      Título de la novela: "${bookData.title}"\n      Idea general de la novela: ${bookData.idea}\n      Escribe el contenido completo para el capítulo titulado: "${chapterCheck.title}".\n      Sinopsis del capítulo (úsala como guía): ${chapterCheck.synopsis || 'No hay sinopsis, por favor elabora basado en el título y el contexto general.'}`;

    const userPrompt = `${userPromptBase}\n      ${targetWordCountInstruction}\n      Atributos clave de la historia: ${JSON.stringify(bookData.book_attributes)}\n      Biblia del libro (personajes, lugares, etc.): ${JSON.stringify(bookData.bookbible)}\n    `;

    

const maxTokens = Math.min(
  Math.ceil(targetWordCount * TOKENS_PER_WORD) + SAFETY_MARGIN,
  MAX_TOKENS_CAP
);
    let fullPromptForLog = `SYSTEM: ${systemPrompt}\nUSER: ${userPrompt}`;

    // 5. LLAMAR AL AGENTE IA (via ai-service) - PRIMER INTENTO
    console.log("--- LLAMANDO A LA API DE IA (via ai-service) PARA ESCRIBIR CAPÍTULO ---");
    console.log(`Usando el modelo: ${actualModelNameForAPI} via ${providerData.name}. Max tokens: ${maxTokens}`);

    let aiResult = await callAI({
      config: {
        providerName: providerData.name,
        apiKey: apiKey,
        baseUrl: baseUrl,
        modelName: actualModelNameForAPI,
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    if (aiResult.error || !aiResult.content) {
      console.warn('Primer intento falló (MAX_TOKENS o contenido vacío). Reintentando con la mitad de palabras.');

      const reducedWordGoal = Math.floor(effectiveWordGoal / 2);
      const retryInstruction = `Tu objetivo es escribir un capítulo de aproximadamente ${reducedWordGoal} palabras (máximo ${Math.floor(maxWordsSafe/2)}). Desarrolla la historia en varios párrafos.`;

      const retryPrompt = `${userPromptBase}\n      ${retryInstruction}`;

      aiResult = await callAI({
        config: {
          providerName: providerData.name,
          apiKey: apiKey,
          baseUrl: baseUrl,
          modelName: actualModelNameForAPI,
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: retryPrompt },
        ],
        temperature: 0.7,
      });

      if (aiResult.error || !aiResult.content) {
        console.error('Error en la respuesta de la API de IA (segundo intento):', aiResult.error);
        throw new Error(`La API de IA respondió con un error tras reintento: ${aiResult.error || 'Contenido vacío.'}`);
      }
    }

    let aiResponseContent = aiResult.content.trim();
    if (!aiResponseContent) throw new Error('Received empty content from AI after trim (primer intento).');

    let actualWordCount = countWords(aiResponseContent);
    console.log(`Respuesta inicial recibida. Conteo de palabras: ${actualWordCount}`);

    /*
    // POST-VALIDACIÓN Y REAJUSTE DE LONGITUD
    const minTarget = bookData.book_attributes?.target_word_count ? Math.floor(targetWordCount * 0.85) : DEFAULT_WORD_COUNT_MIN;
    const maxTarget = bookData.book_attributes?.target_word_count ? Math.ceil(targetWordCount * 1.15) : DEFAULT_WORD_COUNT_MAX;

    if (actualWordCount < minTarget || actualWordCount > maxTarget) {
      console.log(`Conteo de palabras (${actualWordCount}) fuera del rango objetivo (${minTarget}-${maxTarget}). Solicitando reajuste.`);
      await supabaseClient.from('creation_logs').insert({
          book_id: bookData.id,
          message: `Ajustando longitud del capítulo '${chapterCheck.title}' (actual: ${actualWordCount} palabras, objetivo: ${bookData.book_attributes?.target_word_count ? targetWordCount : `${DEFAULT_WORD_COUNT_MIN}-${DEFAULT_WORD_COUNT_MAX}` } palabras)...`
      });

      const readjustmentUserPrompt = `El capítulo que escribiste tiene ${actualWordCount} palabras. Por favor, ajústalo para que tenga ${bookData.book_attributes?.target_word_count ? `aproximadamente ${targetWordCount}` : `entre ${DEFAULT_WORD_COUNT_MIN} y ${DEFAULT_WORD_COUNT_MAX}`} palabras. Mantén la trama y el estilo, pero expande o resume según sea necesario. Aquí está el texto original que necesita ajuste:\n\n${aiResponseContent}`;
      
      fullPromptForLog += `\n\n--- REAJUSTE ---\nSYSTEM: ${systemPrompt}\nUSER: ${readjustmentUserPrompt}`;
      const readjustmentMaxTokens = Math.ceil((bookData.book_attributes?.target_word_count ? targetWordCount : DEFAULT_TARGET_WORD_COUNT) * 1.5); // Un poco más de margen para reescribir

      console.log(`--- LLAMANDO A LA API DE IA PARA REAJUSTE DE LONGITUD (Max tokens: ${readjustmentMaxTokens}) ---`);
      aiResult = await callAI({
        config: {
            providerName: providerData.name,
            apiKey: apiKey,
            baseUrl: baseUrl,
            modelName: actualModelNameForAPI,
        },
        messages: [
            { role: 'system', content: systemPrompt }, // Reutilizar systemPrompt para mantener el contexto del rol
            { role: 'user', content: readjustmentUserPrompt },
        ],
        temperature: 0.7, 
        max_tokens: readjustmentMaxTokens,
      });

      if (aiResult.error || !aiResult.content) {
        console.error('Error en la respuesta de la API de IA (reajuste):', aiResult.error);
        throw new Error(`La API de IA respondió con un error (reajuste): ${aiResult.error || 'Contenido vacío.'}`);
      }

      // Actualizar el contenido con la nueva respuesta
      aiResponseContent = aiResult.content;
      actualWordCount = aiResponseContent.split(/\s+/).length;
      console.log(`Respuesta reajustada recibida. Nuevo conteo de palabras: ${actualWordCount}`);
    }
    */

    console.log("--- RESPUESTA FINAL DE LA IA PROCESADA ---");

    // 6. GUARDAR LOGS Y ACTUALIZAR BD
    await supabaseClient.from('ai_prompts_log').insert({
        book_id: bookData.id,
        chapter_id: chapter_id,
        phase: 'writing',
        prompt_text: fullPromptForLog, // Incluye el prompt de reajuste si se hizo
        response_text: aiResponseContent,
        model_used: actualModelNameForAPI,
        actual_word_count: actualWordCount // NUEVO: Registrar el conteo de palabras final
    });

    // --- INICIO: Modificación para depurar la llamada RPC ---
    console.log(`Intentando llamar a RPC 'update_chapter_and_log_progress' con chapter_id: ${chapter_id}, job_id: ${job_id}`);
    const rpcParams = {
      p_chapter_id: chapter_id,
      p_content: aiResponseContent,
      p_job_id: job_id
    };
    console.log('Parámetros RPC:', JSON.stringify(rpcParams, null, 2));

    const rpcResponse = await supabaseClient.rpc('update_chapter_and_log_progress', rpcParams);

    console.log('Respuesta completa de RPC:', JSON.stringify(rpcResponse, null, 2));

    if (rpcResponse.error) {
      console.error('Error detallado de RPC:', JSON.stringify(rpcResponse.error, null, 2));
      // Lanzar un error más específico para que sea claro en los logs
      throw new Error(`Llamada RPC 'update_chapter_and_log_progress' falló: ${rpcResponse.error.message}. Code: ${rpcResponse.error.code}. Details: ${rpcResponse.error.details}. Hint: ${rpcResponse.error.hint}`);
    }
    console.log('Datos de respuesta de RPC:', JSON.stringify(rpcResponse.data, null, 2));
    // --- FIN: Modificación para depurar la llamada RPC ---

    return new Response(JSON.stringify({ success: true, message: `Chapter ${chapter_id} written successfully.` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in write-chapter-content:', error.message);

    if (payload?.job_id) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await supabaseClient.from('jobs').update({
        status: 'failed',
        status_message: `Writer agent failed: ${error.message}`
      }).eq('id', payload.job_id);
    } else {
      console.error('Could not update job status on failure: job_id not available in payload.');
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
