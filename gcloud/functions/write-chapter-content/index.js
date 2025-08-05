const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');

// Variables de entorno de Supabase (mismas que write-chapter-content que funciona)
process.env.SUPABASE_URL = 'https://ydorhokujupnxpyrxczv.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb3Job2t1anVwbnhweXJ4Y3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDEzMTA0MCwiZXhwIjoyMDU1NzA3MDQwfQ.PW51n-DXxQ9h7xONqIZXmPgryG09tHoVNk8Tw7msEps';

// Función para obtener prompts traducidos desde la base de datos
async function getTranslatedPrompt(supabase, functionName, promptType, language, category = 'general') {
  console.log(`[getTranslatedPrompt] Buscando prompt: ${functionName}.${promptType} en ${language} (categoría: ${category})`);
  
  try {
    // Intentar obtener prompt específico para el idioma
    const { data: prompt, error } = await supabase
      .from('ai_prompts_multilingual')
      .select('prompt_content')
      .eq('function_name', functionName)
      .eq('prompt_type', promptType)
      .eq('language', language)
      .eq('category', category)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`[getTranslatedPrompt] Error consultando prompt: ${error.message}`);
      return null;
    }

    if (prompt) {
      console.log(`[getTranslatedPrompt] ✅ Prompt encontrado en ${language}`);
      return prompt.prompt_content;
    }

    // Fallback a inglés si no existe en el idioma solicitado
    console.log(`[getTranslatedPrompt] ⚠️ Prompt no encontrado en ${language}, intentando fallback a inglés...`);
    const { data: fallbackPrompt, error: fallbackError } = await supabase
      .from('ai_prompts_multilingual')
      .select('prompt_content')
      .eq('function_name', functionName)
      .eq('prompt_type', promptType)
      .eq('language', 'en')
      .eq('category', category)
      .eq('is_active', true)
      .maybeSingle();

    if (fallbackError) {
      console.error(`[getTranslatedPrompt] Error en fallback: ${fallbackError.message}`);
      return null;
    }

    if (fallbackPrompt) {
      console.log(`[getTranslatedPrompt] ✅ Usando fallback en inglés`);
      return fallbackPrompt.prompt_content;
    }

    console.log(`[getTranslatedPrompt] ❌ No se encontró prompt ni en ${language} ni en inglés`);
    return null;
  } catch (error) {
    console.error(`[getTranslatedPrompt] Error inesperado: ${error.message}`);
    return null;
  }
}

// Función para reemplazar placeholders en prompts
function replacePlaceholders(promptTemplate, variables) {
  let prompt = promptTemplate;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    prompt = prompt.replace(new RegExp(placeholder, 'g'), value || '');
  }
  
  return prompt;
}

// Constantes por defecto
const DEFAULT_TARGET_WORD_COUNT = 1500;
const DEFAULT_WORD_COUNT_MIN = 1200;
const DEFAULT_WORD_COUNT_MAX = 1800;

// Función para contar palabras
function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

