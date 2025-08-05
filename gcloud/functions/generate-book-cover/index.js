const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');

// Variables de entorno de Supabase (mismas que write-chapter-content que funciona)
process.env.SUPABASE_URL = 'https://ydorhokujupnxpyrxczv.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb3Job2t1anVwbnhweXJ4Y3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDEzMTA0MCwiZXhwIjoyMDU1NzA3MDQwfQ.PW51n-DXxQ9h7xONqIZXmPgryG09tHoVNk8Tw7msEps';

console.log('"generate-book-cover" initialized for Google Cloud Functions');
console.log('--- Executing generate-book-cover function v1.0 - MIGRATED WITH DUPLICATION CONTROL ---');

// ===== CONFIGURACIÓN SUPABASE =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase configuration');
}

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===== SERVICIO DE IA MIGRADO =====
async function callAI(request) {
  const { config, messages, max_tokens, temperature, response_format } = request;
  
  console.log(`🤖 Llamando a IA: ${config.providerName} - ${config.modelName}`);
  
  if (config.providerName === 'OpenAI') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: messages,
        max_tokens: max_tokens || 4000,
        temperature: temperature || 0.7,
        ...(response_format && { response_format })
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { content: data.choices[0]?.message?.content || null };
    
  } else if (config.providerName === 'Gemini') {
    const response = await fetch(`${config.baseUrl}/v1beta/models/${config.modelName}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: messages[messages.length - 1].content }]
        }],
        generationConfig: {
          maxOutputTokens: max_tokens || 4000,
          temperature: temperature || 0.7
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || null };
  }
  
  return { content: null, error: `Unsupported AI provider: ${config.providerName}` };
}

// ===== SERVICIO DE IA DE IMÁGENES MIGRADO =====
async function callImageAI(request) {
  const { config, prompt } = request;
  
  console.log(`🎨 Llamando a IA de imágenes: ${config.providerName} - ${config.modelName}`);
  
  if (config.providerName === 'OpenAI') {
    // Logging detallado del request a OpenAI
    const requestBody = {
      model: config.modelName,
      prompt: prompt,
      n: 1,
      size: config.imageSize || '1024x1024',
      quality: config.quality || 'standard'
    };
    
    console.log(`🎨 Request a OpenAI:`, {
      url: 'https://api.openai.com/v1/images/generations',
      model: config.modelName,
      promptLength: prompt.length,
      size: config.imageSize || '1024x1024',
      quality: config.quality || 'standard'
    });

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`🎨 Respuesta de OpenAI:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🎨 Error de OpenAI:`, errorText);
      throw new Error(`OpenAI Images API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Logging detallado de la respuesta
    console.log(`🎨 Datos completos de OpenAI:`, {
      hasData: !!data.data,
      dataLength: data.data?.length || 0,
      hasUrl: !!data.data?.[0]?.url,
      hasB64Json: !!data.data?.[0]?.b64_json,
      urlLength: data.data?.[0]?.url?.length || 0,
      b64Length: data.data?.[0]?.b64_json?.length || 0
    });
    
    // OpenAI puede devolver la imagen como URL o como base64
    const imageData = data.data?.[0];
    let imageUrl = null;
    
    if (imageData?.url) {
      // Formato URL directo
      imageUrl = imageData.url;
      console.log(`🎨 Imagen recibida como URL: ${imageUrl}`);
    } else if (imageData?.b64_json) {
      // Formato base64 - convertir a data URL
      imageUrl = `data:image/png;base64,${imageData.b64_json}`;
      console.log(`🎨 Imagen recibida como base64 (${imageData.b64_json.length} caracteres)`);
    }
    
    return { 
      imageUrl: imageUrl,
      revisedPrompt: imageData?.revised_prompt || null
    };
  } else if (config.providerName === 'Recraft') {
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        prompt: prompt,
        style: 'digital_illustration', // Recraft usa 'style' en lugar de 'model'
        size: config.imageSize || '1024x1024',
        response_format: 'url'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Recraft API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { 
      imageUrl: data.data?.[0]?.url || null,
      revisedPrompt: null
    };
  }
  
  return { imageUrl: null, error: `Unsupported image AI provider: ${config.providerName}` };
}

