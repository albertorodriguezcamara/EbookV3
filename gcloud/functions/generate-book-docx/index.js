const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const PizZip = require('pizzip');

console.log('"generate-book-docx" initialised');
console.log('--- Executing generate-book-docx function v2.1 - VERSIÓN CORREGIDA ---');

// ===== CONFIGURACIÓN SUPABASE =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase configuration');
}

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===== SERVICIO DE IA MIGRADO =====
async function callAI(request) {
  const { config, messages } = request;
  
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
        max_tokens: config.maxTokens || 4000,
        temperature: config.temperature || 0.7
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
          maxOutputTokens: config.maxTokens || 4000,
          temperature: config.temperature || 0.7
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

// ---------- Utilidades para LLM ----------
const cleanJsonResponse = (response) => {
  // Remover bloques de código markdown si existen
  let cleaned = response.trim();
  
  // Remover ```json al inicio
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '');
  }
  
  // Remover ``` al final
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  
  // Remover cualquier texto antes del primer {
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) {
    cleaned = cleaned.substring(firstBrace);
  }
  
  // Remover cualquier texto después del último }
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastBrace + 1);
  }
  
  // CRÍTICO: Eliminar comentarios de línea (// comentario)
  // Esto debe hacerse línea por línea para no afectar strings que contengan //
  const lines = cleaned.split('\n');
  const cleanedLines = lines.map(line => {
    // Buscar // que no esté dentro de una string
    let inString = false;
    let stringChar = null;
    let commentIndex = -1;
    
    for (let i = 0; i < line.length - 1; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      // Detectar inicio/fin de string
      if ((char === '"' || char === "'") && (i === 0 || line[i-1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = null;
        }
      }
      
      // Buscar comentario fuera de strings
      if (!inString && char === '/' && nextChar === '/') {
        commentIndex = i;
        break;
      }
    }
    
    // Remover comentario si se encontró
    if (commentIndex >= 0) {
      return line.substring(0, commentIndex).trim();
    }
    
    return line;
  });
  
  // Reunir líneas y limpiar líneas vacías
  cleaned = cleanedLines
    .filter(line => line.trim().length > 0)
    .join('\n');
  
  return cleaned.trim();
};

const cleanHtmlTags = (text) => {
  if (!text) return '';
  
  // Remover tags HTML pero mantener el contenido
  let cleaned = text.replace(/<[^>]*>/g, '');
  
  // Remover entidades HTML comunes
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&amp;/g, '&');
  
  // Convertir <br/> y <br> a saltos de línea
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  
  // Limpiar espacios múltiples
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned.trim();
};