// Estimación de tokens: 1 token ≈ 4 caracteres
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// Servicio de IA - Adaptado de ai-service
async function callAI(request) {
  const { config, messages, max_tokens, temperature, response_format } = request;

  if (!config.modelName) {
    const errorMsg = "AI model ID is missing (modelName is null or empty). Please ensure the selected model in the database has a 'provider_model_id' set.";
    console.error(`Error in callAI: ${errorMsg}`);
    return {
      content: null,
      error: errorMsg,
    };
  }

  if (config.providerName.toLowerCase() === 'openai') {
    const apiUrl = new URL('/v1/chat/completions', config.baseUrl);
    const headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = {
      model: config.modelName,
      messages: messages,
    };

    if (max_tokens) body.max_tokens = max_tokens;
    if (temperature !== undefined) body.temperature = temperature;
    if (response_format) body.response_format = response_format;

    try {
      console.log(`Calling OpenAI API: ${apiUrl.toString()} with model ${config.modelName}`);
      const apiResponse = await fetch(apiUrl.toString(), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });

      const jsonResponse = await apiResponse.json();

      if (!apiResponse.ok) {
        console.error('Error from OpenAI API:', jsonResponse);
        const errorMessage = jsonResponse.error?.message || `API responded with status ${apiResponse.status}`;
        return { content: null, error: errorMessage, rawResponse: jsonResponse };
      }

      const aiContent = jsonResponse.choices?.[0]?.message?.content;
      if (!aiContent) {
        return { content: null, error: 'OpenAI response did not contain valid content.', rawResponse: jsonResponse };
      }
      return { content: aiContent, rawResponse: jsonResponse };

    } catch (e) {
      console.error('Failed to call OpenAI API:', e);
      return { content: null, error: e.message };
    }
  } else if (config.providerName.toLowerCase() === 'gemini') {
    const geminiApiUrl = `${config.baseUrl}/v1beta/models/${config.modelName}:generateContent?key=${config.apiKey}`;
    
    let geminiContents = [];
    let currentRoleInternal = '';
    let currentParts = [];

    for (const msg of messages) {
        let targetRole = '';
        if (msg.role === 'system') {
            targetRole = 'user'; 
        } else if (msg.role === 'user') {
            targetRole = 'user';
        } else if (msg.role === 'assistant') {
            targetRole = 'model';
        }

        if (currentRoleInternal === '' || currentRoleInternal === targetRole) {
            currentParts.push({ text: msg.content });
        } else {
            if (currentParts.length > 0) {
                geminiContents.push({ role: currentRoleInternal, parts: currentParts });
            }
            currentParts = [{ text: msg.content }];
        }
        currentRoleInternal = targetRole;
    }
    
    if (currentParts.length > 0) {
        geminiContents.push({ role: currentRoleInternal, parts: currentParts });
    }
    
    const generationConfig = {};
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (max_tokens) generationConfig.maxOutputTokens = max_tokens; 
    if (response_format?.type === "json_object") {
        generationConfig.responseMimeType = "application/json";
    }
    
    // Soporte para razonamiento avanzado de Gemini (thinking budget)
    // Según documentación oficial: generationConfig.thinkingConfig.thinkingBudget
    if (config.thinkingBudget !== undefined && config.thinkingBudget !== null) {
      generationConfig.thinkingConfig = {
        thinkingBudget: config.thinkingBudget
      };
      console.log(`[callAI] Configurando thinking budget para Gemini: ${config.thinkingBudget}`);
    }

    const geminiBody = {
      contents: geminiContents,
      ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
    };

    try {
      console.log(`Calling Gemini API: ${geminiApiUrl} with model ${config.modelName}`);

      const apiResponse = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiBody),
      });

      const jsonResponse = await apiResponse.json();

      if (!apiResponse.ok) {
        console.error('Error from Gemini API:', jsonResponse);
        const errorMessage = jsonResponse.error?.message || `API responded with status ${apiResponse.status}`;
        return { content: null, error: errorMessage, rawResponse: jsonResponse };
      }

      const aiContent = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiContent) {
        console.error('Gemini response did not contain valid content:', jsonResponse);
        return { content: null, error: 'Gemini response did not contain valid content.', rawResponse: jsonResponse };
      }
      
      // 🔍 LOGGING DE THINKING BUDGET USAGE
      if (jsonResponse.usageMetadata) {
        const usage = jsonResponse.usageMetadata;
        console.log(`[callAI] 📊 Gemini Usage Metadata:`);
        console.log(`[callAI]   - Prompt tokens: ${usage.promptTokenCount || 'N/A'}`);
        console.log(`[callAI]   - Candidates tokens: ${usage.candidatesTokenCount || 'N/A'}`);
        console.log(`[callAI]   - Total tokens: ${usage.totalTokenCount || 'N/A'}`);
        
        if (usage.thinkingTokenCount !== undefined) {
          console.log(`[callAI] 🧠 THINKING TOKENS USED: ${usage.thinkingTokenCount}`);
          console.log(`[callAI] 🧠 Thinking budget was utilized!`);
        } else if (config.thinkingBudget !== undefined) {
          console.log(`[callAI] 🧠 Thinking budget configured (${config.thinkingBudget}) but no thinking tokens reported`);
        }
      }
      
      return { content: aiContent, rawResponse: jsonResponse };

    } catch (e) {
      console.error('Failed to call Gemini API:', e);
      return { content: null, error: e.message };
    }

  } else {
    console.error(`Unsupported AI provider: ${config.providerName}`);
    return { content: null, error: `Unsupported AI provider: ${config.providerName}` };
  }
}

// ===== FUNCIONES AUXILIARES PARA PROCESAMIENTO POR LOTES =====

