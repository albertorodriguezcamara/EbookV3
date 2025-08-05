// ---------- Función para generar DOCX con LLMs ----------
const generateDocxWithLLMs = async (book, chapters, job, supabase) => {
  console.log(`[${job.id}] Iniciando generación DOCX con LLMs...`);
  
  // Obtener modelo configurado
  const { data: editorModel } = await supabase
    .from("ai_models")
    .select(`
      *,
      ai_providers (*)
    `)
    .eq("id", job.editor_model_id)
    .maybeSingle();

  if (!editorModel || !editorModel.ai_providers) {
    throw new Error('No se encontró el modelo de IA configurado para la exportación');
  }

  console.log(`[${job.id}] Usando modelo: ${editorModel.name}`);

  // Actualizar estado del job
  await supabase.from("export_jobs").update({
    status: "generating_template",
    status_message: "La IA está diseñando la plantilla del documento...",
    progress_percentage: 20
  }).eq("id", job.id);

  // PASO 1: LLM1 - Generar estructura de plantilla
  const templatePrompt = getTemplateGeneratorPrompt(book, job);
  
  const templateRequest = {
    config: {
      providerName: editorModel.ai_providers.name,
      apiKey: editorModel.ai_providers.api_key,
      baseUrl: editorModel.ai_providers.base_url,
      modelName: editorModel.name,
      maxTokens: editorModel.max_tokens || 4000,
      temperature: 0.3
    },
    messages: [
      {
        role: "user",
        content: templatePrompt
      }
    ]
  };

  let templateStyles = null;
  let retryCount = 0;
  const maxRetries = 3;

  // Reintentos para generar plantilla
  while (retryCount <= maxRetries) {
    try {
      console.log(`[${job.id}] Generando plantilla con IA (intento ${retryCount + 1})...`);
      
      const templateResponse = await callAI(templateRequest);
      const cleanedResponse = cleanJson(templateResponse.content);
      templateStyles = JSON.parse(cleanedResponse);
      
      console.log(`[${job.id}] ✅ Plantilla generada exitosamente:`, templateStyles.theme_description || 'Estilo personalizado');
      break;
      
    } catch (error) {
      console.error(`[${job.id}] Error generando plantilla (intento ${retryCount + 1}):`, error.message);
      
      const isRetryableError = error.message.includes('timeout') || 
                              error.message.includes('rate limit') ||
                              error.message.includes('server error') ||
                              error.message.includes('JSON');
      
      if (retryCount < maxRetries && isRetryableError) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Backoff exponencial
        continue;
      } else {
        console.log(`[${job.id}] ⚠️ Fallback a plantillas estáticas tras ${retryCount + 1} intentos`);
        return await generateDocxWithTemplates(book, chapters, job, supabase);
      }
    }
  }

  // Actualizar progreso
  await supabase.from("export_jobs").update({
    status: "processing_content",
    status_message: "Procesando contenido de capítulos...",
    progress_percentage: 50
  }).eq("id", job.id);

  // PASO 2: Estructurar contenido
  const structuredContent = {
    book_title: book.title || 'Sin título',
    book_author: book.author || 'Sin autor',
    toc_title: templateStyles.toc_title || 'Índice',
    chapters: chapters.map((chapter, index) => ({
      chapter_title: chapter.title || `Capítulo ${index + 1}`,
      chapter_content: processChapterContent(chapter.content || 'Sin contenido')
    }))
  };

  // Actualizar progreso
  await supabase.from("export_jobs").update({
    status: "generating_docx",
    status_message: "Generando documento DOCX con estilos personalizados...",
    progress_percentage: 70
  }).eq("id", job.id);

  // PASO 3: Renderizar DOCX con plantilla IA
  return await renderDocxWithAITemplate(templateStyles, structuredContent, job, supabase);
};

// ---------- Función para generar DOCX con plantillas estáticas ----------
const generateDocxWithTemplates = async (book, chapters, job, supabase) => {
  console.log(`[${job.id}] Generando DOCX con plantillas estáticas...`);
  
  // Plantilla estática por defecto
  const defaultStyles = {
    title_font: 'Times New Roman',
    title_size: 28,
    title_color: '000000',
    title_bold: true,
    author_font: 'Times New Roman',
    author_size: 16,
    author_color: '333333',
    author_italic: true,
    chapter_title_font: 'Times New Roman',
    chapter_title_size: 18,
    chapter_title_color: '000000',
    chapter_title_bold: true,
    chapter_title_align: 'center',
    content_font: 'Times New Roman',
    content_size: 12,
    content_color: '000000',
    text_align: 'justify',
    line_spacing: '276',
    paragraph_spacing_after: '120',
    first_line_indent: '360',
    toc_title: 'Índice',
    toc_font: 'Times New Roman',
    toc_size: 20,
    toc_color: '000000',
    toc_bold: true,
    theme_description: 'Plantilla clásica por defecto'
  };

  // Estructurar contenido
  const structuredContent = {
    book_title: book.title || 'Sin título',
    book_author: book.author || 'Sin autor',
    toc_title: 'Índice',
    chapters: chapters.map((chapter, index) => ({
      chapter_title: chapter.title || `Capítulo ${index + 1}`,
      chapter_content: processChapterContent(chapter.content || 'Sin contenido')
    }))
  };

  // Actualizar progreso
  await supabase.from("export_jobs").update({
    status: "generating_docx",
    status_message: "Generando documento DOCX con plantilla estática...",
    progress_percentage: 70
  }).eq("id", job.id);

  // Renderizar DOCX
  return await renderDocxWithAITemplate(defaultStyles, structuredContent, job, supabase);
};

// ---------- Función para renderizar DOCX con plantilla IA ----------
const renderDocxWithAITemplate = async (templateStyles, structuredContent, job, supabase) => {
  console.log(`[${job.id}] Renderizando DOCX con estilos:`, templateStyles.theme_description || 'Estilo personalizado');
  
  try {
    // Generar DOCX usando el método robusto
    const docxBuffer = await createAdvancedDocx(templateStyles, structuredContent, job.id);
    
    console.log(`[${job.id}] ✅ DOCX generado exitosamente, tamaño:`, docxBuffer.length, 'bytes');
    
    return {
      docxBuffer,
      docxPath: `exports/${job.id}_${Date.now()}.docx`,
      templateStyles
    };
    
  } catch (error) {
    console.error(`[${job.id}] Error renderizando DOCX:`, error);
    throw new Error(`Error renderizando DOCX: ${error.message}`);
  }
};

module.exports = {
  generateDocxWithLLMs,
  generateDocxWithTemplates,
  renderDocxWithAITemplate
};