// ---------- Función para escapar XML ----------
const escapeXml = (text) => {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// ---------- Prompts para LLMs ----------
const getTemplateGeneratorPrompt = (book, job) => {
  // Obtener información de formato KDP
  const kdpInfo = {
    size: job.kdp_format_size || '15,24 x 22,86 cm (6" x 9")',
    type: job.kdp_format_type || 'paperback',
    ink: job.kdp_ink_type || 'black_white',
    paper: job.kdp_paper_type || 'white'
  };
  
  // Mapear tipos de tinta a descripción
  const inkTypeMap = {
    black_white: 'Tinta negra y papel blanco',
    black_cream: 'Tinta negra y papel crema',
    color_standard: 'Tinta de color estándar y papel blanco',
    color_premium: 'Tinta de color prémium y papel blanco'
  };
  
  return `Eres un EDITOR DE LIBROS EXPERTO y diseñador editorial de élite especializado en Amazon KDP. Tu misión es crear un estilo visual ÚNICO, IMPACTANTE y PROFESIONAL para este libro específico, optimizado para su formato de impresión.

📚 INFORMACIÓN DEL LIBRO:
- Título: "${book.title}"
- Autor: ${book.author}
- Categoría: ${book.category}
- Subcategoría: ${book.subcategory}
- Idioma: ${book.language}
- Capítulos: ${book.chapters?.length || 'No especificado'}

🎨 ESQUEMA DE COLOR: ${job.color_scheme || 'bw'}

📏 FORMATO AMAZON KDP SELECCIONADO:
- Tamaño de impresión: ${kdpInfo.size}
- Tipo de libro: ${kdpInfo.type === 'paperback' ? 'Tapa blanda' : 'Tapa dura'}
- Tipo de impresión: ${inkTypeMap[kdpInfo.ink] || kdpInfo.ink}
- Papel: ${kdpInfo.paper === 'white' ? 'Blanco' : 'Crema'}

🎯 CONSIDERACIONES ESPECÍFICAS PARA ESTE FORMATO:
${kdpInfo.size.includes('6" x 9"') ? '• Formato 6"x9": El más popular, permite márgenes generosos y texto cómodo de leer' : ''}
${kdpInfo.size.includes('5" x 8"') ? '• Formato 5"x8": Compacto, requiere fuentes más pequeñas y márgenes ajustados' : ''}
${kdpInfo.size.includes('8.5" x 11"') ? '• Formato 8.5"x11": Grande, ideal para contenido técnico con imágenes y tablas' : ''}
${kdpInfo.ink === 'black_white' ? '• Solo tinta negra: Enfócate en tipografía, contrastes y elementos visuales en escala de grises' : ''}
${kdpInfo.ink.includes('color') ? '• Impresión a color: Puedes usar colores vibrantes para títulos y elementos decorativos' : ''}
${kdpInfo.paper === 'cream' ? '• Papel crema: Más cálido y clásico, ideal para ficción y libros tradicionales' : ''}

🏆 MISIÓN: Crea un diseño editorial que refleje PERFECTAMENTE la esencia de esta categoría/subcategoría:

📖 GUÍAS POR CATEGORÍA:
• FICCIÓN: Elegante, clásico, serif, márgenes generosos, interlineado cómodo
• ROMANCE: Cursivas elegantes, colores suaves, tipografía romántica
• MISTERIO/THRILLER: Tipografía moderna, contrastes marcados, espaciado dramático
• FANTASÍA: Fuentes ornamentales para títulos, decoraciones sutiles
• CIENCIA FICCIÓN: Tipografía futurista, espaciado limpio, colores tecnológicos
• NO FICCIÓN: Sans-serif, estructura clara, jerarquía visual marcada
• BIOGRAFÍA: Clásico, respetable, tipografía tradicional
• AUTOAYUDA: Moderno, accesible, destacados visuales
• TÉCNICO: Monospace para código, estructura muy clara
• INFANTIL: Fuentes amigables, espaciado amplio, colores alegres
• ACADÉMICO: Formal, referencias claras, numeración precisa

🎨 DISEÑO DE TÍTULOS DE CAPÍTULOS - INSTRUCCIONES ESPECIALES:
Los títulos de capítulos son ELEMENTOS CLAVE del diseño. Debes crear un estilo ÚNICO y MEMORABLE:

Para FICCIÓN:
- Romance: Títulos centrados, cursiva elegante, posible decoración sutil
- Misterio: Títulos en negrita, alineados a la izquierda, subrayado dramático
- Fantasía: Títulos centrados con fuente ornamental, mayor tamaño, posible borde decorativo
- Ciencia Ficción: Títulos modernos, sans-serif bold, espaciado amplio

Para NO FICCIÓN:
- Negocios: Títulos claros en negrita, numeración prominente
- Autoayuda: Títulos centrados, colores motivacionales, mayor tamaño
- Técnico: Títulos con numeración decimal, fuente monospace para consistencia

OPCIONES DE DISEÑO PARA TÍTULOS:
- "chapter_title_bold": true (casi siempre recomendado)
- "chapter_title_align": "center" (para libros más artísticos) o "left" (para técnicos)
- "chapter_title_size": 24-32 (más grande = más impacto)
- "chapter_title_underline": "single", "double", "thick" (para énfasis adicional)
- "chapter_title_border_top/bottom": Para separación visual elegante
- "chapter_title_background": Color de fondo sutil para destacar
- "chapter_title_spacing_before/after": Espacio generoso para respirar

¡SÉ CREATIVO! Los títulos deben reflejar la personalidad del libro.

💎 ELEMENTOS ÚNICOS A PERSONALIZAR:
1. Fuente principal que refleje la personalidad del género
2. Títulos de capítulos con carácter único (tamaño, color, decoración)
3. Elementos visuales distintivos (bordes, sombreados, decoraciones)
4. Espaciado y márgenes que mejoren la experiencia de lectura
5. Detalles que hagan el libro memorable y profesional

🎯 RESPONDE CON UN JSON COMPLETO Y ÚNICO:
{
  // PORTADA Y TÍTULO PRINCIPAL
  "title_font": "Fuente impactante para el título",
  "title_size": "Tamaño en puntos (24-48)",
  "title_color": "Color hex sin #",
  "title_bold": true/false,
  "title_italic": true/false,
  "title_underline": "none/single/double/thick",
  "title_small_caps": true/false,
  "title_letter_spacing": "Espaciado entre letras",
  "title_background_color": "Color de fondo hex o 'none'",
  "title_border_style": "none/single/double/thick",
  "title_border_color": "Color del borde hex",
  
  // AUTOR
  "author_font": "Fuente para autor",
  "author_size": "Tamaño (14-24)",
  "author_color": "Color hex",
  "author_bold": true/false,
  "author_italic": true/false,
  "author_underline": "none/single",
  "author_align": "left/center/right",
  
  // ÍNDICE
  "toc_title": "Título del índice personalizado",
  "toc_font": "Fuente del índice",
  "toc_size": "Tamaño (18-28)",
  "toc_color": "Color hex",
  "toc_bold": true/false,
  "toc_underline": "none/single/double",
  "toc_entry_font": "Fuente entradas índice",
  "toc_entry_size": "Tamaño entradas (12-16)",
  "toc_dots": true/false,
  "toc_numbering_style": "decimal/roman/letters",
  
  // TÍTULOS DE CAPÍTULOS (ELEMENTO CLAVE)
  "chapter_title_font": "Fuente distintiva para capítulos",
  "chapter_title_size": "Tamaño prominente (20-32)",
  "chapter_title_color": "Color llamativo hex",
  "chapter_title_bold": true/false,
  "chapter_title_italic": true/false,
  "chapter_title_underline": "none/single/double/thick/dotted",
  "chapter_title_small_caps": true/false,
  "chapter_title_align": "left/center/right",
  "chapter_title_background": "Color de fondo hex o 'none'",
  "chapter_title_border_top": "none/single/double/thick",
  "chapter_title_border_bottom": "none/single/double/thick",
  "chapter_title_border_color": "Color del borde hex",
  "chapter_title_spacing_before": "Espacio antes (360-1440)",
  "chapter_title_spacing_after": "Espacio después (240-720)",
  "chapter_number_style": "Estilo numeración capítulos",
  "chapter_title_letter_spacing": "Espaciado entre letras (0-100)",
  
  // CONTENIDO PRINCIPAL
  "content_font": "Fuente legible para contenido",
  "content_size": "Tamaño lectura (11-14)",
  "content_color": "Color texto hex",
  "content_bold": false,
  "content_italic": false,
  "text_align": "left/justify/center",
  "line_spacing": "Interlineado (240-360)",
  "paragraph_spacing_before": "Espacio antes párrafo (0-120)",
  "paragraph_spacing_after": "Espacio después párrafo (120-240)",
  "first_line_indent": "Sangría primera línea (0-720)",
  "left_indent": "Sangría izquierda (0-360)",
  "right_indent": "Sangría derecha (0-360)",
  
  // PÁGINA Y LAYOUT
  "page_margin_top": "Margen superior (1440 = 1 pulgada)",
  "page_margin_bottom": "Margen inferior",
  "page_margin_left": "Margen izquierdo",
  "page_margin_right": "Margen derecho",
  "page_break_before_chapter": true/false,
  "widow_control": true/false,
  "keep_with_next": true/false,
  
  // ELEMENTOS ESPECIALES
  "drop_cap": true/false,
  "page_numbering": true/false,
  "page_number_style": "decimal/roman",
  "header_footer_font": "Fuente encabezados",
  "quote_style_italic": true/false,
  "quote_style_indent": "Sangría citas (360-720)",
  "emphasis_color": "Color para énfasis hex",
  
  // PERSONALIZACIÓN ÚNICA
  "theme_description": "Descripción del tema visual elegido",
  "unique_elements": "Elementos únicos aplicados"
}`;
};
// ---------- Función para crear estilos DOCX súper avanzados ----------
const createAdvancedStyles = (templateStyles) => {
  console.log('🎨 Creando estilos únicos:', templateStyles.theme_description || 'Estilo personalizado');
  
  // Añadir validación para asegurar que los títulos tengan formato
  const ensureBold = templateStyles.chapter_title_bold !== false;
  const titleSize = parseInt(templateStyles.chapter_title_size) || 24;
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${templateStyles.content_font || 'Times New Roman'}" w:eastAsia="${templateStyles.content_font || 'Times New Roman'}" w:hAnsi="${templateStyles.content_font || 'Times New Roman'}" w:cs="${templateStyles.content_font || 'Times New Roman'}"/>
        <w:sz w:val="${(parseInt(templateStyles.content_size) || 12) * 2}"/>
        <w:szCs w:val="${(parseInt(templateStyles.content_size) || 12) * 2}"/>
        <w:color w:val="${templateStyles.content_color || '000000'}"/>
        <w:lang w:val="es-ES" w:eastAsia="en-US" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="${templateStyles.line_spacing || '276'}" w:lineRule="auto" w:before="${templateStyles.paragraph_spacing_before || '0'}" w:after="${templateStyles.paragraph_spacing_after || '120'}"/>
        <w:ind w:firstLine="${templateStyles.first_line_indent || '360'}"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  
  <!-- Estilo Normal -->
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:line="${templateStyles.line_spacing || '276'}" w:lineRule="auto" w:after="${templateStyles.paragraph_spacing_after || '120'}"/>
      <w:ind w:firstLine="${templateStyles.first_line_indent || '360'}"/>
    </w:pPr>
  </w:style>
  
  <!-- Estilo Título Principal -->
  <w:style w:type="paragraph" w:styleId="BookTitle">
    <w:name w:val="Book Title"/>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:spacing w:before="720" w:after="720"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="${templateStyles.title_font || 'Times New Roman'}" w:hAnsi="${templateStyles.title_font || 'Times New Roman'}"/>
      <w:sz w:val="${(parseInt(templateStyles.title_size) || 36) * 2}"/>
      <w:szCs w:val="${(parseInt(templateStyles.title_size) || 36) * 2}"/>
      <w:color w:val="${templateStyles.title_color || '000000'}"/>
      ${templateStyles.title_bold ? '<w:b/>' : ''}
      ${templateStyles.title_italic ? '<w:i/>' : ''}
      ${templateStyles.title_underline && templateStyles.title_underline !== 'none' ? `<w:u w:val="${templateStyles.title_underline}"/>` : ''}
      ${templateStyles.title_small_caps ? '<w:smallCaps/>' : ''}
    </w:rPr>
  </w:style>
  
  <!-- Estilo Autor -->
  <w:style w:type="paragraph" w:styleId="BookAuthor">
    <w:name w:val="Book Author"/>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:spacing w:before="240" w:after="720"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="${templateStyles.author_font || 'Times New Roman'}" w:hAnsi="${templateStyles.author_font || 'Times New Roman'}"/>
      <w:sz w:val="${(parseInt(templateStyles.author_size) || 18) * 2}"/>
      <w:szCs w:val="${(parseInt(templateStyles.author_size) || 18) * 2}"/>
      <w:color w:val="${templateStyles.author_color || '333333'}"/>
      ${templateStyles.author_italic ? '<w:i/>' : ''}
      ${templateStyles.author_underline && templateStyles.author_underline !== 'none' ? `<w:u w:val="${templateStyles.author_underline}"/>` : ''}
    </w:rPr>
  </w:style>
  
  <!-- Estilo Título de Índice -->
  <w:style w:type="paragraph" w:styleId="TOCTitle">
    <w:name w:val="TOC Title"/>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:spacing w:before="720" w:after="480"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="${templateStyles.toc_font || 'Times New Roman'}" w:hAnsi="${templateStyles.toc_font || 'Times New Roman'}"/>
      <w:sz w:val="${(parseInt(templateStyles.toc_size) || 24) * 2}"/>
      <w:szCs w:val="${(parseInt(templateStyles.toc_size) || 24) * 2}"/>
      <w:color w:val="${templateStyles.toc_color || '000000'}"/>
      ${templateStyles.toc_bold ? '<w:b/>' : ''}
      ${templateStyles.toc_underline && templateStyles.toc_underline !== 'none' ? `<w:u w:val="${templateStyles.toc_underline}"/>` : ''}
    </w:rPr>
  </w:style>
  
  <!-- Estilo Título de Capítulo MEJORADO -->
  <w:style w:type="paragraph" w:styleId="ChapterTitle">
    <w:name w:val="Chapter Title"/>
    <w:basedOn w:val="Heading1"/>
    <w:qFormat/>
    <w:uiPriority w:val="10"/>
    <w:pPr>
      <w:jc w:val="${templateStyles.chapter_title_align || 'center'}"/>
      <w:spacing w:before="${templateStyles.chapter_title_spacing_before || '720'}" 
                 w:after="${templateStyles.chapter_title_spacing_after || '480'}"/>
      ${templateStyles.page_break_before_chapter !== false ? '<w:pageBreakBefore/>' : ''}
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="${templateStyles.chapter_title_font || 'Times New Roman'}" 
                w:hAnsi="${templateStyles.chapter_title_font || 'Times New Roman'}"/>
      <w:sz w:val="${titleSize * 2}"/>
      <w:szCs w:val="${titleSize * 2}"/>
      <w:color w:val="${templateStyles.chapter_title_color || '000000'}"/>
      ${ensureBold ? '<w:b/><w:bCs/>' : ''}
      ${templateStyles.chapter_title_italic ? '<w:i/><w:iCs/>' : ''}
      ${templateStyles.chapter_title_underline && templateStyles.chapter_title_underline !== 'none' ? 
        `<w:u w:val="${templateStyles.chapter_title_underline}"/>` : ''}
      ${templateStyles.chapter_title_small_caps ? '<w:smallCaps/>' : ''}
      ${templateStyles.chapter_title_letter_spacing ? 
        `<w:spacing w:val="${templateStyles.chapter_title_letter_spacing}"/>` : ''}
    </w:rPr>
  </w:style>
  
  <!-- Estilo Contenido de Capítulo -->
  <w:style w:type="paragraph" w:styleId="ChapterContent">
    <w:name w:val="Chapter Content"/>
    <w:pPr>
      <w:jc w:val="${templateStyles.text_align || 'both'}"/>
      <w:spacing w:line="${templateStyles.line_spacing || '276'}" w:lineRule="auto" w:after="${templateStyles.paragraph_spacing_after || '120'}"/>
      <w:ind w:firstLine="${templateStyles.first_line_indent || '360'}"/>
    </w:pPr>
  </w:style>
  
  <!-- Estilo TOC Entry -->
  <w:style w:type="paragraph" w:styleId="TOCEntry">
    <w:name w:val="TOC Entry"/>
    <w:pPr>
      <w:spacing w:after="120"/>
      <w:ind w:left="360"/>
    </w:pPr>
  </w:style>
  
</w:styles>`;
};

// ---------- Función para convertir tamaños KDP a dimensiones DOCX ----------
const getKdpPageDimensions = (kdpSize) => {
  // Convertir centímetros a twips (1 cm = 566.929 twips)
  const cmToTwips = (cm) => Math.round(cm * 566.929);
  
  // Mapear tamaños KDP a dimensiones en cm
  const kdpSizes = {
    '12,7 x 20,32 cm (5" x 8")': { 
      width: 12.7, height: 20.32, 
      margins: { top: 1.9, right: 1.3, bottom: 1.9, left: 1.9 } 
    },
    '12,85 x 19,84 cm (5,06" x 7,81")': { 
      width: 12.85, height: 19.84, 
      margins: { top: 1.9, right: 1.3, bottom: 1.9, left: 1.9 } 
    },
    '13,34 x 20,32 cm (5,25" x 8")': { 
      width: 13.34, height: 20.32, 
      margins: { top: 1.9, right: 1.3, bottom: 1.9, left: 1.9 } 
    },
    '13,97 x 21,59 cm (5,5" x 8,5")': { 
      width: 13.97, height: 21.59, 
      margins: { top: 1.9, right: 1.3, bottom: 1.9, left: 1.9 } 
    },
    '15,24 x 22,86 cm (6" x 9")': { 
      width: 15.24, height: 22.86, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } // Más popular, márgenes generosos
    },
    '15,6 x 23,39 cm (6,14" x 9,21")': { 
      width: 15.6, height: 23.39, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } 
    },
    '16,99 x 24,41 cm (6,69" x 9,61")': { 
      width: 16.99, height: 24.41, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } 
    },
    '17,78 x 25,4 cm (7" x 10")': { 
      width: 17.78, height: 25.4, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } 
    },
    '18,9 x 24,61 cm (7,44" x 9,69")': { 
      width: 18.9, height: 24.61, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } 
    },
    '19,05 x 23,5 cm (7,5" x 9,25")': { 
      width: 19.05, height: 23.5, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } 
    },
    '20,32 x 25,4 cm (8" x 10")': { 
      width: 20.32, height: 25.4, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } 
    },
    '20,96 x 15,24 cm (8,25" x 6")': { 
      width: 20.96, height: 15.24, 
      margins: { top: 1.9, right: 1.9, bottom: 1.9, left: 1.9 } // Formato apaisado
    },
    '20,96 x 20,96 cm (8,25" x 8,25")': { 
      width: 20.96, height: 20.96, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } // Formato cuadrado
    },
    '21,59 x 21,59 cm (8,5" x 8,5")': { 
      width: 21.59, height: 21.59, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } 
    },
    '21,59 x 27,94 cm (8,5" x 11")': { 
      width: 21.59, height: 27.94, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } 
    },
    '21 x 29,7 cm (8,27" x 11,69")': { 
      width: 21, height: 29.7, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } 
    },
    '20,96 x 27,94 cm (8,25" x 11")': { 
      width: 20.96, height: 27.94, 
      margins: { top: 2.5, right: 1.9, bottom: 2.5, left: 1.9 } // Tapa dura
    }
  };
  
  // Obtener dimensiones o usar por defecto 6"x9"
  const dimensions = kdpSizes[kdpSize] || kdpSizes['15,24 x 22,86 cm (6" x 9")'];
  
  return {
    width: cmToTwips(dimensions.width),
    height: cmToTwips(dimensions.height),
    margins: {
      top: cmToTwips(dimensions.margins.top),
      right: cmToTwips(dimensions.margins.right),
      bottom: cmToTwips(dimensions.margins.bottom),
      left: cmToTwips(dimensions.margins.left)
    }
  };
};

// ---------- Función para procesar contenido de capítulos ----------
const processChapterContent = (content) => {
  if (!content) return [];
  
  // Limpiar y normalizar el contenido
  let processed = content
    .replace(/\r\n/g, '\n') // Normalizar saltos de línea
    .replace(/\r/g, '\n')   // Normalizar saltos de línea
    .replace(/\n\s*\n/g, '\n\n') // Normalizar párrafos dobles
    .trim();
  
  // Dividir en párrafos y limpiar cada uno
  const paragraphs = processed.split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => p.replace(/\n/g, ' ')); // Convertir saltos simples en espacios
  
  // Procesar cada párrafo para detectar formato de negrita **texto**
  return paragraphs.map(paragraph => {
    return processTextFormatting(paragraph);
  });
};

// ---------- Función para procesar formato de texto (negrita, cursiva, etc.) ----------
const processTextFormatting = (text) => {
  if (!text) return [{ text: '', bold: false, italic: false }];
  
  // Primero, procesamos el texto para manejar tanto negrita como cursiva
  // Usamos un enfoque secuencial para evitar conflictos entre patrones
  
  const parts = [];
  let currentText = text;
  let currentIndex = 0;
  
  // Array para almacenar todas las coincidencias de formato
  const matches = [];
  
  // Buscar patrones **texto** para negrita (debe ir primero para tener prioridad)
  const boldPattern = /\*\*((?:[^*]|\*(?!\*))+?)\*\*/g;
  let match;
  while ((match = boldPattern.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
      type: 'bold',
      fullMatch: match[0]
    });
  }
  
  // Buscar patrones *texto* para cursiva (excluyendo los que ya son negrita)
  const italicPattern = /(?<!\*)\*([^*\n]+?)\*(?!\*)/g;
  while ((match = italicPattern.exec(text)) !== null) {
    // Verificar que no esté dentro de un patrón de negrita
    const isInsideBold = matches.some(boldMatch => 
      match.index >= boldMatch.start && match.index + match[0].length <= boldMatch.end
    );
    
    if (!isInsideBold) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        type: 'italic',
        fullMatch: match[0]
      });
    }
  }
  
  // Ordenar coincidencias por posición
  matches.sort((a, b) => a.start - b.start);
  
  // Procesar el texto con las coincidencias ordenadas
  currentIndex = 0;
  
  for (const formatMatch of matches) {
    // Añadir texto normal antes del formato
    if (formatMatch.start > currentIndex) {
      const normalText = text.substring(currentIndex, formatMatch.start);
      if (normalText) {
        parts.push({ text: normalText, bold: false, italic: false });
      }
    }
    
    // Añadir texto con formato
    if (formatMatch.content.trim()) {
      parts.push({ 
        text: formatMatch.content, 
        bold: formatMatch.type === 'bold', 
        italic: formatMatch.type === 'italic' 
      });
    }
    
    currentIndex = formatMatch.end;
  }
  
  // Añadir el resto del texto normal
  if (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    if (remainingText) {
      parts.push({ text: remainingText, bold: false, italic: false });
    }
  }
  
  // Si no se encontraron patrones de formato, devolver el texto completo como normal
  if (parts.length === 0) {
    return [{ text: text, bold: false, italic: false }];
  }
  
  return parts;
};

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

  console.log(`[${job.id}] Llamando a LLM1 para generar plantilla...`);
  
  let templateStyles;
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 2000; // 2 segundos entre reintentos
  
  while (retryCount <= maxRetries) {
    try {
      console.log(`[${job.id}] Intento ${retryCount + 1}/${maxRetries + 1} de llamada a LLM...`);
      
      const templateResponse = await callAI(templateRequest);
      
      if (!templateResponse.content) {
        throw new Error('LLM returned empty content for template');
      }
      
      const cleanedResponse = cleanJsonResponse(templateResponse.content);
      console.log(`[${job.id}] Respuesta LLM1 limpia:`, cleanedResponse);
      templateStyles = JSON.parse(cleanedResponse);
      console.log(`[${job.id}] Plantilla generada exitosamente:`, templateStyles);
      break; // Éxito, salir del bucle
      
    } catch (e) {
      console.error(`[${job.id}] Error en intento ${retryCount + 1}:`, e);
      
      // Verificar si es un error de modelo sobrecargado (503) o similar
      const isRetryableError = (
        e.message.includes('overloaded') ||
        e.message.includes('503') ||
        e.message.includes('502') ||
        e.message.includes('504') ||
        e.message.includes('empty content') ||
        e.message.includes('timeout')
      );
      
      if (retryCount < maxRetries && isRetryableError) {
        console.log(`[${job.id}] Error recuperable detectado, reintentando en ${retryDelay * (retryCount + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1))); // Backoff exponencial
        retryCount++;
        continue;
      } else {
        console.error(`[${job.id}] Todos los reintentos fallaron o error no recuperable. Usando fallback a plantillas estáticas.`);
        
        // Actualizar estado para indicar fallback
        await supabase.from("export_jobs").update({
          status: "generating_template",
          status_message: "IA no disponible, usando plantillas predeterminadas...",
          progress_percentage: 25
        }).eq("id", job.id);
        
        // Usar fallback a plantillas estáticas
        console.log(`[${job.id}] Iniciando fallback a generateDocxWithTemplates...`);
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

  // PASO 2: Usar contenido real de los capítulos (NO regenerar con IA)
  console.log(`[${job.id}] Usando contenido real de capítulos de la base de datos...`);
  
  // Crear contenido estructurado usando los datos reales de la base de datos
  const structuredContent = {
    book_title: book.title,
    book_author: book.author,
    book_subtitle: "", // Opcional, se puede añadir al modelo de datos si es necesario
    toc_title: templateStyles.toc_title || "Índice",
    copyright_page: `© ${new Date().getFullYear()} ${book.author}. Todos los derechos reservados.`,
    chapters: chapters.map((chapter, index) => ({
      chapter_number: `Capítulo ${index + 1}`,
      chapter_title: chapter.title,
      chapter_content: chapter.content || 'Sin contenido' // Usar contenido real de la BD
    }))
  };
  
  console.log(`[${job.id}] Contenido estructurado creado con datos reales:`, {
    book_title: structuredContent.book_title,
    book_author: structuredContent.book_author,
    chapters_count: structuredContent.chapters.length,
    first_chapter_title: structuredContent.chapters[0]?.chapter_title,
    first_chapter_content_length: structuredContent.chapters[0]?.chapter_content?.length || 0
  });

  // Actualizar progreso
  await supabase.from("export_jobs").update({
    status: "rendering_docx",
    status_message: "Renderizando documento DOCX final...",
    progress_percentage: 80
  }).eq("id", job.id);

  // PASO 3: Generar DOCX
  console.log(`[${job.id}] Renderizando DOCX...`);
  
  try {
    const docxBuffer = await renderDocxWithTemplater(templateStyles, structuredContent, job.id, job);
    
    // Subir DOCX a Supabase Storage
    const fileName = `${job.user_id}/${job.book_id}/${job.id}.docx`;
    
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      });
    
    if (uploadError) {
      throw new Error(`Error subiendo DOCX: ${uploadError.message}`);
    }
    
    console.log(`[${job.id}] DOCX generado y subido exitosamente: ${fileName}`);
    
    return {
      templateStyles,
      structuredContent,
      docxPath: fileName,
      message: "DOCX generado exitosamente con LLMs"
    };
    
  } catch (error) {
    console.error(`[${job.id}] Error en renderizado DOCX:`, error);
    throw new Error(`Error renderizando DOCX: ${error.message}`);
  }
};