// Función para procesar un solo capítulo
async function processSingleChapter(supabaseClient, chapterId, bookData, jobId) {
  console.log(`[SINGLE] Procesando capítulo: ${chapterId}`);
  
  // 1. Verificar si el capítulo ya tiene contenido (idempotencia)
  const { data: chapterCheck, error: checkError } = await supabaseClient
    .from('chapters')
    .select('content, title, synopsis, order_number')
    .eq('id', chapterId)
    .single();

  if (checkError) throw new Error(`Chapter check failed: ${checkError.message}`);
  if (chapterCheck.content) {
    console.log(`[SINGLE] Capítulo ${chapterId} ya tiene contenido. Saltando.`);
    return { success: true, skipped: true, chapter_id: chapterId };
  }

  // 2. Generar contenido del capítulo
  const content = await generateChapterContent(supabaseClient, chapterCheck, bookData);
  
  // 3. Guardar contenido en la base de datos
  const { error: updateError } = await supabaseClient
    .from('chapters')
    .update({ content })
    .eq('id', chapterId);

  if (updateError) throw new Error(`Failed to update chapter: ${updateError.message}`);

  // 4. Log de progreso
  await supabaseClient.from('creation_logs').insert({
    book_id: bookData.id,
    message: `✅ Capítulo completado: "${chapterCheck.title}" (${content.length} caracteres)`
  });

  console.log(`[SINGLE] ✅ Capítulo ${chapterId} completado exitosamente`);
  return { success: true, chapter_id: chapterId, title: chapterCheck.title };
}

