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

// ===== AI SERVICE - DEPENDENCIA MIGRADA =====
// Tipos para el servicio de IA (usando comentarios JSDoc para JavaScript)

/**
 * @typedef {Object} AIProviderConfig
 * @property {string} providerName
 * @property {string} apiKey
 * @property {string} baseUrl
 * @property {string} modelName
 */

/**
 * @typedef {Object} AIMessage
 * @property {'system'|'user'|'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} AIRequest
 * @property {AIProviderConfig} config
 * @property {AIMessage[]} messages
 * @property {number} [max_tokens]
 * @property {number} [temperature]
 * @property {{type: string}} [response_format]
 */

/**
 * @typedef {Object} AIResponse
 * @property {string|null} content
 * @property {string} [error]
 * @property {any} [rawResponse]
 */

// Función callAI migrada desde ai-service con reintentos para APIs sobrecargadas
async function callAI(request, retryCount = 0) {
  const { config, messages, max_tokens, temperature, response_format, system, user } = request;
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s

  if (!config.modelName) {
    const errorMsg = "AI model ID is missing (modelName is null or empty). Please ensure the selected model in the database has a 'provider_model_id' set.";
    console.error(`Error in callAI: ${errorMsg}`);
    return {
      content: null,
      error: errorMsg,
    };
  }

  // Función helper para esperar
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        
        // Reintentar para errores 503 (API sobrecargada) y 429 (rate limit)
        if ((apiResponse.status === 503 || apiResponse.status === 429) && retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retryCount];
          console.log(`[callAI] API sobrecargada/limitada (${apiResponse.status}), reintentando en ${delay}ms... (intento ${retryCount + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          return await callAI(request, retryCount + 1);
        }
        
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

    // MANEJAR PARÁMETROS SYSTEM Y USER DIRECTOS (NUEVA FUNCIONALIDAD)
    let messagesToProcess = messages;
    if (system && user) {
        messagesToProcess = [
            { role: 'system', content: system },
            { role: 'user', content: user }
        ];
    }

    for (const msg of messagesToProcess) {
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
    
    // SOPORTE PARA JSON SCHEMA ESTRUCTURADO (NUEVA FUNCIONALIDAD)
    if (config.response_mime_type) {
        generationConfig.responseMimeType = config.response_mime_type;
    }
    if (config.response_schema) {
        generationConfig.responseSchema = config.response_schema;
        console.log(`[callAI] 🎯 JSON Schema estructurado habilitado`);
    }
    
    // Fallback para formato JSON legacy
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
        
        // Reintentar para errores 503 (API sobrecargada)
        if (apiResponse.status === 503 && retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retryCount];
          console.log(`[callAI] API sobrecargada (503), reintentando en ${delay}ms... (intento ${retryCount + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          return await callAI(request, retryCount + 1);
        }
        
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

// ===== FUNCIÓN PRINCIPAL GENERATE-BOOK-OUTLINE =====

functions.http('generate-book-outline', async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // 1. Validar método y parsear payload de forma segura
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  let payload;
  try {
    payload = req.body;
    if (!payload) {
      throw new Error('No payload provided');
    }
  } catch (e) {
    console.error('Error parsing payload:', e);
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }
  
  const { book_id, job_id, start_chapter, end_chapter } = payload;

  if (!book_id || !job_id) {
    res.status(400).json({ error: 'book_id and job_id are required' });
    return;
  }

  // Inicializar cliente de Supabase
  const supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let logId = null;
  const startTime = Date.now();

  try {
    console.log(`[generate-book-outline] Función iniciada para job_id: ${job_id}, book_id: ${book_id}`);

    // Crear log inicial en book_creation_logs
    try {
      const { data: logData, error: logError } = await supabaseClient
        .rpc('insert_book_creation_log', {
          p_book_id: book_id,
          p_step_type: 'outline',
          p_step_detail: 'Generando esquema de capítulos',
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
        console.error('[generate-book-outline] Error creando log:', logError);
      } else {
        logId = logData;
        console.log(`[generate-book-outline] ✅ Log creado con ID: ${logId}`);
      }
    } catch (logErr) {
      console.error('[generate-book-outline] Error en sistema de logging:', logErr);
    }

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

    if (bookError) {
      console.error('Error fetching book data:', bookError);
      throw bookError;
    }
    console.log('[generate-book-outline] Datos del libro obtenidos.');

    // ✅ CONTROL DE IDEMPOTENCIA: Verificar si ya existen capítulos
    const { data: existingChapters, error: chaptersError } = await supabaseClient
      .from('chapters')
      .select('id, order_number, title, synopsis, content')
      .eq('book_id', book_id)
      .order('order_number');

    if (chaptersError) {
      console.error('[generate-book-outline] Error verificando capítulos existentes:', chaptersError);
    } else if (existingChapters && existingChapters.length > 0) {
      console.log(`[generate-book-outline] ⚠️ DUPLICACIÓN EVITADA: El libro ya tiene ${existingChapters.length} capítulos`);
      
      // Verificar si hay capítulos con contenido
      const chaptersWithContent = existingChapters.filter(ch => ch.content && ch.content.trim() !== '');
      console.log(`[generate-book-outline] Capítulos con contenido: ${chaptersWithContent.length}/${existingChapters.length}`);
      
      // Actualizar log con mensaje de duplicación evitada
      if (logId) {
        try {
          await supabaseClient.rpc('update_book_creation_log', {
            p_log_id: logId,
            p_status: 'completed',
            p_ai_response: `⚠️ Esquema ya existía - duplicación evitada (${existingChapters.length} capítulos)`,
            p_error_message: null,
            p_duration_seconds: Math.floor((Date.now() - startTime) / 1000),
            p_word_count: null,
            p_tokens_used: null
          });
        } catch (logErr) {
          console.warn('[generate-book-outline] Error actualizando log de duplicación:', logErr);
        }
      }
      
      // Actualizar job a completado
      await supabaseClient.from('jobs').update({
        status: 'completed',
        status_message: `Esquema ya existía - duplicación evitada (${existingChapters.length} capítulos)`,
        progress_percentage: 100
      }).eq('id', job_id);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Outline already exists - duplication avoided',
        chapters_count: existingChapters.length,
        chapters_with_content: chaptersWithContent.length
      });
    }
    
    console.log(`[generate-book-outline] ✅ No existen capítulos, procediendo con generación...`);

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
    console.log(`[generate-book-outline] --- CONFIGURACIÓN DE IA OBTENIDA (Modelo: ${actualModelNameForAPI}) ---`);

    // --- INICIO: Obtener instrucciones ---
    const { data: instructionsData, error: instructionsError } = await supabaseClient
      .from('category_instructions')
      .select('instructions')
      .eq('category', bookData.category)
      .eq('subcategory', bookData.subcategory)
      .maybeSingle();

    if (instructionsError) {
        console.warn(`Error al buscar instrucciones para ${bookData.category}/${bookData.subcategory}, se continuará sin ellas.`);
    }
    // --- FIN: Obtener instrucciones ---

    // 4. GENERAR BOOK BIBLE PRIMERO (NUEVO)
    console.log(`[generate-book-outline] === GENERANDO BOOK BIBLE PRIMERO ===`);
    
    // Log intermedio: Iniciando generación de book bible
    if (logId) {
      try {
        await supabaseClient.rpc('update_book_creation_log', {
          p_log_id: logId,
          p_status: 'in_progress',
          p_ai_response: 'Iniciando generación de book bible...',
          p_error_message: null,
          p_duration_seconds: null,
          p_word_count: null,
          p_tokens_used: null
        });
      } catch (logErr) {
        console.warn('[generate-book-outline] Error actualizando log intermedio:', logErr);
      }
    }
    
    try {
        const bookBibleResponse = await fetch(`${process.env.GCLOUD_FUNCTION_URL || 'https://europe-west1-export-document-project.cloudfunctions.net'}/generate-book-bible`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ 
                book_id: book_id,
                job_id: job_id
            })
        });

        if (!bookBibleResponse.ok) {
            throw new Error(`Error generando book bible: ${bookBibleResponse.status}`);
        }

        console.log(`[generate-book-outline] ✅ Book bible generado exitosamente`);
        
        // Log intermedio: Book bible completado
        if (logId) {
          try {
            await supabaseClient.rpc('update_book_creation_log', {
              p_log_id: logId,
              p_status: 'in_progress',
              p_ai_response: 'Book bible generado exitosamente. Iniciando generación de capítulos...',
              p_error_message: null,
              p_duration_seconds: null,
              p_word_count: null,
              p_tokens_used: null
            });
          } catch (logErr) {
            console.warn('[generate-book-outline] Error actualizando log intermedio:', logErr);
          }
        }
        
        // Recargar datos del libro para obtener el book_bible
        const { data: updatedBookData, error: reloadError } = await supabaseClient
            .from('books')
            .select('*')
            .eq('id', book_id)
            .single();

        if (reloadError) throw reloadError;
        
        // Usar los datos actualizados que incluyen el book_bible
        Object.assign(bookData, updatedBookData);
        
    } catch (error) {
        console.error('[generate-book-outline] Error generando book bible:', error);
        // Continuar sin book bible si falla
        console.warn('[generate-book-outline] Continuando sin book bible...');
    }

    // 5. PROCESAMIENTO POR LOTES PARA GENERAR EL ESQUEMA (MODIFICADO)

    const targetNumberOfChapters = bookData.book_attributes?.target_number_of_chapters || bookData.book_attributes?.extension || 10;
    console.log(`[generate-book-outline] Número total de capítulos a generar: ${targetNumberOfChapters}`);

    const BATCH_SIZE = 12; // tamaño de lote optimizado para evitar truncamiento
    
    // NUEVA LÓGICA: Detectar automáticamente desde qué capítulo continuar
    console.log(`[generate-book-outline] === DETECTANDO CAPÍTULOS EXISTENTES ===`);
    
    const { data: existingChaptersCheck, error: existingCheckError } = await supabaseClient
        .from('chapters')
        .select('order_number')
        .eq('book_id', book_id)
        .order('order_number', { ascending: false })
        .limit(1);
    
    if (existingCheckError) {
        console.warn(`Error verificando capítulos existentes: ${existingCheckError.message}`);
    }
    
    let autoStartChapter = 1;
    if (existingChaptersCheck && existingChaptersCheck.length > 0) {
        const lastExistingChapter = existingChaptersCheck[0].order_number;
        autoStartChapter = lastExistingChapter + 1;
        console.log(`[generate-book-outline] ✅ Detectados ${lastExistingChapter} capítulos existentes. Continuando desde capítulo ${autoStartChapter}`);
    } else {
        console.log(`[generate-book-outline] ℹ️ No hay capítulos existentes. Comenzando desde capítulo 1`);
    }
    
    // Determinar rango actual (usar detección automática si no se especifica start_chapter)
    const startChapter = start_chapter && start_chapter > 0 ? start_chapter : autoStartChapter;
    const endChapter = end_chapter && end_chapter >= startChapter ? end_chapter : Math.min(startChapter + BATCH_SIZE - 1, targetNumberOfChapters);
    
    console.log(`[generate-book-outline] 📊 Rango determinado: ${startChapter}-${endChapter} (de ${targetNumberOfChapters} total)`);
    
    // Log intermedio: Iniciando procesamiento por lotes
    if (logId) {
      try {
        await supabaseClient.rpc('update_book_creation_log', {
          p_log_id: logId,
          p_status: 'in_progress',
          p_ai_response: `Procesando capítulos ${startChapter}-${endChapter} de ${targetNumberOfChapters} total...`,
          p_error_message: null,
          p_duration_seconds: null,
          p_word_count: null,
          p_tokens_used: null
        });
      } catch (logErr) {
        console.warn('[generate-book-outline] Error actualizando log intermedio:', logErr);
      }
    }
    
    // Verificar si ya está completo
    if (startChapter > targetNumberOfChapters) {
        console.log(`[generate-book-outline] ✅ LIBRO YA COMPLETO: Todos los ${targetNumberOfChapters} capítulos ya están generados`);
        
        await supabaseClient.from('jobs').update({
            status: 'completed',
            status_message: 'Libro completado - todos los capítulos ya estaban generados',
            progress_percentage: 100,
            updated_at: new Date().toISOString()
        }).eq('id', job_id);
        
        return res.status(200).json({ 
            success: true, 
            message: 'Libro ya completo',
            chapters_existing: startChapter - 1,
            chapters_target: targetNumberOfChapters
        });
    }
    
    // Obtener prompts traducidos desde la base de datos
    console.log(`[generate-book-outline] Obteniendo prompts traducidos para idioma: ${bookData.language}`);
    
    const systemPromptTemplate = await getTranslatedPrompt(supabaseClient, 'generate_outline', 'system', bookData.language);
    const userPromptTemplate = await getTranslatedPrompt(supabaseClient, 'generate_outline', 'user', bookData.language);
    
    if (!systemPromptTemplate || !userPromptTemplate) {
      throw new Error(`No se encontraron prompts traducidos para generate_outline en idioma ${bookData.language}`);
    }
    
    console.log(`[generate-book-outline] ✅ Prompts base obtenidos en ${bookData.language}`);

    // Función auxiliar recursiva que divide el rango si el parseo falla (MODIFICADA)
    const generateWithFallback = async (start, end) => {
        const chaptersCount = end - start + 1;
        
        // NUEVO: Obtener solo los últimos 10 capítulos para contexto (evitar crecimiento exponencial)
        const { data: existingChapters, error: existingError } = await supabaseClient
            .from('chapters')
            .select('order_number, title, synopsis')
            .eq('book_id', book_id)
            .lt('order_number', start) // Solo capítulos anteriores al rango actual
            .order('order_number', { ascending: false })
            .limit(10); // LÍMITE: Solo últimos 10 capítulos para evitar prompts gigantes

        if (existingError) {
            console.warn(`Error obteniendo capítulos existentes: ${existingError.message}`);
        }

        // Construir contexto de capítulos previos (LIMITADO para evitar timeouts)
        let previousChaptersContext = '';
        if (existingChapters && existingChapters.length > 0) {
            // Solo últimos 10 capítulos para mantener contexto manejable
            const recentChapters = existingChapters.slice(-10).reverse(); // Orden cronológico
            previousChaptersContext = `\n\nCONTEXTO RECIENTE (últimos capítulos generados):\n`;
            recentChapters.forEach(ch => {
                previousChaptersContext += `${ch.order_number}. ${ch.title}\n   Sinopsis: ${ch.synopsis}\n`;
            });
            previousChaptersContext += `\nIMPORTANTE: Mantén coherencia con el contexto reciente y evita duplicación.\n`;
        }

        // Incluir book bible en el contexto
        let bookBibleContext = '';
        if (bookData.book_bible && Object.keys(bookData.book_bible).length > 0) {
            bookBibleContext = `\n\nBOOK BIBLE (guía de coherencia):\n${JSON.stringify(bookData.book_bible, null, 2)}\n\nSigue esta guía para mantener coherencia en personajes, temas, tono y estructura.\n`;
        }
        
        // Preparar variables para reemplazar placeholders (PARA TODO EL LOTE)
        const promptVariables = {
            title: bookData.title,
            category: bookData.category,
            subcategory: bookData.subcategory,
            idea: bookData.idea,
            language: bookData.language,
            start_chapter: start,  // Capítulo inicial del lote
            end_chapter: end,      // Capítulo final del lote
            total_chapters: targetNumberOfChapters,
            existing_chapters_context: previousChaptersContext,
            book_bible: bookData.book_bible ? JSON.stringify(bookData.book_bible, null, 2) : 'No disponible',
            // Variable estándar que contiene todos los atributos de subcategoría
            subcategory_attributes: bookData.book_attributes ? JSON.stringify(bookData.book_attributes, null, 2) : 'No hay atributos específicos para esta subcategoría',
            // Incluir todos los book_attributes como variables individuales (para compatibilidad)
            ...bookData.book_attributes
        };
        
        console.log(`[generate-book-outline] 🚀 PROCESAMIENTO POR LOTES REAL: Generando capítulos ${start}-${end} en UNA sola llamada`);
        console.log(`[generate-book-outline] Variables disponibles para el lote:`, Object.keys(promptVariables));
        console.log(`[generate-book-outline] Book attributes incluidos:`, Object.keys(bookData.book_attributes || {}));
        
        // Reemplazar placeholders en los prompts (UNA VEZ PARA TODO EL LOTE)
        const systemPrompt = replacePlaceholders(systemPromptTemplate, promptVariables);
        const userPrompt = replacePlaceholders(userPromptTemplate, promptVariables);
        
        console.log(`[generate-book-outline] 🚀 Generando lote completo ${start}-${end} con prompts en ${bookData.language}...`);
        console.log(`[generate-book-outline] System prompt length: ${systemPrompt.length}`);
        console.log(`[generate-book-outline] User prompt length: ${userPrompt.length}`);
        
        // DEFINIR JSON SCHEMA ESTRUCTURADO para forzar formato exacto
        const chapterSchema = {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              chapter_number: { type: "INTEGER" },
              title: { type: "STRING" },
              synopsis: { type: "STRING" },
              narrative_function: { type: "STRING" },
              emotional_intensity: { type: "INTEGER" },
              key_elements: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              connections: {
                type: "OBJECT",
                properties: {
                  references_previous: {
                    type: "ARRAY",
                    items: { type: "INTEGER" }
                  },
                  sets_up_future: {
                    type: "ARRAY",
                    items: { type: "INTEGER" }
                  }
                },
                required: ["references_previous", "sets_up_future"]
              }
            },
            required: ["chapter_number", "title", "synopsis", "narrative_function", "emotional_intensity", "key_elements", "connections"],
            propertyOrdering: ["chapter_number", "title", "synopsis", "narrative_function", "emotional_intensity", "key_elements", "connections"]
          }
        };

        // Log intermedio: Enviando prompt a IA para TODO EL LOTE
        const promptToLog = JSON.stringify({
          system: systemPrompt.substring(0, 500) + '...',
          user: userPrompt.substring(0, 500) + '...',
          schema: 'JSON Schema estructurado habilitado'
        });
        
        const { data: promptLog, error: promptLogError } = await supabaseClient
          .rpc('insert_book_creation_log', {
            p_book_id: book_id,
            p_step_type: 'outline',
            p_step_detail: `Enviando prompt a IA para lote ${start}-${end} (${end - start + 1} capítulos)...`,
            p_status: 'in_progress',
            p_ai_request: promptToLog,
            p_ai_response: null,
            p_error_message: null,
            p_duration_seconds: null,
            p_word_count: null,
            p_tokens_used: null,
            p_ai_model: `${actualModelNameForAPI} (${providerData.name})`
          });
        
        if (promptLogError) {
          console.warn('[generate-book-outline] Error creando log de prompt:', promptLogError);
        }
        
        // LLAMADA ÚNICA A LA IA CON JSON SCHEMA ESTRUCTURADO
        const aiResult = await callAI({
          config: {
            providerName: providerData.name,
            apiKey,
            baseUrl,
            modelName: actualModelNameForAPI,
            // FORZAR JSON SCHEMA ESTRUCTURADO - ELIMINA ERRORES DE PARSEO
            response_mime_type: "application/json",
            response_schema: chapterSchema
          },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 65536  // Máximo permitido por Gemini 2.5
        });
        
        // Log intermedio: Respuesta de IA recibida para TODO EL LOTE
        if (aiResult.content) {
          const { data: responseLog, error: responseLogError } = await supabaseClient
            .rpc('insert_book_creation_log', {
              p_book_id: book_id,
              p_step_type: 'outline',
              p_step_detail: `Respuesta de IA recibida para lote ${start}-${end} (${aiResult.content.length} caracteres)`,
              p_status: 'in_progress',
              p_ai_request: null,
              p_ai_response: aiResult.content,
              p_error_message: null,
              p_duration_seconds: null,
              p_word_count: null,
              p_tokens_used: aiResult.usage?.total_tokens || null,
              p_ai_model: `${actualModelNameForAPI} (${providerData.name})`
            });
          
          if (responseLogError) {
            console.warn('[generate-book-outline] Error creando log de respuesta:', responseLogError);
          }
        }

        if (aiResult.error || !aiResult.content) {
            throw new Error(`Error generando lote ${start}-${end}: ${aiResult.error || 'Contenido vacío.'}`);
        }

        // Log intermedio: Parseando respuesta JSON del lote
        const { data: parseLogData, error: parseLogErr } = await supabaseClient
          .rpc('insert_book_creation_log', {
            p_book_id: book_id,
            p_step_type: 'outline',
            p_step_detail: `Parseando respuesta JSON para lote ${start}-${end}...`,
            p_status: 'in_progress',
            p_ai_request: null,
            p_ai_response: null,
            p_error_message: null,
            p_duration_seconds: null,
            p_word_count: null,
            p_tokens_used: null,
            p_ai_model: `${actualModelNameForAPI} (${providerData.name})`
          });

        // CON JSON SCHEMA ESTRUCTURADO, EL PARSEO ES GARANTIZADO
        let parsedChapters;
        try {
            // El JSON Schema estructurado garantiza formato correcto
            parsedChapters = JSON.parse(aiResult.content);
            console.log(`[generate-book-outline] ✅ JSON Schema estructurado - Parseo garantizado exitoso para lote ${start}-${end}`);
            
            // Validación básica (debería ser siempre exitosa con JSON Schema)
            if (!Array.isArray(parsedChapters)) {
                throw new Error('La respuesta no es un array de capítulos');
            }
        } catch (parseError) {
            // CON JSON SCHEMA, ESTO NO DEBERÍA OCURRIR NUNCA
            console.error(`[generate-book-outline] ❌ ERROR INESPERADO: JSON Schema falló para lote ${start}-${end}:`, parseError.message);
            console.error(`[generate-book-outline] Respuesta recibida:`, aiResult.content.substring(0, 1000));
            
            // Fallback: dividir lote como último recurso
            if (end - start + 1 > 3) {
                console.log(`[generate-book-outline] 🔄 Fallback: dividiendo lote como último recurso...`);
                const midPoint = Math.floor((start + end) / 2);
                const firstHalf = await generateWithFallback(start, midPoint);
                const secondHalf = await generateWithFallback(midPoint + 1, end);
                return [...firstHalf, ...secondHalf];
            }
            
            throw new Error(`JSON Schema falló inesperadamente para lote ${start}-${end}: ${parseError.message}`);
        }

        // Validar que tenemos el número correcto de capítulos
        const expectedChapters = end - start + 1;
        if (parsedChapters.length !== expectedChapters) {
            console.warn(`[generate-book-outline] ⚠️ Se esperaban ${expectedChapters} capítulos, pero se recibieron ${parsedChapters.length}`);
        }

        // Procesar cada capítulo del lote
        const generatedChaptersInBatch = [];
        for (let i = 0; i < parsedChapters.length; i++) {
            const chapter = parsedChapters[i];
            const expectedChapterNum = start + i;
            
            // Validar que tiene título y sinopsis
            if (!chapter.title || !chapter.synopsis) {
                throw new Error(`Capítulo ${expectedChapterNum} incompleto: falta título o sinopsis`);
            }
            
            // Log intermedio: Capítulo procesado exitosamente
            const { data: successLog, error: successLogError } = await supabaseClient
              .rpc('insert_book_creation_log', {
                p_book_id: book_id,
                p_step_type: 'outline',
                p_step_detail: `Capítulo ${expectedChapterNum} procesado: "${chapter.title}"`,
                p_status: 'completed',
                p_ai_request: null,
                p_ai_response: JSON.stringify({
                  title: chapter.title,
                  synopsis: chapter.synopsis,
                  order_number: expectedChapterNum
                }, null, 2),
                p_error_message: null,
                p_duration_seconds: null,
                p_word_count: chapter.synopsis ? chapter.synopsis.length : null,
                p_tokens_used: null,
                p_ai_model: `${actualModelNameForAPI} (${providerData.name})`
              });

            // Agregar al array de capítulos generados en este lote
            generatedChaptersInBatch.push({
                order_number: expectedChapterNum,
                title: chapter.title,
                synopsis: chapter.synopsis
            });
            
            console.log(`[generate-book-outline] ✅ Capítulo ${expectedChapterNum} procesado en ${bookData.language}: "${chapter.title}"`);
        }
        
        // Retornar todos los capítulos generados en este lote
        console.log(`[generate-book-outline] ✅ Lote completado: ${generatedChaptersInBatch.length} capítulos generados en ${bookData.language}`);
        return generatedChaptersInBatch;
    };

    console.log(`[generate-book-outline] --- INICIANDO LOTE (${startChapter}-${endChapter}) ---`);
    await supabaseClient.from('jobs').update({
        status_message: `Generando esquema para capítulos ${startChapter}-${endChapter}...`,
        progress_percentage: Math.round((endChapter / targetNumberOfChapters) * 30) // hasta 30% mientras generamos esquema
    }).eq('id', job_id);

    // Generar capítulos del rango actual
    const batchChapters = await generateWithFallback(startChapter, endChapter);
    console.log(`[generate-book-outline] Lote (${startChapter}-${endChapter}) procesado, ${batchChapters.length} capítulos obtenidos.`);

    // Persistir capítulos en DB CON VARIABLES DEL JSON SCHEMA ESTRUCTURADO
    const chaptersToInsert = batchChapters.map((chapter, idx) => ({
        book_id: book_id,
        title: chapter.title,
        synopsis: chapter.synopsis,
        order_number: startChapter + idx,
        content: null,
        // NUEVAS VARIABLES DEL JSON SCHEMA ESTRUCTURADO
        narrative_function: chapter.narrative_function || null,
        emotional_intensity: chapter.emotional_intensity || null,
        key_elements: chapter.key_elements ? JSON.stringify(chapter.key_elements) : null,
        connections: chapter.connections ? JSON.stringify(chapter.connections) : null
    }));

    // Insertar o actualizar capítulos SIN tocar la columna 'content' si ya fue escrita
    const { data: insertedChapters, error: insertError } = await supabaseClient.from('chapters').upsert(chaptersToInsert, {
        onConflict: 'book_id,order_number',
        updateColumns: ['title', 'synopsis'] // evita sobreescribir 'content'
    }).select('id, order_number, title, synopsis');

    if (insertError) {
        console.error('Error inserting chapters:', insertError);
        throw insertError;
    }

    console.log(`[generate-book-outline] Capítulos ${startChapter}-${endChapter} insertados en la base de datos`);

    // FASE 1: CREAR TODOS LOS CAPÍTULOS PRIMERO (sin escribir contenido)
    console.log(`[generate-book-outline] === FASE 1: CREANDO TODOS LOS CAPÍTULOS (${startChapter}-${targetNumberOfChapters}) ===`);
    
    // Procesar todos los lotes restantes para crear capítulos
    let currentStart = endChapter + 1;
    
    while (currentStart <= targetNumberOfChapters) {
        const currentEnd = Math.min(currentStart + BATCH_SIZE - 1, targetNumberOfChapters);
        
        console.log(`[generate-book-outline] --- PROCESANDO LOTE ADICIONAL (${currentStart}-${currentEnd}) ---`);
        
        await supabaseClient.from('jobs').update({
            status_message: `Generando esquema para capítulos ${currentStart}-${currentEnd}...`,
            progress_percentage: Math.round((currentEnd / targetNumberOfChapters) * 30)
        }).eq('id', job_id);

        // Generar capítulos del lote actual
        const additionalBatchChapters = await generateWithFallback(currentStart, currentEnd);
        console.log(`[generate-book-outline] Lote adicional (${currentStart}-${currentEnd}) procesado, ${additionalBatchChapters.length} capítulos obtenidos.`);

        // Persistir capítulos en DB
        const additionalChaptersToInsert = additionalBatchChapters.map((chapter, idx) => ({
            book_id: book_id,
            title: chapter.title,
            synopsis: chapter.synopsis,
            order_number: currentStart + idx,
            content: null
        }));

        const { error: additionalInsertError } = await supabaseClient.from('chapters').upsert(additionalChaptersToInsert, {
            onConflict: 'book_id,order_number',
            updateColumns: ['title', 'synopsis']
        });

        if (additionalInsertError) {
            console.error('Error inserting additional chapters:', additionalInsertError);
            throw additionalInsertError;
        }

        console.log(`[generate-book-outline] Capítulos adicionales ${currentStart}-${currentEnd} insertados en la base de datos`);
        
        // Avanzar al siguiente lote
        currentStart = currentEnd + 1;
        
        // Pequeño retraso entre lotes para no sobrecargar la API de IA
        if (currentStart <= targetNumberOfChapters) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo entre lotes
        }
    }

    // Si llegamos aquí es el último lote
    console.log(`[generate-book-outline] === FASE 1 COMPLETADA: TODOS LOS CAPÍTULOS CREADOS ===`);

    // FASE 2: ESCRIBIR CONTENIDO DE TODOS LOS CAPÍTULOS
    console.log(`[generate-book-outline] === FASE 2: ESCRIBIENDO CONTENIDO DE TODOS LOS CAPÍTULOS ===`);
    
    await supabaseClient.from('jobs').update({ 
        status: 'processing',
        status_message: 'Esquema completo. Iniciando escritura de contenido...',
        progress_percentage: 30
    }).eq('id', job_id);
    
    await supabaseClient.from('creation_logs').insert({ 
        book_id: book_id, 
        message: '¡Esquema completo! Ahora escribiendo el contenido de todos los capítulos...' 
    });

    // Verificar cuántos capítulos se crearon para el procesamiento por lotes
    const { data: allChapters, error: fetchAllError } = await supabaseClient
        .from('chapters')
        .select('id, order_number, title, synopsis')
        .eq('book_id', book_id)
        .order('order_number');
    
    if (fetchAllError) {
        console.error('Error fetching all chapters:', fetchAllError);
        throw fetchAllError;
    }
    
    console.log(`[generate-book-outline] ✅ Esquema completado. Iniciando procesamiento por LOTES para ${allChapters.length} capítulos`);
    
    // Actualizar progreso: esquema completado, iniciando escritura por lotes
    await supabaseClient.from('jobs').update({
        status_message: `Esquema completado. Iniciando escritura por lotes de ${allChapters.length} capítulos...`,
        progress_percentage: 35 // 35% al completar esquema e iniciar escritura
    }).eq('id', job_id);
    
    try {
        // Llamar a write-chapter-content en modo LOTE (Google Cloud a Google Cloud)
        console.log(`[generate-book-outline] 🚀 Invocando procesamiento por lotes...`);
        
        const batchWriteResponse = await fetch(`${process.env.GCLOUD_FUNCTION_URL || 'https://europe-west1-export-document-project.cloudfunctions.net'}/write-chapter-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ 
                book_id: book_id,
                job_id: job_id,
                batch_size: 20 // Procesar en lotes de 20 capítulos
            })
        });
        
        if (batchWriteResponse.ok) {
            const batchResult = await batchWriteResponse.json();
            console.log(`[generate-book-outline] ✅ Procesamiento por lotes iniciado exitosamente:`, batchResult);
            
            // El job será actualizado automáticamente por write-chapter-content
            // Solo registramos el éxito de la invocación
            await supabaseClient.from('creation_logs').insert({ 
                book_id: book_id, 
                message: `🚀 Procesamiento por lotes iniciado: ${allChapters.length} capítulos en lotes de 20` 
            });
            
        } else {
            const errorText = await batchWriteResponse.text();
            console.error(`[generate-book-outline] ❌ Error en procesamiento por lotes:`, errorText);
            
            // Actualizar job con error
            await supabaseClient.from('jobs').update({
                status: 'failed',
                status_message: `Error iniciando procesamiento por lotes: ${errorText}`,
                progress_percentage: 35
            }).eq('id', job_id);
            
            throw new Error(`Batch processing failed: ${errorText}`);
        }
        
    } catch (error) {
        console.error(`[generate-book-outline] ❌ Error crítico en procesamiento por lotes:`, error);
        
        // Actualizar job con error crítico
        await supabaseClient.from('jobs').update({
            status: 'failed',
            status_message: `Error crítico en procesamiento por lotes: ${error.message}`,
            error_message: error.message
        }).eq('id', job_id);
        
        throw error;
    }
    
    console.log(`[generate-book-outline] === ESQUEMA COMPLETADO Y PROCESAMIENTO POR LOTES INICIADO ===`);
    
    // NO actualizar el job como completado aquí porque el procesamiento por lotes
    // se encargará de actualizar el progreso y estado final automáticamente
    
    await supabaseClient.from('creation_logs').insert({ 
        book_id: book_id, 
        message: '✅ Esquema completado. El procesamiento por lotes de capítulos ha sido iniciado y continuará en segundo plano.' 
    });

    // Actualizar log como completado
    if (logId) {
      try {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        const chapterCount = allChapters?.length || 0;
        
        console.log(`[generate-book-outline] Actualizando log a completed: ${duration}s, ${chapterCount} capítulos`);
        
        const updateResult = await supabaseClient
          .rpc('update_book_creation_log', {
            p_log_id: logId,
            p_status: 'completed',
            p_ai_response: `Esquema generado: ${chapterCount} capítulos creados`,
            p_error_message: null,
            p_duration_seconds: duration,
            p_word_count: chapterCount,
            p_tokens_used: null
          });
        
        console.log('[generate-book-outline] Resultado de update_book_creation_log:', updateResult);
        console.log(`[generate-book-outline] ✅ Log actualizado exitosamente: ${duration}s, ${chapterCount} capítulos`);
      } catch (logErr) {
        console.error('[generate-book-outline] ❌ Error actualizando log de éxito:', logErr);
      }
    }

    res.status(200).json({ 
      success: true, 
      message: 'Outline generated and chapters created successfully.' 
    });

  } catch (error) {
    console.error(`[generate-book-outline] Error fatal para el job ${job_id}:`, error);
    
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
        
        console.log(`[generate-book-outline] Log de error actualizado: ${duration}s`);
      } catch (logErr) {
        console.error('[generate-book-outline] Error actualizando log de error:', logErr);
      }
    }
    
    try {
      await supabaseClient.from('jobs').update({
          status: 'failed',
          status_message: `Error en generate-book-outline: ${error.message}`,
          progress_percentage: -1,
      }).eq('id', job_id);
    } catch (updateError) {
      console.error('Error updating job status to failed:', updateError);
    }
    
    res.status(500).json({ error: error.message });
  }
});