// ---------- Función de Renderizado DOCX MEJORADA Y CORREGIDA ----------
const renderDocxWithTemplater = async (templateStyles, structuredContent, jobId, job) => {
  console.log(`[${jobId}] Iniciando renderizado con estilos avanzados...`);
  
  // Plantilla base DOCX con estilos profesionales y dimensiones KDP
  const baseDocxTemplate = createAdvancedDocxTemplate(templateStyles, job);
  
  try {
    // Cargar plantilla base
    const zip = new PizZip(baseDocxTemplate);
    
    // Procesar y preparar datos para la plantilla
    const processedChapters = (structuredContent.chapters || []).map((chapter, index) => {
      console.log(`[${jobId}] Procesando capítulo ${index + 1}:`, {
        title: chapter.chapter_title,
        content_length: chapter.chapter_content?.length || 0
      });
      
      // Procesar el contenido con formato de negrita y cursiva
      const formattedParagraphs = processChapterContent(chapter.chapter_content || 'Sin contenido');
      
      return {
        chapter_title: chapter.chapter_title || `Capítulo ${index + 1}`,
        chapter_paragraphs: formattedParagraphs,
        has_page_break: templateStyles.page_break_before_chapter !== false
      };
    });
    
    // Generar texto para el índice
    const tocEntries = processedChapters.map((c, index) => ({
      number: index + 1,
      title: c.chapter_title
    }));

    // Generar XML para las entradas del índice
    const tocEntriesXml = tocEntries.map(entry => `
    <w:p>
      <w:pPr>
        <w:pStyle w:val="TOCEntry"/>
      </w:pPr>
      <w:r>
        <w:t>${escapeXml(entry.number + '. ' + entry.title)}</w:t>
      </w:r>
    </w:p>`).join('');

    // Generar XML para los capítulos con soporte para negrita y cursiva
    const chaptersXml = processedChapters.map((chapter, index) => {
      // Generar XML para cada párrafo con formato
      const paragraphsXml = chapter.chapter_paragraphs.map(paragraphParts => {
        // Generar runs (w:r) para cada parte del párrafo
        const runsXml = paragraphParts.map(part => {
          const boldTag = part.bold ? '<w:b/><w:bCs/>' : '';
          const italicTag = part.italic ? '<w:i/><w:iCs/>' : '';
          const formatTags = boldTag + italicTag;
          
          return `
        <w:r>
          <w:rPr>
            ${formatTags}
          </w:rPr>
          <w:t>${escapeXml(part.text)}</w:t>
        </w:r>`;
        }).join('');
        
        return `
    <w:p>
      <w:pPr>
        <w:pStyle w:val="ChapterContent"/>
      </w:pPr>${runsXml}
    </w:p>`;
      }).join('');

      return `
    ${chapter.has_page_break && index > 0 ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : ''}
    
    <w:p>
      <w:pPr>
        <w:pStyle w:val="ChapterTitle"/>
      </w:pPr>
      <w:r>
        <w:t>${escapeXml(chapter.chapter_title)}</w:t>
      </w:r>
    </w:p>
    ${paragraphsXml}`;
    }).join('');

    // Reemplazar placeholders en el documento
    const documentXml = zip.file('word/document.xml').asText();
    
    const replacedXml = documentXml
      .replace('{book_title}', escapeXml(structuredContent.book_title || 'Sin título'))
      .replace('{book_subtitle}', escapeXml(structuredContent.book_subtitle || ''))
      .replace('{book_author}', escapeXml(structuredContent.book_author || 'Sin autor'))
      .replace('{copyright_page}', escapeXml(structuredContent.copyright_page || `© ${new Date().getFullYear()} ${structuredContent.book_author || 'Autor'}. Todos los derechos reservados.`))
      .replace('{toc_title}', escapeXml(structuredContent.toc_title || 'Índice'))
      .replace('<!-- TOC_ENTRIES_PLACEHOLDER -->', tocEntriesXml)
      .replace('<!-- CHAPTERS_PLACEHOLDER -->', chaptersXml);
    
    zip.file('word/document.xml', replacedXml);
    
    console.log(`[${jobId}] === DEBUGGING ===`);
    console.log(`[${jobId}] Número de capítulos:`, processedChapters.length);
    console.log(`[${jobId}] Número de entradas TOC:`, tocEntries.length);
    
    // Generar buffer del DOCX
    const buffer = zip.generate({
      type: 'uint8array',
      compression: 'DEFLATE'
    });
    
    console.log(`[${jobId}] DOCX renderizado exitosamente, tamaño: ${buffer.length} bytes`);
    return buffer;
    
  } catch (error) {
    console.error(`[${jobId}] Error en renderizado:`, error);
    throw new Error(`Error renderizando plantilla: ${error.message}`);
  }
};
// ---------- Plantilla DOCX Avanzada MEJORADA Y CORREGIDA ----------
const createAdvancedDocxTemplate = (templateStyles, job) => {
  const kdpSize = job?.kdp_format_size || '15,24 x 22,86 cm (6" x 9")';
  const pageDimensions = getKdpPageDimensions(kdpSize);
  
  console.log(`Aplicando dimensiones KDP: ${kdpSize}`);
  console.log(`Dimensiones en twips: ${pageDimensions.width}x${pageDimensions.height}`);
  console.log(`Márgenes: top=${pageDimensions.margins.top}, right=${pageDimensions.margins.right}, bottom=${pageDimensions.margins.bottom}, left=${pageDimensions.margins.left}`);
  
  const zip = new PizZip();
  
  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);
  
  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  
  // word/_rels/document.xml.rels
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  
  // word/styles.xml
  zip.file('word/styles.xml', createAdvancedStyles(templateStyles));
  
  // word/document.xml - CORREGIDO con placeholders para reemplazo manual
  const docxXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- PORTADA -->
    <w:p>
      <w:pPr>
        <w:pStyle w:val="BookTitle"/>
      </w:pPr>
      <w:r>
        <w:t>{book_title}</w:t>
      </w:r>
    </w:p>
    
    <!-- Subtítulo -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="28"/>
          <w:color w:val="666666"/>
        </w:rPr>
        <w:t>{book_subtitle}</w:t>
      </w:r>
    </w:p>

    <!-- Autor -->
    <w:p>
      <w:pPr>
        <w:pStyle w:val="BookAuthor"/>
      </w:pPr>
      <w:r>
        <w:t>{book_author}</w:t>
      </w:r>
    </w:p>

    <!-- Salto de página -->
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <!-- COPYRIGHT -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="2880" w:after="240"/>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="20"/>
          <w:color w:val="666666"/>
        </w:rPr>
        <w:t>{copyright_page}</w:t>
      </w:r>
    </w:p>

    <!-- Salto de página -->
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <!-- ÍNDICE -->
    <w:p>
      <w:pPr>
        <w:pStyle w:val="TOCTitle"/>
      </w:pPr>
      <w:r>
        <w:t>{toc_title}</w:t>
      </w:r>
    </w:p>

    <!-- Placeholder para entradas del índice -->
    <!-- TOC_ENTRIES_PLACEHOLDER -->

    <!-- Salto de página antes del contenido -->
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <!-- Placeholder para capítulos -->
    <!-- CHAPTERS_PLACEHOLDER -->

    <!-- Configuración de página -->
    <w:sectPr>
      <w:pgSz w:w="${pageDimensions.width}" w:h="${pageDimensions.height}"/>
      <w:pgMar w:top="${pageDimensions.margins.top}" w:right="${pageDimensions.margins.right}" 
               w:bottom="${pageDimensions.margins.bottom}" w:left="${pageDimensions.margins.left}" 
               w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  
  zip.file('word/document.xml', docxXml);
  
  console.log('Plantilla DOCX profesional creada con estilos KDP y formato de capítulos mejorado');
  return zip.generate({ type: 'uint8array' });
};