// ===== FUNCIÓN PRINCIPAL =====
const generateBookCover = async (req, res) => {
  let payload = null;
  let currentJobId = null; // Declarar fuera del try-catch para que esté disponible en catch
  let logId = null;
  const startTime = Date.now();
  
  try {
    console.log('🎨 [generate-book-cover] Iniciando función...');
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    payload = req.body;
    const { book_id, job_id, manual_trigger = false, image_model_id } = payload;
    
    if (!book_id) {
      throw new Error('book_id es requerido');
    }
    
    console.log(`🎨 Iniciando generación de portada - Libro: ${book_id}, Manual: ${manual_trigger}, Job: ${job_id || 'N/A'}, Modelo: ${image_model_id || 'por defecto'}`);
    
    // Si es una llamada manual, usar el job_id proporcionado
    currentJobId = job_id;

    // Crear log inicial en book_creation_logs
    try {
      const { data: logData, error: logError } = await supabaseClient
        .rpc('insert_book_creation_log', {
          p_book_id: book_id,
          p_step_type: 'cover',
          p_step_detail: manual_trigger ? 'Regenerando portada (manual)' : 'Generando portada',
          p_status: 'in_progress',
          p_ai_request: null,
          p_ai_response: null,
          p_error_message: null,
          p_duration_seconds: null,
          p_word_count: null,
          p_tokens_used: null,
          p_ai_model: image_model_id || null
        });

      if (logError) {
        console.error('[generate-book-cover] Error creando log:', logError);
      } else {
        logId = logData;
        console.log(`[generate-book-cover] ✅ Log creado con ID: ${logId}`);
      }
    } catch (logErr) {
      console.error('[generate-book-cover] Error en sistema de logging:', logErr);
    }

    if (!manual_trigger && !job_id) {
      return res.status(400).json({ 
        error: 'Missing required parameters: book_id and job_id are required' 
      });
    }

    console.log(`🎨 [${currentJobId}] Iniciando generación de portada para libro: ${book_id}`);

    // ===== CONTROL DE DUPLICACIÓN: Solo para llamadas automáticas =====
    const { data: existingBook } = await supabaseClient
      .from('books')
      .select('cover_image_url')
      .eq('id', book_id)
      .single();

    // Solo evitar duplicación en llamadas automáticas, permitir regeneración manual
    if (existingBook?.cover_image_url && !manual_trigger) {
      console.log(`🎨 [${currentJobId}] ⚠️ DUPLICACIÓN EVITADA: El libro ya tiene portada (llamada automática)`);
      
      // Actualizar job como completado sin regenerar (solo si hay job_id)
      if (currentJobId) {
        await supabaseClient.from('jobs').update({
          status: 'completed',
          status_message: 'Portada ya existente - duplicación evitada',
          progress_percentage: 100
        }).eq('id', currentJobId);
      }

      return res.status(200).json({
        success: true,
        message: 'Cover already exists - duplication avoided',
        cover_url: existingBook.cover_image_url
      });
    } else if (existingBook?.cover_image_url && manual_trigger) {
      console.log(`🎨 [${currentJobId}] 🔄 REGENERACIÓN MANUAL: Permitiendo sobrescribir portada existente`);
    }

    // ===== PASO 1: OBTENER DATOS DEL LIBRO =====
    if (currentJobId) {
      await supabaseClient.from('jobs').update({ 
        status_message: 'Iniciando generación de portada...',
        progress_percentage: 10
      }).eq('id', currentJobId);
    }

    const { data: bookData, error: bookError } = await supabaseClient
      .from('books')
      .select('title, author, ai_config, category, subcategory')
      .eq('id', book_id)
      .single();

    if (bookError || !bookData) {
      throw new Error(`Error al obtener datos del libro: ${bookError?.message}`);
    }

    // ===== PASO 2: OBTENER SINOPSIS DE CAPÍTULOS =====
    const { data: chaptersData, error: chaptersError } = await supabaseClient
      .from('chapters')
      .select('synopsis')
      .eq('book_id', book_id)
      .order('order_number', { ascending: true });

    if (chaptersError) {
      throw new Error(`Error al obtener sinopsis de capítulos: ${chaptersError.message}`);
    }

    if (!chaptersData || chaptersData.length === 0) {
      throw new Error('No se encontraron sinopsis de capítulos para generar el resumen.');
    }

    const combinedSynopsis = chaptersData.map(c => c.synopsis).join('\n\n---\n\n');

    // ===== PASO 3: OBTENER CONFIGURACIÓN DE IA =====
    // Usar el modelo seleccionado por el usuario o el modelo por defecto del libro
    let imageModelId = image_model_id || bookData.ai_config?.image_generator_model_id;
    
    // Si no hay modelo seleccionado, buscar el primer modelo de portada disponible
    if (!imageModelId) {
      console.log('⚠️ No hay modelo de imagen configurado, buscando modelo por defecto...');
      
      const { data: defaultModel, error: defaultModelError } = await supabaseClient
        .from('ai_models')
        .select('id')
        .eq('type', 'cover')
        .eq('active', true)
        .order('rating', { ascending: false })
        .limit(1)
        .single();
        
      if (defaultModelError || !defaultModel) {
        throw new Error('No se encontró ningún modelo de IA para generación de imágenes');
      }
      
      imageModelId = defaultModel.id;
      console.log(`✅ Usando modelo por defecto: ${imageModelId}`);
    } else {
      console.log(`✅ Usando modelo seleccionado: ${imageModelId}`);
    }

    const { data: imageModel, error: modelError } = await supabaseClient
      .from('ai_models')
      .select(`*, ai_providers (*)`)
      .eq('id', imageModelId)
      .single();

    if (modelError || !imageModel || !imageModel.ai_providers) {
      throw new Error(`Error al obtener modelo de IA de imágenes: ${modelError?.message}`);
    }

    console.log(`🎨 [${currentJobId}] Usando modelo de imagen: ${imageModel.name}`);
    
    // Log intermedio: Iniciando generación de prompt
    if (logId) {
      try {
        await supabaseClient.rpc('update_book_creation_log', {
          p_log_id: logId,
          p_status: 'in_progress',
          p_ai_response: `Generando prompt de portada con modelo ${imageModel.name}...`,
          p_error_message: null,
          p_duration_seconds: null,
          p_word_count: null,
          p_tokens_used: null
        });
      } catch (logErr) {
        console.warn('[generate-book-cover] Error actualizando log intermedio:', logErr);
      }
    }

    // ===== PASO 4: GENERAR PROMPT DE PORTADA CON IA =====
    if (currentJobId) {
      await supabaseClient.from('jobs').update({ 
        status_message: 'Generando concepto de portada...',
        progress_percentage: 30
      }).eq('id', currentJobId);
    }

    const promptGenerationSystemPrompt = `Eres un diseñador de portadas de libros experto. Tu trabajo es crear un prompt detallado y específico para generar una portada de libro profesional usando IA.

INSTRUCCIONES:
1. Analiza el título, autor, categoría y resumen del libro
2. Crea un prompt visual específico y detallado
3. Incluye elementos como: estilo artístico, colores, composición, tipografía, elementos visuales
4. El prompt debe ser en inglés y optimizado para IA de imágenes
5. Debe ser profesional y comercialmente viable

Responde SOLO con el prompt de imagen, sin explicaciones adicionales. Y especifica claramente que no necesitas la imagen de un libro, sino la portada de un libro.`;

    const promptGenerationUserPrompt = `Genera el concepto de portada para el siguiente libro:

Título: "${bookData.title}"
Autor: ${bookData.author}
Categoría: ${bookData.category}
Subcategoría: ${bookData.subcategory || 'N/A'}

Resumen de la historia:
${combinedSynopsis}`;

    // Obtener modelo de texto para generar el prompt
    const textModelId = bookData.ai_config?.editor_model_id || bookData.ai_config?.writer_model_id;
    const { data: textModel } = await supabaseClient
      .from('ai_models')
      .select(`*, ai_providers (*)`)
      .eq('id', textModelId)
      .single();

    if (!textModel || !textModel.ai_providers) {
      throw new Error('No se encontró modelo de IA de texto para generar el prompt');
    }

    const promptResult = await callAI({
      config: {
        providerName: textModel.ai_providers.name,
        apiKey: textModel.ai_providers.api_key,
        baseUrl: textModel.ai_providers.base_url,
        modelName: textModel.name,
        maxTokens: textModel.max_tokens || 4000,
        temperature: 0.7
      },
      messages: [
        { role: 'system', content: promptGenerationSystemPrompt },
        { role: 'user', content: promptGenerationUserPrompt }
      ]
    });

    if (!promptResult.content) {
      throw new Error('Error al generar el prompt de portada con IA');
    }

    const finalImagePrompt = promptResult.content.trim();
    console.log(`🎨 [${currentJobId}] Prompt de imagen generado:`, finalImagePrompt);

    // Truncar prompt para Recraft si es necesario (límite de 1000 caracteres)
    let processedPrompt = finalImagePrompt;
    if (imageModel.ai_providers.name === 'Recraft' && finalImagePrompt.length > 1000) {
      // Truncamiento inteligente: mantener el inicio y final del prompt
      const maxLength = 1000;
      const startLength = Math.floor(maxLength * 0.6); // 60% del inicio
      const endLength = Math.floor(maxLength * 0.3); // 30% del final
      const start = finalImagePrompt.substring(0, startLength);
      const end = finalImagePrompt.substring(finalImagePrompt.length - endLength);
      processedPrompt = start + '...' + end;
      
      // Si aún es muy largo, usar truncamiento simple
      if (processedPrompt.length > 1000) {
        processedPrompt = finalImagePrompt.substring(0, 997) + '...';
      }
      
      console.log(`🎨 [${currentJobId}] Prompt truncado para Recraft: ${processedPrompt.length} caracteres (original: ${finalImagePrompt.length})`);
    }

    // ===== PASO 5: GENERAR LA IMAGEN =====
    if (currentJobId) {
      await supabaseClient.from('jobs').update({ 
        status_message: 'Generando imagen de portada...',
        progress_percentage: 60
      }).eq('id', currentJobId);
    }

    const imageResult = await callImageAI({
      config: {
        providerName: imageModel.ai_providers.name,
        apiKey: imageModel.ai_providers.api_key,
        baseUrl: imageModel.ai_providers.base_url,
        modelName: imageModel.name,
        imageSize: '1024x1024',
        quality: 'high'  // OpenAI acepta: 'low', 'medium', 'high', 'auto'
      },
      prompt: processedPrompt
    });

    // Logging detallado para diagnosticar el problema
    console.log(`🎨 [${currentJobId}] Resultado de callImageAI:`, {
      hasImageUrl: !!imageResult.imageUrl,
      hasError: !!imageResult.error,
      imageUrl: imageResult.imageUrl,
      error: imageResult.error,
      fullResult: JSON.stringify(imageResult, null, 2)
    });

    if (!imageResult.imageUrl) {
      const errorMsg = imageResult.error || 'Error desconocido en callImageAI';
      throw new Error(`Error al generar imagen: ${errorMsg}`);
    }

    console.log(`🎨 [${job_id}] Imagen generada exitosamente`);
    
    // Log intermedio: Imagen generada exitosamente
    if (logId) {
      try {
        await supabaseClient.rpc('update_book_creation_log', {
          p_log_id: logId,
          p_status: 'in_progress',
          p_ai_response: 'Imagen de portada generada exitosamente. Guardando en almacenamiento...',
          p_error_message: null,
          p_duration_seconds: null,
          p_word_count: null,
          p_tokens_used: null
        });
      } catch (logErr) {
        console.warn('[generate-book-cover] Error actualizando log intermedio:', logErr);
      }
    }

    // ===== PASO 6: DESCARGAR Y SUBIR IMAGEN A SUPABASE STORAGE =====
    if (currentJobId) {
      await supabaseClient.from('jobs').update({ 
        status_message: 'Guardando imagen de portada...',
        progress_percentage: 80
      }).eq('id', currentJobId);
    }

    // Descargar imagen
    const imageResponse = await fetch(imageResult.imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Error al descargar la imagen generada');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const fileName = `cover_${book_id}_${Date.now()}.png`;
    const filePath = `covers/${fileName}`;

    // Subir a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('book-covers')
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Error al subir imagen a storage: ${uploadError.message}`);
    }

    // Obtener URL pública
    const { data: publicUrlData } = supabaseClient.storage
      .from('book-covers')
      .getPublicUrl(filePath);

    const coverImageUrl = publicUrlData.publicUrl;

    // ===== PASO 7: GUARDAR PORTADA EN GALERÍA =====
    // Desactivar portadas anteriores y guardar la nueva como activa
    const { error: insertCoverError } = await supabaseClient
      .from('book_covers')
      .insert({
        book_id: book_id,
        image_url: coverImageUrl,
        image_path: filePath,
        is_active: true, // La nueva portada se marca como activa
        model_used: imageModel.name,
        provider_used: imageModel.ai_providers.name,
        generation_prompt: processedPrompt.substring(0, 1000) // Truncar prompt para almacenamiento
      });

    if (insertCoverError) {
      throw new Error(`Error al guardar portada en galería: ${insertCoverError.message}`);
    }

    // Actualizar el campo cover_image_url del libro para compatibilidad con código existente
    const { error: updateBookError } = await supabaseClient
      .from('books')
      .update({ cover_image_url: coverImageUrl })
      .eq('id', book_id);

    if (updateBookError) {
      console.warn(`Advertencia al actualizar cover_image_url del libro: ${updateBookError.message}`);
      // No lanzar error aquí ya que la portada se guardó correctamente en book_covers
    }

    // ===== PASO 8: COMPLETAR JOB =====
    if (currentJobId) {
      await supabaseClient.from('jobs').update({
        status: 'completed',
        status_message: 'Portada generada exitosamente',
        progress_percentage: 100
      }).eq('id', currentJobId);
    }

    // ===== PASO 9: LOG DE ÉXITO =====
    await supabaseClient.from('creation_logs').insert({
      book_id: book_id,
      message: `Portada generada exitosamente y guardada en: ${coverImageUrl}`
    });

    // Actualizar log como completado
    if (logId) {
      try {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        
        console.log(`[generate-book-cover] Actualizando log a completed: ${duration}s`);
        
        await supabaseClient
          .rpc('update_book_creation_log', {
            p_log_id: logId,
            p_status: 'completed',
            p_ai_response: `Portada generada: ${coverImageUrl}`,
            p_error_message: null,
            p_duration_seconds: duration,
            p_word_count: null,
            p_tokens_used: null
          });
        
        console.log(`[generate-book-cover] ✅ Log actualizado exitosamente: ${duration}s`);
      } catch (logErr) {
        console.error('[generate-book-cover] ❌ Error actualizando log de éxito:', logErr);
      }
    }

    console.log(`🎨 [${currentJobId}] ✅ Portada generada exitosamente para libro ${book_id}`);

    return res.status(200).json({
      success: true,
      message: 'Book cover generated successfully in Google Cloud',
      cover_url: coverImageUrl,
      method: 'Google Cloud'
    });

  } catch (error) {
    console.error(`🎨 Error en generate-book-cover:`, error);

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
        
        console.log(`[generate-book-cover] Log de error actualizado: ${duration}s`);
      } catch (logErr) {
        console.error('[generate-book-cover] Error actualizando log de error:', logErr);
      }
    }

    // Actualizar job como fallido (usar currentJobId si está disponible)
    const jobIdForError = currentJobId || payload?.job_id;
    if (jobIdForError) {
      await supabaseClient.from('jobs').update({
        status: 'failed',
        status_message: `Error en generate-book-cover: ${error.message}`,
        progress_percentage: 0
      }).eq('id', jobIdForError);

      // Log de error
      if (payload?.book_id) {
        await supabaseClient.from('creation_logs').insert({
          book_id: payload.book_id,
          message: `Error generando portada: ${error.message}`
        });
      }
    }

    return res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
};

// Registrar función para Google Cloud Functions
functions.http('generateBookCover', generateBookCover);

// También exportar como módulo para compatibilidad
exports.generateBookCover = generateBookCover;