// Función para procesar múltiples capítulos en lotes
async function processBatchChapters(supabaseClient, bookId, jobId, batchSize = 20) {
  console.log(`[BATCH] Iniciando procesamiento por lotes para libro: ${bookId}`);
  
  let logId = null;
  const startTime = Date.now();
  
  try {
    // 1. Obtener datos del libro
    const { data: bookData, error: bookError } = await supabaseClient
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();

    if (bookError) throw new Error(`Failed to get book data: ${bookError.message}`);

    // Crear log inicial en book_creation_logs
    try {
      const { data: logData, error: logError } = await supabaseClient
        .rpc('insert_book_creation_log', {
          p_book_id: bookId,
          p_step_type: 'chapter',
          p_step_detail: 'Escribiendo contenido de capítulos',
          p_status: 'in_progress',
          p_ai_request: null,
          p_ai_response: null,
          p_error_message: null,
          p_duration_seconds: null,
          p_word_count: null,
          p_tokens_used: null,
          p_ai_model: null
        });

      if (logError) {
        console.error('[BATCH] Error creando log:', logError);
      } else {
        logId = logData;
        console.log(`[BATCH] ✅ Log creado con ID: ${logId}`);
      }
    } catch (logErr) {
      console.error('[BATCH] Error en sistema de logging:', logErr);
    }

  // 2. Obtener capítulos pendientes (sin contenido)
  const { data: pendingChapters, error: chaptersError } = await supabaseClient
    .from('chapters')
    .select('id, title, synopsis, order_number')
    .eq('book_id', bookId)
    .is('content', null)
    .order('order_number');

  if (chaptersError) throw new Error(`Failed to get pending chapters: ${chaptersError.message}`);
  
  if (pendingChapters.length === 0) {
    console.log(`[BATCH] No hay capítulos pendientes para el libro ${bookId}`);
    return { success: true, message: 'No pending chapters', processed: 0 };
  }

  console.log(`[BATCH] Encontrados ${pendingChapters.length} capítulos pendientes`);

  // 3. Procesar capítulos en lotes
  const results = [];
  let totalProcessed = 0;
  let totalSkipped = 0;
  
  for (let i = 0; i < pendingChapters.length; i += batchSize) {
    const batch = pendingChapters.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(pendingChapters.length / batchSize);
    
    console.log(`[BATCH] Procesando lote ${batchNumber}/${totalBatches} (${batch.length} capítulos)`);
    
    // Log intermedio: Procesando lote específico
    if (logId) {
      try {
        await supabaseClient.rpc('update_book_creation_log', {
          p_log_id: logId,
          p_status: 'in_progress',
          p_ai_response: `Procesando lote ${batchNumber}/${totalBatches} - Escribiendo ${batch.length} capítulos...`,
          p_error_message: null,
          p_duration_seconds: null,
          p_word_count: totalProcessed,
          p_tokens_used: null
        });
      } catch (logErr) {
        console.warn('[BATCH] Error actualizando log intermedio:', logErr);
      }
    }
    
    // Actualizar progreso del job
    const progressPercentage = Math.round((totalProcessed / pendingChapters.length) * 100);
    await supabaseClient.from('jobs').update({
      status_message: `Escribiendo capítulos... (${totalProcessed + batch.length}/${pendingChapters.length})`,
      progress_percentage: Math.min(progressPercentage, 95) // Máximo 95% hasta completar
    }).eq('id', jobId);

    // Procesar lote en paralelo
    const batchPromises = batch.map(chapter => 
      processSingleChapter(supabaseClient, chapter.id, bookData, jobId)
        .catch(error => {
          console.error(`[BATCH] Error procesando capítulo ${chapter.id}:`, error.message);
          return { success: false, chapter_id: chapter.id, error: error.message };
        })
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Contar resultados del lote
    const batchProcessed = batchResults.filter(r => r.success && !r.skipped).length;
    const batchSkipped = batchResults.filter(r => r.skipped).length;
    const batchErrors = batchResults.filter(r => !r.success).length;
    
    totalProcessed += batchProcessed;
    totalSkipped += batchSkipped;
    
    console.log(`[BATCH] Lote ${batchNumber} completado: ${batchProcessed} procesados, ${batchSkipped} saltados, ${batchErrors} errores`);
    
    // Pausa breve entre lotes para evitar saturar la API de IA
    if (i + batchSize < pendingChapters.length) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos
    }
  }

  // 4. Actualizar job final
  const totalErrors = results.filter(r => !r.success).length;
  const finalMessage = totalErrors > 0 
    ? `Completado con errores: ${totalProcessed} exitosos, ${totalErrors} errores`
    : `Todos los capítulos completados exitosamente: ${totalProcessed} capítulos`;
    
  await supabaseClient.from('jobs').update({
    status: totalErrors > 0 ? 'completed_with_errors' : 'completed',
    status_message: finalMessage,
    progress_percentage: 100
  }).eq('id', jobId);

  console.log(`[BATCH] ✅ Procesamiento por lotes completado: ${totalProcessed} procesados, ${totalSkipped} saltados, ${totalErrors} errores`);
  
  // Actualizar log como completado
  if (logId) {
    try {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const status = totalErrors > 0 ? 'completed_with_errors' : 'completed';
      
      console.log(`[BATCH] Actualizando log a ${status}: ${duration}s, ${totalProcessed} capítulos`);
      
      await supabaseClient
        .rpc('update_book_creation_log', {
          p_log_id: logId,
          p_status: status,
          p_ai_response: `Capítulos escritos: ${totalProcessed} exitosos, ${totalSkipped} saltados, ${totalErrors} errores`,
          p_error_message: totalErrors > 0 ? `${totalErrors} capítulos con errores` : null,
          p_duration_seconds: duration,
          p_word_count: totalProcessed,
          p_tokens_used: null
        });
      
      console.log(`[BATCH] ✅ Log actualizado exitosamente: ${duration}s, ${totalProcessed} capítulos`);
    } catch (logErr) {
      console.error('[BATCH] ❌ Error actualizando log de éxito:', logErr);
    }
  }
  
    return {
      success: true,
      processed: totalProcessed,
      skipped: totalSkipped,
      errors: totalErrors,
      results
    };
  
  } catch (error) {
    console.error(`[BATCH] Error fatal en procesamiento por lotes:`, error);
    
    // Actualizar log con error
    if (logId) {
      try {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        await supabaseClient
          .rpc('update_book_creation_log', {
            p_log_id: logId,
            p_status: 'error',
            p_ai_response: null,
            p_error_message: error.message,
            p_duration_seconds: duration,
            p_word_count: null,
            p_tokens_used: null
          });
        
        console.log(`[BATCH] Log de error actualizado: ${duration}s`);
      } catch (logErr) {
        console.error('[BATCH] Error actualizando log de error:', logErr);
      }
    }
    
    // Re-lanzar el error para que sea manejado por el nivel superior
    throw error;
  }
}