// ---------- Función Fallback (Plantillas Estáticas) ----------
const generateDocxWithTemplates = async (book, chapters, job, supabase) => {
  console.log(`[${job.id}] Generando DOCX con plantillas estáticas...`);
  
  // Usar estilos predeterminados
  const defaultStyles = {
    title_font: "Cinzel",
    title_size: "28",
    title_color: "000000",
    title_bold: true,
    title_align: "center",
    author_font: "Merriweather",
    author_size: "16",
    author_color: "333333",
    author_italic: true,
    content_font: "Merriweather",
    content_size: "12",
    content_color: "000000",
    text_align: "justify",
    line_spacing: "276",
    paragraph_spacing_after: "120",
    first_line_indent: "360",
    chapter_title_font: "Cinzel",
    chapter_title_size: "24",
    chapter_title_color: "000000",
    chapter_title_bold: true,
    chapter_title_align: "center",
    chapter_title_spacing_before: "720",
    chapter_title_spacing_after: "480",
    page_break_before_chapter: true,
    toc_title: book.language === 'es' ? 'Índice' : 'Table of Contents',
    toc_font: "Merriweather",
    toc_size: "20",
    toc_bold: true,
    theme_description: "Plantilla clásica predeterminada"
  };
  
  // Estructurar contenido básico
  const basicContent = {
    book_title: book.title,
    book_author: book.author,
    book_subtitle: "",
    toc_title: book.language === 'es' ? 'Índice' : 'Table of Contents',
    copyright_page: `© ${new Date().getFullYear()} ${book.author}. Todos los derechos reservados.`,
    chapters: chapters.map(ch => ({
      chapter_title: ch.title,
      chapter_content: ch.content || 'Contenido del capítulo pendiente.'
    }))
  };
  
  try {
    const docxBuffer = await renderDocxWithTemplater(defaultStyles, basicContent, job.id, job);
    
    // Subir DOCX a Supabase Storage
    const fileName = `${job.user_id}/${job.book_id}/${job.id}.docx`;
    
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      });
    
    if (uploadError) {
      throw new Error(`Error subiendo DOCX: ${uploadError.message}`);
    }
    
    console.log(`[${job.id}] DOCX estático generado y subido: ${fileName}`);
    
    return {
      templateStyles: defaultStyles,
      structuredContent: basicContent,
      docxPath: fileName,
      message: "DOCX generado con plantillas estáticas"
    };
    
  } catch (error) {
    console.error(`[${job.id}] Error en generación estática:`, error);
    throw new Error(`Error generando DOCX estático: ${error.message}`);
  }
};

