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

// Servicio de IA - Migrado desde ai-service
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

      const candidate = jsonResponse.candidates?.[0];
      const aiContent = candidate?.content?.parts?.[0]?.text;
      
      if (!aiContent) {
        console.error('Gemini response did not contain valid content:', jsonResponse);
        return { content: null, error: 'Gemini response did not contain valid content.', rawResponse: jsonResponse };
      }
      
      // Verificar si la respuesta fue truncada por límite de tokens
      if (candidate?.finishReason === 'MAX_TOKENS') {
        console.warn('[callAI] ⚠️ Respuesta de Gemini truncada por límite de tokens, pero contenido válido recibido');
        console.warn(`[callAI] Contenido recibido: ${aiContent.length} caracteres`);
      }
      
      // 🔍 LOGGING DE THINKING BUDGET USAGE
      if (jsonResponse.usageMetadata) {
        const usage = jsonResponse.usageMetadata;
        console.log(`[callAI] 📊 Gemini Usage Metadata:`);
        console.log(`[callAI]   - Prompt tokens: ${usage.promptTokenCount || 'N/A'}`);
        console.log(`[callAI]   - Candidates tokens: ${usage.candidatesTokenCount || 'N/A'}`);
        console.log(`[callAI]   - Total tokens: ${usage.totalTokenCount || 'N/A'}`);
        
        // Información específica del thinking budget
        if (usage.cachedContentTokenCount !== undefined) {
          console.log(`[callAI]   - Cached content tokens: ${usage.cachedContentTokenCount}`);
        }
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

// ===== FUNCIÓN PRINCIPAL GENERATE-BOOK-BIBLE =====

functions.http('generate-book-bible', async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

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
  
  const { book_id, job_id } = payload;

  if (!book_id || !job_id) {
    res.status(400).json({ error: 'book_id and job_id are required' });
    return;
  }

  // Crear cliente Supabase usando variables de entorno como las otras funciones exitosas
  console.log(`[generate-book-bible] Configurando cliente Supabase...`);
  console.log(`[generate-book-bible] URL: ${process.env.SUPABASE_URL}`);
  console.log(`[generate-book-bible] Service Key disponible: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SÍ' : 'NO'}`);
  console.log(`[generate-book-bible] Service Key length: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0}`);
  
  // Crear cliente Supabase usando variables de entorno (mismo método que write-chapter-content)
  const supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log(`[generate-book-bible] ✅ Cliente Supabase configurado`);
  


  let logId = null;
  const startTime = Date.now();

  try {
    console.log(`[generate-book-bible] Iniciando generación de book bible para book_id: ${book_id}`);

    // Crear log inicial
    try {
      const { data: logData, error: logError } = await supabaseClient
        .rpc('insert_book_creation_log', {
          p_book_id: book_id,
          p_step_type: 'book_bible',
          p_step_detail: 'Generando biblia del libro',
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
        console.error('[generate-book-bible] Error creando log:', logError);
      } else {
        logId = logData;
        console.log(`[generate-book-bible] ✅ Log creado con ID: ${logId}`);
      }
    } catch (logErr) {
      console.error('[generate-book-bible] Error en sistema de logging:', logErr);
    }

    // 1. Obtener datos del libro
    console.log(`[generate-book-bible] Consultando libro con ID: ${book_id}`);
    
    const { data: bookData, error: bookError } = await supabaseClient
      .from('books')
      .select('*')
      .eq('id', book_id)
      .single();
    
    console.log(`[generate-book-bible] Resultado de consulta:`, {
      hasData: !!bookData,
      hasError: !!bookError,
      errorDetails: bookError ? JSON.stringify(bookError) : 'No error'
    });

    if (bookError) throw new Error(`Error al obtener datos del libro: ${bookError.message}`);
    if (!bookData) throw new Error(`Libro con ID ${book_id} no encontrado`);

    // ✅ DUPLICACIÓN RESUELTA: Se eliminó el trigger redundante que causaba la duplicación
    // Ya no es necesario el control de concurrencia con advisory locks
    console.log(`[generate-book-bible] Procediendo con generación de book bible para book_id: ${book_id}`);
    
    // Verificar si ya existe book_bible para evitar regeneración innecesaria
    if (bookData?.book_bible && Object.keys(bookData.book_bible).length > 0) {
      console.log(`[generate-book-bible] ⚠️ Book bible ya existe, evitando regeneración`);
      
      return res.status(200).json({
        success: true,
        message: 'Book bible already exists',
        book_bible: bookData.book_bible
      });
    }
    
    console.log(`[generate-book-bible] ✅ Book bible no existe, procediendo con generación...`);

    // 2. Obtener configuración de IA (editor model)
    const editorModelId = bookData.ai_config?.editor_model_id;
    if (!editorModelId) {
      throw new Error('Modelo de IA para editor no configurado');
    }

    const { data: modelData, error: modelError } = await supabaseClient
      .from('ai_models')
      .select('*, ai_providers(*)')
      .eq('id', editorModelId)
      .single();

    if (modelError) throw new Error(`Error al buscar modelo de IA: ${modelError.message}`);

    const providerData = modelData.ai_providers;
    const aiConfig = {
      providerName: providerData.name,
      apiKey: providerData.api_key,
      baseUrl: providerData.base_url,
      modelName: modelData.provider_model_id || modelData.name
    };
    
    // Añadir thinking budget si está configurado para modelos Gemini
    if (bookData.ai_config?.editor?.thinkingBudget !== undefined && 
        providerData.name.toLowerCase().includes('gemini')) {
      aiConfig.thinkingBudget = bookData.ai_config.editor.thinkingBudget;
      console.log(`[generate-book-bible] Thinking budget configurado: ${aiConfig.thinkingBudget}`);
    }

    // 3. Obtener instrucciones específicas de la categoría
    const { data: instructionsData, error: instructionsError } = await supabaseClient
      .from('category_instructions')
      .select('instructions')
      .eq('category', bookData.category)
      .eq('subcategory', bookData.subcategory)
      .maybeSingle();

    if (instructionsError) {
      console.warn(`Error al buscar instrucciones para ${bookData.category}/${bookData.subcategory}`);
    }

    // 4. Obtener prompts traducidos desde la base de datos
    console.log(`[generate-book-bible] Obteniendo prompts traducidos para idioma: ${bookData.language}`);
    
    const systemPromptTemplate = await getTranslatedPrompt(supabaseClient, 'book_bible', 'system', bookData.language);
    const userPromptTemplate = await getTranslatedPrompt(supabaseClient, 'book_bible', 'user', bookData.language);
    
    if (!systemPromptTemplate || !userPromptTemplate) {
      throw new Error(`No se encontraron prompts traducidos para book_bible en idioma ${bookData.language}`);
    }
    
    // 5. Reemplazar placeholders con datos del libro
    const promptVariables = {
      title: bookData.title,
      author: bookData.author,
      category: bookData.category,
      subcategory: bookData.subcategory,
      idea: bookData.idea,
      language: bookData.language,
      target_number_of_chapters: bookData.book_attributes?.target_number_of_chapters || bookData.extension || 10,
      // Variable estándar que contiene todos los atributos de subcategoría
      subcategory_attributes: bookData.book_attributes ? JSON.stringify(bookData.book_attributes, null, 2) : 'No hay atributos específicos para esta subcategoría',
      // Incluir todos los book_attributes como variables individuales (para compatibilidad)
      ...bookData.book_attributes
    };
    
    console.log(`[generate-book-bible] Variables disponibles:`, Object.keys(promptVariables));
    
    const systemPrompt = replacePlaceholders(systemPromptTemplate, promptVariables);
    const userPrompt = replacePlaceholders(userPromptTemplate, promptVariables);
    
    console.log(`[generate-book-bible] ✅ Prompts preparados en ${bookData.language}`);
    console.log(`[generate-book-bible] System prompt length: ${systemPrompt.length}`);
    console.log(`[generate-book-bible] User prompt length: ${userPrompt.length}`);
    console.log(`[generate-book-bible] Book attributes incluidos:`, Object.keys(bookData.book_attributes || {}));

    // 6. Llamar a la IA
    console.log(`[generate-book-bible] Llamando a IA para generar book bible...`);
    console.log(`[generate-book-bible] Usando modelo: ${aiConfig.modelName} (${aiConfig.providerName})`);
    
    // CREAR LOG INTERMEDIO 1: Prompt preparado y enviando a IA
    let promptLogId = null;
    if (logId) {
      try {
        const promptToLog = `SYSTEM: ${systemPrompt.substring(0, 500)}...\n\nUSER: ${userPrompt.substring(0, 500)}...`;
        
        // Crear log intermedio separado para el prompt
        const { data: promptLog, error: promptLogError } = await supabaseClient
          .rpc('insert_book_creation_log', {
            p_book_id: book_id,
            p_step_type: 'book_bible',
            p_step_detail: 'Enviando prompt a IA...',
            p_status: 'in_progress',
            p_ai_request: promptToLog,
            p_ai_response: null,
            p_error_message: null,
            p_duration_seconds: null,
            p_word_count: null,
            p_tokens_used: null,
            p_ai_model: `${aiConfig.modelName} (${aiConfig.providerName})`
          });
        
        if (!promptLogError && promptLog) {
          promptLogId = promptLog;
          console.log('[generate-book-bible] ✅ Log intermedio creado para prompt:', promptLogId);
        }
        
        // También actualizar el log principal con el prompt
        await supabaseClient
          .rpc('update_book_creation_log', {
            p_log_id: logId,
            p_ai_request: promptToLog
          });
      } catch (logErr) {
        console.error('[generate-book-bible] Error creando log intermedio de prompt:', logErr);
      }
    }
    
    const aiResult = await callAI({
      config: aiConfig,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: "json_object" }
    });

    if (aiResult.error || !aiResult.content) {
      throw new Error(`Error en generación de IA: ${aiResult.error || 'Contenido vacío'}`);
    }

    // CREAR LOG INTERMEDIO 2: Respuesta de IA recibida
    let responseLogId = null;
    if (logId) {
      try {
        const responsePreview = aiResult.content.substring(0, 300) + (aiResult.content.length > 300 ? '...' : '');
        
        // Crear log intermedio separado para la respuesta
        const { data: responseLog, error: responseLogError } = await supabaseClient
          .rpc('insert_book_creation_log', {
            p_book_id: book_id,
            p_step_type: 'book_bible',
            p_step_detail: `Respuesta de IA recibida (${aiResult.content.length} caracteres)`,
            p_status: 'in_progress',
            p_ai_request: null,
            p_ai_response: responsePreview,
            p_error_message: null,
            p_duration_seconds: null,
            p_word_count: null,
            p_tokens_used: aiResult.tokensUsed || null,
            p_ai_model: `${aiConfig.modelName} (${aiConfig.providerName})`
          });
        
        if (!responseLogError && responseLog) {
          responseLogId = responseLog;
          console.log('[generate-book-bible] ✅ Log intermedio creado para respuesta IA:', responseLogId);
        }
        
        // También actualizar el log principal con la respuesta
        await supabaseClient.rpc('update_book_creation_log', {
          p_log_id: logId,
          p_ai_response: responsePreview,
          p_tokens_used: aiResult.tokensUsed || null
        });
      } catch (logErr) {
        console.error('[generate-book-bible] Error creando log intermedio de respuesta:', logErr);
      }
    }

    // 6. Parsear la respuesta JSON con múltiples estrategias
    let bookBible;
    const originalContent = aiResult.content;
    
    console.log(`[generate-book-bible] Iniciando parseo de JSON...`);
    console.log(`[generate-book-bible] Longitud del contenido: ${originalContent.length}`);
    
    // CREAR LOG INTERMEDIO 3: Iniciando parseo
    let parseLogId = null;
    if (logId) {
      try {
        // Crear log intermedio separado para el parseo
        const { data: parseLog, error: parseLogError } = await supabaseClient
          .rpc('insert_book_creation_log', {
            p_book_id: book_id,
            p_step_type: 'book_bible',
            p_step_detail: `Parseando JSON... (${originalContent.length} caracteres)`,
            p_status: 'in_progress',
            p_ai_request: null,
            p_ai_response: null,
            p_error_message: null,
            p_duration_seconds: null,
            p_word_count: null,
            p_tokens_used: null,
            p_ai_model: null
          });
        
        if (!parseLogError && parseLog) {
          parseLogId = parseLog;
          console.log('[generate-book-bible] ✅ Log intermedio creado para parseo:', parseLogId);
        }
        
        // También actualizar el log principal
        await supabaseClient.rpc('update_book_creation_log', {
          p_log_id: logId,
          p_status: 'in_progress',
          p_ai_response: `Iniciando parseo de JSON... (${originalContent.length} caracteres)`,
          p_error_message: null,
          p_duration_seconds: null,
          p_word_count: null,
          p_tokens_used: null
        });
      } catch (logErr) {
        console.warn('[generate-book-bible] Error actualizando log intermedio:', logErr);
      }
    }
    
    // Estrategia 1: Parseo directo
    try {
      bookBible = JSON.parse(originalContent);
      console.log('[generate-book-bible] ✅ Parseo directo exitoso');
      
      // Log intermedio: Parseo exitoso
      if (logId) {
        try {
          await supabaseClient.rpc('update_book_creation_log', {
            p_log_id: logId,
            p_status: 'in_progress',
            p_ai_response: 'Parseo directo de JSON exitoso. Validando estructura...',
            p_error_message: null,
            p_duration_seconds: null,
            p_word_count: null,
            p_tokens_used: null
          });
        } catch (logErr) {
          console.warn('[generate-book-bible] Error actualizando log intermedio:', logErr);
        }
      }
    } catch (e1) {
      console.log('[generate-book-bible] ❌ Parseo directo falló:', e1.message);
      console.log('[generate-book-bible] Error en posición:', e1.message.match(/position (\d+)/)?.[1] || 'desconocida');
      
      // Log intermedio: Error en parseo directo
      if (logId) {
        try {
          await supabaseClient.rpc('update_book_creation_log', {
            p_log_id: logId,
            p_status: 'in_progress',
            p_ai_response: `Parseo directo falló: ${e1.message}. Intentando extracción de JSON...`,
            p_error_message: null,
            p_duration_seconds: null,
            p_word_count: null,
            p_tokens_used: null
          });
        } catch (logErr) {
          console.warn('[generate-book-bible] Error actualizando log intermedio:', logErr);
        }
      }
      
      // Estrategia 2: Extraer JSON entre llaves más externas
      try {
        const jsonMatch = originalContent.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
          console.log('[generate-book-bible] Intentando parseo de JSON extraído...');
          bookBible = JSON.parse(jsonMatch[0]);
          console.log('[generate-book-bible] ✅ Parseo de JSON extraído exitoso');
        } else {
          throw new Error('No se encontró patrón JSON válido');
        }
      } catch (e2) {
        console.log('[generate-book-bible] ❌ Parseo de JSON extraído falló:', e2.message);
        
        // Estrategia 3: Limpiar contenido y reintentar
        try {
          console.log('[generate-book-bible] Intentando limpieza de contenido...');
          let cleanContent = originalContent
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .replace(/^[^{]*/, '') // Remover texto antes del primer {
            .replace(/[^}]*$/, '') // Remover texto después del último }
            .trim();
          
          // Buscar el JSON más largo y válido
          const jsonMatches = cleanContent.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
          if (jsonMatches && jsonMatches.length > 0) {
            // Tomar el JSON más largo
            const longestJson = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
            console.log('[generate-book-bible] Intentando parseo de JSON más largo encontrado...');
            bookBible = JSON.parse(longestJson);
            console.log('[generate-book-bible] ✅ Parseo de JSON limpio exitoso');
          
          // Log intermedio: Parseo limpio exitoso
          if (logId) {
            try {
              await supabaseClient.rpc('update_book_creation_log', {
                p_log_id: logId,
                p_status: 'in_progress',
                p_ai_response: 'Parseo de JSON limpio exitoso. Validando estructura del book bible...',
                p_error_message: null,
                p_duration_seconds: null,
                p_word_count: null,
                p_tokens_used: null
              });
            } catch (logErr) {
              console.warn('[generate-book-bible] Error actualizando log intermedio:', logErr);
            }
          }
          } else {
            throw new Error('No se encontraron patrones JSON válidos después de limpieza');
          }
        } catch (e3) {
          console.log('[generate-book-bible] ❌ Parseo de JSON limpio falló:', e3.message);
          
          // Estrategia 4: Crear estructura básica como fallback
          console.log('[generate-book-bible] ⚠️ Creando estructura básica como fallback...');
          bookBible = {
            title: bookData.title,
            category: bookData.category,
            subcategory: bookData.subcategory,
            description: `Guía de coherencia para ${bookData.title}`,
            key_elements: {
              main_theme: bookData.idea || 'Tema principal del libro',
              target_audience: 'Audiencia general',
              tone: 'Informativo y accesible',
              structure: 'Organizado por capítulos temáticos'
            },
            content_guidelines: [
              'Mantener coherencia temática en todos los capítulos',
              'Usar un tono consistente y apropiado para la audiencia',
              'Incluir ejemplos prácticos y relevantes',
              'Asegurar progresión lógica del contenido'
            ],
            fallback_used: true,
            original_ai_response: originalContent.substring(0, 1000) + '...' // Primeros 1000 caracteres para referencia
          };
          
          console.log('[generate-book-bible] ✅ Estructura básica creada como fallback');
        }
      }
    }
    
    // Validar que el book bible tiene la estructura mínima esperada
    if (!bookBible || typeof bookBible !== 'object') {
      throw new Error('Book bible no es un objeto válido');
    }
    
    console.log('[generate-book-bible] Book bible parseado correctamente');
    console.log('[generate-book-bible] Claves principales:', Object.keys(bookBible));
    if (bookBible.fallback_used) {
      console.log('[generate-book-bible] ⚠️ NOTA: Se usó estructura de fallback debido a errores de parseo');
    }

    // 7. Guardar el book bible en la base de datos
    console.log('[generate-book-bible] Guardando book bible en la base de datos...');
    
    const { error: updateError } = await supabaseClient
      .from('books')
      .update({ book_bible: bookBible })
      .eq('id', book_id);

    if (updateError) {
      throw new Error(`Error al guardar book bible: ${updateError.message}`);
    }
    console.log('[generate-book-bible] ✅ Book bible guardado exitosamente en la base de datos');

    // 8. Guardar log de la generación
    console.log('[generate-book-bible] Guardando log en ai_prompts_log...');
    try {
      await supabaseClient.from('ai_prompts_log').insert({
        book_id: book_id,
        phase: 'book-bible-generation',
        prompt_text: `SYSTEM: ${systemPrompt}\n\nUSER: ${userPrompt}`,
        response_text: JSON.stringify(bookBible),
        model_used: aiConfig.modelName
      });
      console.log('[generate-book-bible] ✅ Log de ai_prompts_log guardado');
    } catch (logError) {
      console.error('[generate-book-bible] ⚠️ Error guardando ai_prompts_log (continuando):', logError.message);
    }

    // 9. Actualizar job
    console.log('[generate-book-bible] Actualizando job...');
    try {
      await supabaseClient.from('jobs').update({
        status_message: 'Book bible generado exitosamente',
        progress_percentage: 10
      }).eq('id', job_id);
      console.log('[generate-book-bible] ✅ Job actualizado');
    } catch (jobError) {
      console.error('[generate-book-bible] ⚠️ Error actualizando job (continuando):', jobError.message);
    }

    console.log('[generate-book-bible] Insertando creation log...');
    try {
      await supabaseClient.from('creation_logs').insert({
        book_id: book_id,
        message: '📖 Book bible creado - Guía de coherencia lista para la escritura'
      });
      console.log('[generate-book-bible] ✅ Creation log insertado');
    } catch (creationLogError) {
      console.error('[generate-book-bible] ⚠️ Error insertando creation log (continuando):', creationLogError.message);
    }

    console.log(`[generate-book-bible] ✅ Book bible generado exitosamente para ${bookData.title}`);

    // CREAR LOG INTERMEDIO 4: Book bible guardado exitosamente
    let successLogId = null;
    if (logId) {
      try {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        const wordCount = JSON.stringify(bookBible).split(/\s+/).length;
        
        // Crear log intermedio separado para el éxito
        const { data: successLog, error: successLogError } = await supabaseClient
          .rpc('insert_book_creation_log', {
            p_book_id: book_id,
            p_step_type: 'book_bible',
            p_step_detail: `Book bible guardado exitosamente (${wordCount} palabras, ${duration}s)`,
            p_status: 'completed',
            p_ai_request: null,
            p_ai_response: JSON.stringify(bookBible).substring(0, 500) + '...',
            p_error_message: null,
            p_duration_seconds: duration,
            p_word_count: wordCount,
            p_tokens_used: null,
            p_ai_model: `${aiConfig.modelName} (${aiConfig.providerName})`
          });
        
        if (!successLogError && successLog) {
          successLogId = successLog;
          console.log('[generate-book-bible] ✅ Log intermedio creado para éxito:', successLogId);
        }
      } catch (logErr) {
        console.error('[generate-book-bible] Error creando log intermedio de éxito:', logErr);
      }
    }

    // Actualizar log como completado
    console.log('[generate-book-bible] Iniciando actualización de log a completed...');
    if (logId) {
      try {
        console.log(`[generate-book-bible] LogId disponible: ${logId}`);
        const duration = Math.floor((Date.now() - startTime) / 1000);
        const wordCount = JSON.stringify(bookBible).split(/\s+/).length;
        
        console.log(`[generate-book-bible] Calculados - Duración: ${duration}s, Palabras: ${wordCount}`);
        console.log(`[generate-book-bible] Modelo IA: ${aiConfig.modelName}`);
        
        const updateResult = await supabaseClient
          .rpc('update_book_creation_log', {
            p_log_id: logId,
            p_status: 'completed',
            p_ai_response: JSON.stringify(bookBible).substring(0, 2000) + '...',
            p_error_message: null,
            p_duration_seconds: duration,
            p_word_count: wordCount,
            p_tokens_used: null
          });
        
        console.log('[generate-book-bible] Resultado de update_book_creation_log:', updateResult);
        console.log(`[generate-book-bible] ✅ Log actualizado exitosamente: ${duration}s, ${wordCount} palabras`);
      } catch (logErr) {
        console.error('[generate-book-bible] ❌ Error actualizando log de éxito:', logErr);
        console.error('[generate-book-bible] Error details:', logErr.message);
        console.error('[generate-book-bible] Error stack:', logErr.stack);
      }
    } else {
      console.log('[generate-book-bible] ⚠️ No hay logId disponible para actualizar');
    }

    // 🔓 Liberar lock antes de retornar
    try {
      const lockKey = parseInt(book_id.replace(/-/g, '').substring(0, 10), 16);
      await supabaseClient.rpc('pg_advisory_unlock', { key: lockKey });
      console.log(`[generate-book-bible] 🔓 Lock liberado exitosamente`);
    } catch (unlockErr) {
      console.error('[generate-book-bible] Error liberando lock:', unlockErr);
    }
    
    res.status(200).json({
      success: true,
      message: 'Book bible generated successfully',
      book_bible: bookBible
    });

  } catch (error) {
    console.error('[generate-book-bible] Error:', error);
    
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
        
        console.log(`[generate-book-bible] Log de error actualizado: ${duration}s`);
      } catch (logErr) {
        console.error('[generate-book-bible] Error actualizando log de error:', logErr);
      }
    }
    
    // Actualizar job con error
    await supabaseClient.from('jobs').update({
      status: 'failed',
      status_message: `Error generando book bible: ${error.message}`,
      progress_percentage: 0
    }).eq('id', job_id);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