// Función para procesar capítulos específicos por sus IDs (modo selectivo)
async function processSelectiveChapters(supabaseClient, bookId, chapterIds, jobId, batchSize = 20) {
  console.log(`[SELECTIVE] Iniciando procesamiento selectivo para libro: ${bookId}, capítulos: [${chapterIds.join(', ')}]`);
  
  // 1. Obtener datos del libro
  const { data: bookData, error: bookError } = await supabaseClient
    .from('books')
    .select('*')
    .eq('id', bookId)
    .single();

  if (bookError) throw new Error(`Failed to get book data: ${bookError.message}`);

  // 2. Obtener los capítulos específicos por sus IDs
  const { data: selectedChapters, error: chaptersError } = await supabaseClient
    .from('chapters')
    .select('id, title, synopsis, order_number')
    .eq('book_id', bookId)
    .in('id', chapterIds)
    .order('order_number');

  if (chaptersError) throw new Error(`Failed to get selected chapters: ${chaptersError.message}`);
  
  if (selectedChapters.length === 0) {
    console.log(`[SELECTIVE] No se encontraron capítulos con los IDs especificados`);
    return { success: true, message: 'No chapters found with specified IDs', processed: 0 };
  }

  console.log(`[SELECTIVE] Encontrados ${selectedChapters.length} capítulos para reescribir`);

  // 3. Procesar capítulos en lotes
  const results = [];
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  for (let i = 0; i < selectedChapters.length; i += batchSize) {
    const batch = selectedChapters.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(selectedChapters.length / batchSize);
    
    console.log(`[SELECTIVE] Procesando lote ${batchNumber}/${totalBatches} (${batch.length} capítulos)`);
    
    // Actualizar progreso del job
    const progressPercentage = Math.round((totalProcessed / selectedChapters.length) * 100);
    await supabaseClient.from('jobs').update({
      status_message: `Reescribiendo capítulos seleccionados... (${totalProcessed + batch.length}/${selectedChapters.length})`,
      progress_percentage: Math.min(progressPercentage, 95) // Máximo 95% hasta completar
    }).eq('id', jobId);

    // Procesar lote en paralelo
    const batchPromises = batch.map(chapter => 
      processSingleChapter(supabaseClient, chapter.id, bookData, jobId)
        .catch(error => {
          console.error(`[SELECTIVE] Error procesando capítulo ${chapter.id}:`, error.message);
          return { success: false, error: error.message, chapter_id: chapter.id };
        })
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Contar resultados del lote
    const batchProcessed = batchResults.filter(r => r.success).length;
    const batchSkipped = batchResults.filter(r => r.skipped).length;
    const batchErrors = batchResults.filter(r => !r.success && !r.skipped).length;
    
    totalProcessed += batchProcessed;
    totalSkipped += batchSkipped;
    totalErrors += batchErrors;
    
    console.log(`[SELECTIVE] Lote ${batchNumber} completado: ${batchProcessed} procesados, ${batchSkipped} omitidos, ${batchErrors} errores`);
  }

  // Actualizar progreso final
  await supabaseClient.from('jobs').update({
    status: 'completed',
    status_message: `Reescritura selectiva completada: ${totalProcessed} capítulos procesados, ${totalSkipped} omitidos, ${totalErrors} errores`,
    progress_percentage: 100
  }).eq('id', jobId);

  console.log(`[SELECTIVE] Procesamiento selectivo completado: ${totalProcessed} procesados, ${totalSkipped} omitidos, ${totalErrors} errores`);
  
  return {
    success: true,
    message: 'Selective batch processing completed',
    total: selectedChapters.length,
    processed: totalProcessed,
    skipped: totalSkipped,
    errors: totalErrors,
    results
  };
}

// Función para generar contenido de un capítulo usando IA
async function generateChapterContent(supabaseClient, chapterData, bookData) {
  console.log(`[AI] Generando contenido para: "${chapterData.title}"`);
  
  // 1. Obtener configuración de IA
  const { data: aiModel, error: aiError } = await supabaseClient
    .from('ai_models')
    .select(`
      id, name, provider_model_id, max_tokens,
      ai_providers!inner (
        id, name, base_url, api_key
      )
    `)
    .eq('id', bookData.ai_config?.writer_model_id)
    .single();

  if (aiError) throw new Error(`Failed to get AI model: ${aiError.message}`);

  const aiConfig = {
    providerName: aiModel.ai_providers.name,
    apiKey: aiModel.ai_providers.api_key,
    baseUrl: aiModel.ai_providers.base_url,
    modelName: aiModel.provider_model_id || aiModel.name // Fallback al name si provider_model_id es null
  };
  
  // Añadir thinking budget si está configurado para modelos Gemini
  if (bookData.ai_config?.writer?.thinkingBudget !== undefined && 
      aiModel.ai_providers.name.toLowerCase().includes('gemini')) {
    aiConfig.thinkingBudget = bookData.ai_config.writer.thinkingBudget;
    console.log(`[write-chapter-content] Thinking budget configurado: ${aiConfig.thinkingBudget}`);
  }
  
  console.log(`[AI] Configuración del modelo: ${aiConfig.providerName} - ${aiConfig.modelName}`);
  
  if (!aiConfig.modelName) {
    throw new Error(`Modelo de IA mal configurado: tanto provider_model_id como name están vacíos para el modelo ${aiModel.id}`);
  }

  // 2. Obtener prompts traducidos desde la base de datos
  console.log(`[AI] Obteniendo prompts traducidos para idioma: ${bookData.language}`);
  
  const systemPromptTemplate = await getTranslatedPrompt(supabaseClient, 'write_chapter', 'system', bookData.language);
  const userPromptTemplate = await getTranslatedPrompt(supabaseClient, 'write_chapter', 'user', bookData.language);
  
  if (!systemPromptTemplate || !userPromptTemplate) {
    throw new Error(`No se encontraron prompts traducidos para write_chapter en idioma ${bookData.language}`);
  }
  
  // 3. Preparar contexto de capítulos anteriores
  const { data: previousChapters, error: prevError } = await supabaseClient
    .from('chapters')
    .select('order_number, title, synopsis, content')
    .eq('book_id', chapterData.book_id)
    .lt('order_number', chapterData.order_number)
    .is('content', 'not.null') // Solo capítulos que ya tienen contenido
    .order('order_number')
    .limit(3); // Últimos 3 capítulos para contexto

  let previousChaptersContext = '';
  if (previousChapters && previousChapters.length > 0) {
    previousChaptersContext = 'CAPÍTULOS ANTERIORES (para continuidad narrativa):\n';
    previousChapters.forEach(ch => {
      const contentPreview = ch.content ? ch.content.substring(0, 200) + '...' : 'Sin contenido';
      previousChaptersContext += `${ch.order_number}. ${ch.title}\n   Sinopsis: ${ch.synopsis}\n   Inicio: ${contentPreview}\n\n`;
    });
  }
  
  // 4. Reemplazar placeholders con datos del capítulo (INCLUYENDO JSON SCHEMA VARIABLES)
  const targetWordCount = bookData.book_attributes?.target_word_count || DEFAULT_TARGET_WORD_COUNT;
  
  // Procesar variables del JSON Schema estructurado
  let keyElementsText = 'No especificados';
  let referencesPreviousText = 'Ninguna';
  let setsUpFutureText = 'Ninguna';
  
  if (chapterData.key_elements) {
    try {
      const keyElements = typeof chapterData.key_elements === 'string' 
        ? JSON.parse(chapterData.key_elements) 
        : chapterData.key_elements;
      keyElementsText = Array.isArray(keyElements) ? keyElements.join(', ') : keyElementsText;
    } catch (e) {
      console.warn(`[AI] Error parseando key_elements: ${e.message}`);
    }
  }
  
  if (chapterData.connections) {
    try {
      const connections = typeof chapterData.connections === 'string' 
        ? JSON.parse(chapterData.connections) 
        : chapterData.connections;
      
      if (connections.references_previous && Array.isArray(connections.references_previous)) {
        referencesPreviousText = connections.references_previous.join(', ');
      }
      if (connections.sets_up_future && Array.isArray(connections.sets_up_future)) {
        setsUpFutureText = connections.sets_up_future.join(', ');
      }
    } catch (e) {
      console.warn(`[AI] Error parseando connections: ${e.message}`);
    }
  }
  
  const promptVariables = {
    title: bookData.title,
    category: bookData.category,
    language: bookData.language,
    chapter_title: chapterData.title,
    chapter_number: chapterData.order_number,
    total_chapters: bookData.target_number_of_chapters,
    chapter_synopsis: chapterData.synopsis || 'Elabora basado en el título y el contexto general.',
    book_bible: bookData.book_bible ? JSON.stringify(bookData.book_bible, null, 2) : 'No disponible',
    previous_chapters_context: previousChaptersContext,
    target_word_count: targetWordCount,
    // Variable estándar que contiene todos los atributos de subcategoría
    subcategory_attributes: bookData.book_attributes ? JSON.stringify(bookData.book_attributes, null, 2) : 'No hay atributos específicos para esta subcategoría',
    // NUEVAS VARIABLES DEL JSON SCHEMA ESTRUCTURADO
    narrative_function: chapterData.narrative_function || 'No especificada',
    emotional_intensity: chapterData.emotional_intensity || 5,
    key_elements: keyElementsText,
    references_previous: referencesPreviousText,
    sets_up_future: setsUpFutureText,
    // Incluir todos los book_attributes como variables individuales (para compatibilidad)
    ...bookData.book_attributes
  };
  
  console.log(`[AI] Variables disponibles para capítulo:`, Object.keys(promptVariables));
  console.log(`[AI] Book attributes incluidos:`, Object.keys(bookData.book_attributes || {}));
  
  const systemPrompt = replacePlaceholders(systemPromptTemplate, promptVariables);
  const userPrompt = replacePlaceholders(userPromptTemplate, promptVariables);
  
  console.log(`[AI] ✅ Prompts preparados en ${bookData.language}`);
  console.log(`[AI] System prompt length: ${systemPrompt.length}`);
  console.log(`[AI] User prompt length: ${userPrompt.length}`);

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: userPrompt
    }
  ];

  // 5. Llamar a la IA
  // Usar el máximo de tokens disponible del modelo para evitar cortar el contenido
  // La IA respetará el target_word_count especificado en el prompt
  const maxTokens = aiModel.max_tokens || 8000; // Usar el límite máximo del modelo
  
  console.log(`[AI] Target words: ${targetWordCount}, Max tokens: ${maxTokens}`);
  console.log(`[AI] Ratio estimado: ${(maxTokens / targetWordCount).toFixed(2)} tokens por palabra`);

  // Log intermedio: Enviando prompt a IA para generar contenido del capítulo
  const promptToLog = JSON.stringify({
    system: systemPrompt,
    user: userPrompt,
    config: {
      model: aiConfig.modelName,
      provider: aiConfig.providerName,
      max_tokens: maxTokens,
      temperature: 0.7,
      target_word_count: targetWordCount
    }
  });
  
  const { data: promptLog, error: promptLogError } = await supabaseClient
    .rpc('insert_book_creation_log', {
      p_book_id: chapterData.book_id,
      p_step_type: 'chapter',
      p_step_detail: `Enviando prompt a IA para generar contenido del capítulo ${chapterData.order_number}: "${chapterData.title}"`,
      p_status: 'in_progress',
      p_ai_request: promptToLog,
      p_ai_response: null,
      p_error_message: null,
      p_duration_seconds: null,
      p_word_count: null,
      p_tokens_used: null,
      p_ai_model: `${aiConfig.modelName} (${aiConfig.providerName})`
    });
  
  if (promptLogError) {
    console.warn('[write-chapter-content] Error creando log de prompt:', promptLogError);
  }

  const aiResponse = await callAI({
    config: aiConfig,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7 // Valor por defecto ya que la columna temperature no existe en ai_models
  });

  if (aiResponse.error) {
    throw new Error(`AI generation failed: ${aiResponse.error}`);
  }

  const content = aiResponse.content;
  const wordCount = countWords(content);
  
  console.log(`[AI] ✅ Contenido generado: ${wordCount} palabras, ${content.length} caracteres`);
  
  // Log intermedio: Respuesta de IA recibida
  const { data: responseLog, error: responseLogError } = await supabaseClient
    .rpc('insert_book_creation_log', {
      p_book_id: chapterData.book_id,
      p_step_type: 'chapter',
      p_step_detail: `Contenido del capítulo ${chapterData.order_number} generado (${wordCount} palabras, ${content.length} caracteres)`,
      p_status: 'completed',
      p_ai_request: null,
      p_ai_response: content.length > 8000 ? content.substring(0, 8000) + '... [contenido truncado]' : content,
      p_error_message: null,
      p_duration_seconds: null,
      p_word_count: wordCount,
      p_tokens_used: aiResponse.usage?.total_tokens || null,
      p_ai_model: `${aiConfig.modelName} (${aiConfig.providerName})`
    });
  
  if (responseLogError) {
    console.warn('[write-chapter-content] Error creando log de respuesta:', responseLogError);
  }
  
  return content;
}