// ===== HANDLER PRINCIPAL =====
functions.http('generate-book-docx', async (req, res) => {
  // Manejar CORS
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  console.log('=== GENERATE-BOOK-DOCX FUNCTION STARTED (GOOGLE CLOUD) ===');
  console.log('Request method:', req.method);
  console.log('Request headers:', req.headers);
  
  let job = null;
  
  try {
    const requestBody = req.body;
    console.log('Request body received:', requestBody);
    
    const { record } = requestBody;
    
    if (!record) {
      console.error('ERROR: No job payload in request body');
      throw new Error('No job record provided');
    }
    
    job = record;
    console.log(`[${job.id}] ✅ FUNCIÓN INICIADA - Generando DOCX para book_id: ${job.book_id}`);
    console.log(`[${job.id}] Job details:`, {
      id: job.id,
      book_id: job.book_id,
      user_id: job.user_id,
      format: job.format,
      status: job.status,
      editor_model_id: job.editor_model_id
    });
    
    // Actualizar estado inmediatamente para confirmar que la función se ejecuta
    console.log(`[${job.id}] 🔄 Actualizando estado a 'processing'...`);
    await supabaseClient.from("export_jobs").update({
      status: "processing",
      status_message: "Función generate-book-docx iniciada correctamente en Google Cloud",
      progress_percentage: 5
    }).eq("id", job.id);
    console.log(`[${job.id}] ✅ Estado actualizado a 'processing'`);

    // Obtener datos del libro
    const { data: book, error: bookError } = await supabaseClient
      .from("books")
      .select("*")
      .eq("id", job.book_id)
      .maybeSingle();

    if (bookError || !book) {
      throw new Error(`Error obteniendo libro: ${bookError?.message || 'Libro no encontrado'}`);
    }

    // Obtener capítulos
    const { data: chapters, error: chaptersError } = await supabaseClient
      .from("chapters")
      .select("*")
      .eq("book_id", job.book_id)
      .order("order_number");

    if (chaptersError) {
      throw new Error(`Error obteniendo capítulos: ${chaptersError.message}`);
    }

    if (!chapters || chapters.length === 0) {
      throw new Error('No se encontraron capítulos para el libro');
    }

    console.log(`[${job.id}] Libro: ${book.title}, Capítulos: ${chapters.length}`);

    let result;

    // Verificar si hay modelo de IA configurado
    if (job.editor_model_id) {
      console.log(`[${job.id}] 🤖 Generando DOCX con IA (modelo: ${job.editor_model_id})`);
      try {
        result = await generateDocxWithLLMs(book, chapters, job, supabaseClient);
        console.log(`[${job.id}] ✅ generateDocxWithLLMs completado exitosamente`);
      } catch (llmError) {
        console.error(`[${job.id}] ❌ Error en generateDocxWithLLMs:`, llmError);
        throw llmError;
      }
    } else {
      console.log(`[${job.id}] 📄 Generando DOCX con plantillas estáticas`);
      try {
        result = await generateDocxWithTemplates(book, chapters, job, supabaseClient);
        console.log(`[${job.id}] ✅ generateDocxWithTemplates completado exitosamente`);
      } catch (templateError) {
        console.error(`[${job.id}] ❌ Error en generateDocxWithTemplates:`, templateError);
        throw templateError;
      }
    }

    console.log(`[${job.id}] 🔗 Generando URL de descarga pública para: ${result.docxPath}`);
    
    // Generar URL de descarga pública
    const { data: urlData, error: urlError } = await supabaseClient.storage
      .from('exports')
      .createSignedUrl(result.docxPath, 60 * 60 * 24); // 24 horas de validez
    
    if (urlError) {
      console.error(`[${job.id}] ❌ Error generando URL firmada:`, urlError);
      throw new Error(`Error generando URL de descarga: ${urlError.message}`);
    }
    
    const downloadUrl = urlData?.signedUrl || null;
    console.log(`[${job.id}] ✅ URL de descarga generada: ${downloadUrl ? 'SÍ' : 'NO'}`);
    
    // Actualizar job como completado con URL de descarga
    console.log(`[${job.id}] 💾 Actualizando estado del job a 'completed'...`);
    
    const { error: updateError } = await supabaseClient.from("export_jobs").update({
      status: "completed",
      status_message: "Documento DOCX generado exitosamente",
      progress_percentage: 100,
      download_url: downloadUrl,
      docx_file_path: result.docxPath
    }).eq("id", job.id);
    
    if (updateError) {
      console.error(`[${job.id}] ❌ Error actualizando job:`, updateError);
      throw new Error(`Error actualizando estado del job: ${updateError.message}`);
    }
    
    console.log(`[${job.id}] ✅ Job actualizado como completado con URL: ${downloadUrl}`);

    res.status(200).json({ 
      success: true, 
      message: "DOCX pipeline implemented successfully in Google Cloud",
      result 
    });

  } catch (e) {
    console.error("generate-book-docx error:", e);
    
    if (job) {
      await supabaseClient.from("export_jobs").update({
        status: "failed",
        status_message: `Error: ${e.message}`,
        progress_percentage: 0
      }).eq("id", job.id);
    }
    
    res.status(500).json({ 
      error: e.message,
      success: false 
    });
  }
});