// ===== FUNCIÓN PRINCIPAL DE GOOGLE CLOUD FUNCTIONS =====

functions.http('write-chapter-content', async (req, res) => {
  // Configurar CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  let payload = null;

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    payload = req.body;
    console.log('[MAIN] Payload recibido:', JSON.stringify(payload, null, 2));

    // Validar payload - soporta tres modos: individual, lote completo y lote selectivo
    const isBatchMode = payload.book_id && payload.job_id && !payload.chapter_id && !payload.chapter_ids;
    const isSingleMode = payload.chapter_id && payload.job_id && !payload.chapter_ids;
    const isSelectiveBatchMode = payload.book_id && payload.job_id && payload.chapter_ids && Array.isArray(payload.chapter_ids);
    
    if (!isBatchMode && !isSingleMode && !isSelectiveBatchMode) {
      throw new Error('Invalid payload: Either (book_id + job_id) for batch mode, (chapter_id + job_id) for single mode, or (book_id + job_id + chapter_ids[]) for selective batch mode required.');
    }

    // Crear cliente Supabase usando variables de entorno
    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Determinar modo de operación y ejecutar
    if (isBatchMode) {
      console.log(`[MAIN] Iniciando modo LOTE para book_id: ${payload.book_id}, job_id: ${payload.job_id}`);
      
      const batchSize = payload.batch_size || 20; // Tamaño de lote configurable
      const result = await processBatchChapters(supabaseClient, payload.book_id, payload.job_id, batchSize);
      
      return res.status(200).json({
        success: true,
        mode: 'batch',
        ...result
      });
    } else if (isSelectiveBatchMode) {
      console.log(`[MAIN] Iniciando modo LOTE SELECTIVO para book_id: ${payload.book_id}, job_id: ${payload.job_id}, chapter_ids: [${payload.chapter_ids.join(', ')}]`);
      
      const batchSize = payload.batch_size || 20; // Tamaño de lote configurable
      const result = await processSelectiveChapters(supabaseClient, payload.book_id, payload.chapter_ids, payload.job_id, batchSize);
      
      return res.status(200).json({
        success: true,
        mode: 'selective_batch',
        ...result
      });
    } else {
      console.log(`[MAIN] Iniciando modo INDIVIDUAL para chapter_id: ${payload.chapter_id}, job_id: ${payload.job_id}`);
      
      // Obtener datos del libro para el capítulo individual
      const { data: chapterData, error: chapterError } = await supabaseClient
        .from('chapters')
        .select('book_id')
        .eq('id', payload.chapter_id)
        .single();
        
      if (chapterError) throw new Error(`Failed to get chapter data: ${chapterError.message}`);
      
      const { data: bookData, error: bookError } = await supabaseClient
        .from('books')
        .select('*')
        .eq('id', chapterData.book_id)
        .single();
        
      if (bookError) throw new Error(`Failed to get book data: ${bookError.message}`);
      
      const result = await processSingleChapter(supabaseClient, payload.chapter_id, bookData, payload.job_id);
      
      return res.status(200).json({
        success: true,
        mode: 'single',
        ...result
      });
    }

  } catch (error) {
    console.error('[MAIN] Error in write-chapter-content:', error.message);
    console.error('[MAIN] Stack trace:', error.stack);

    // Intentar actualizar el job con el error
    if (payload?.job_id) {
      try {
        const supabaseClient = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const errorMessage = payload.book_id 
          ? `Error en procesamiento por lotes: ${error.message}`
          : `Error en capítulo individual: ${error.message}`;
          
        await supabaseClient.from('jobs').update({
          status: 'failed',
          status_message: errorMessage,
          error_message: error.message
        }).eq('id', payload.job_id);
        
        console.log('[MAIN] Job actualizado con estado de error');
      } catch (updateError) {
        console.error('[MAIN] Error actualizando job status:', updateError.message);
      }
    } else {
      console.error('[MAIN] No se pudo actualizar job status: job_id no disponible en payload.');
    }

    return res.status(500).json({
      success: false,
      error: error.message,
      mode: payload?.book_id ? 'batch' : 'single'
    });
  }
});
