import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface KeywordInput {
  keywords: string[]
  mainKeyword: string
  titleKeyword: string
  modelId: string
}

interface ThematicSuggestion {
  category: string
  subcategory: string
  theme: string
  description: string
  keywords_used: string[]
}

interface TitleSuggestion {
  title: string
  subtitle?: string
  keywords_incorporated: string[]
  amazon_optimized: boolean
}

interface BookDetails {
  idea: string
  category: string
  subcategory: string
  book_attributes: Record<string, any>
  target_audience: string
  estimated_pages: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, payload } = await req.json()

    switch (action) {
      case 'generate_themes':
        return await generateThemes(supabaseClient, payload as KeywordInput)
      
      case 'generate_titles':
        return await generateTitles(supabaseClient, payload)
      
      case 'generate_book_details':
        return await generateBookDetails(supabaseClient, payload)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Acción no válida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error en ai-creator-chat:', error)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function generateThemes(supabaseClient: any, input: KeywordInput): Promise<Response> {
  try {
    console.log('generateThemes called with input:', input)
    
    // Obtener categorías disponibles
    const { data: categories, error: categoriesError } = await supabaseClient
      .from('categories')
      .select('name, display_name, parent_id')
      .order('parent_id', { nullsFirst: true })

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError)
      throw categoriesError
    }
    
    console.log('Categories fetched:', categories?.length)

    // Obtener configuración del modelo de IA
    const { data: aiModel, error: modelError } = await supabaseClient
      .from('ai_models')
      .select(`
        *,
        ai_providers (*)
      `)
      .eq('id', input.modelId)
      .single()

    if (modelError) {
      console.error('Error fetching AI model:', modelError)
      throw modelError
    }
    
    console.log('AI Model fetched:', aiModel?.name)

    const prompt = `
Eres un experto en creación de libros y marketing editorial. Analiza las siguientes palabras clave y genera 6-8 temáticas de libros categorizadas.

PALABRAS CLAVE:
- Palabra clave principal: "${input.mainKeyword}"
- Palabra para título: "${input.titleKeyword}"
- Otras palabras: ${input.keywords.filter(k => k !== input.mainKeyword && k !== input.titleKeyword).join(', ')}

CATEGORÍAS DISPONIBLES:
${categories.filter(c => !c.parent_id).map(c => `- ${c.display_name} (${c.name})`).join('\n')}

SUBCATEGORÍAS DISPONIBLES:
${categories.filter(c => c.parent_id).map(c => `- ${c.display_name} (${c.name})`).join('\n')}

INSTRUCCIONES:
1. Genera 6-8 temáticas de libros diferentes
2. Cada temática debe usar la palabra clave principal de manera natural
3. Categoriza cada temática en una de las categorías/subcategorías disponibles
4. Proporciona una descripción atractiva de 2-3 líneas para cada temática
5. Indica qué palabras clave se incorporarían en cada temática

FORMATO DE RESPUESTA (JSON):
{
  "themes": [
    {
      "category": "nombre_categoria",
      "subcategory": "nombre_subcategoria",
      "theme": "Título descriptivo de la temática",
      "description": "Descripción atractiva de 2-3 líneas explicando el enfoque del libro",
      "keywords_used": ["palabra1", "palabra2", "palabra3"]
    }
  ]
}

Responde SOLO con el JSON válido, sin texto adicional.`

    // Llamar a la IA real
    console.log('Calling AI with model:', aiModel.name)
    const aiResponse = await callAI(supabaseClient, aiModel, prompt)
    
    let themes
    try {
      const cleanedResponse = cleanAIResponse(aiResponse)
      console.log('Attempting to parse cleaned response:', cleanedResponse)
      
      // Verificar que la respuesta limpia no esté vacía
      if (!cleanedResponse || cleanedResponse.trim() === '') {
        throw new Error('Respuesta de IA vacía después de limpiar')
      }
      
      themes = JSON.parse(cleanedResponse)
      console.log('Themes parsed successfully:', themes?.themes?.length)
      
      // Validar estructura de la respuesta
      if (!themes || !themes.themes || !Array.isArray(themes.themes)) {
        console.error('Invalid themes structure:', themes)
        throw new Error('Estructura de respuesta inválida')
      }
      
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      console.error('Parse error details:', {
        message: parseError.message,
        name: parseError.name,
        stack: parseError.stack
      })
      
      // Intentar generar una respuesta de fallback
      console.log('Attempting fallback response generation...')
      themes = {
        themes: [
          {
            category: "ficcion",
            subcategory: "novela_general",
            theme: "Novela basada en las palabras clave",
            description: "Una historia narrativa que incorpora todos los elementos mencionados",
            keywords_used: input.keywords
          },
          {
            category: "no_ficcion",
            subcategory: "autoayuda",
            theme: "Guía práctica sobre el tema",
            description: "Un manual práctico que aborda los conceptos principales",
            keywords_used: input.keywords
          },
          {
            category: "espirituales",
            subcategory: "devocionales",
            theme: "Reflexiones y meditaciones",
            description: "Una colección de pensamientos inspiradores sobre el tema",
            keywords_used: input.keywords
          },
          {
            category: "educativos",
            subcategory: "guias_estudio",
            theme: "Manual de estudio completo",
            description: "Una guía educativa estructurada para el aprendizaje",
            keywords_used: input.keywords
          }
        ]
      }
      console.log('Using fallback themes:', themes)
    }

    return new Response(
      JSON.stringify(themes),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating themes:', error)
    return new Response(
      JSON.stringify({ error: 'Error al generar temáticas' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function generateTitles(supabaseClient: any, payload: any): Promise<Response> {
  try {
    const { selectedTheme, keywords, modelId } = payload

    // Obtener configuración del modelo de IA
    const { data: aiModel, error: modelError } = await supabaseClient
      .from('ai_models')
      .select(`
        *,
        ai_providers (*)
      `)
      .eq('id', modelId)
      .single()

    if (modelError) throw modelError

    const prompt = `
Eres un experto en marketing editorial y optimización para Amazon KDP. Genera 4 títulos optimizados para el siguiente libro.

TEMÁTICA SELECCIONADA:
- Categoría: ${selectedTheme.category}
- Subcategoría: ${selectedTheme.subcategory}
- Tema: ${selectedTheme.theme}
- Descripción: ${selectedTheme.description}

PALABRAS CLAVE A INCORPORAR:
- Palabra clave principal: "${keywords.mainKeyword}"
- Palabra para título: "${keywords.titleKeyword}"
- Otras palabras relevantes: ${keywords.keywords.filter((k: string) => k !== keywords.mainKeyword && k !== keywords.titleKeyword).join(', ')}

INSTRUCCIONES:
1. Genera 4 títulos diferentes optimizados para Amazon
2. Cada título debe ser atractivo y comercial
3. Incorpora la palabra clave principal de manera natural
4. Usa la palabra para título como base o inspiración
5. Los títulos deben ser específicos y llamativos
6. Considera subtítulos cuando sea apropiado
7. Optimiza para búsquedas en Amazon

FORMATO DE RESPUESTA (JSON):
{
  "titles": [
    {
      "title": "Título principal del libro",
      "subtitle": "Subtítulo opcional si es necesario",
      "keywords_incorporated": ["palabra1", "palabra2"],
      "amazon_optimized": true
    }
  ]
}

Responde SOLO con el JSON válido, sin texto adicional.`

    // Llamar a la IA real
    const aiResponse = await callAI(supabaseClient, aiModel, prompt)
    
    let titles
    try {
      const cleanedResponse = cleanAIResponse(aiResponse)
      console.log('Attempting to parse cleaned response for titles:', cleanedResponse)
      
      // Verificar que la respuesta limpia no esté vacía
      if (!cleanedResponse || cleanedResponse.trim() === '') {
        throw new Error('Respuesta de IA vacía después de limpiar')
      }
      
      titles = JSON.parse(cleanedResponse)
      console.log('Titles parsed successfully:', titles?.titles?.length)
      
      // Validar estructura de la respuesta
      if (!titles || !titles.titles || !Array.isArray(titles.titles)) {
        console.error('Invalid titles structure:', titles)
        throw new Error('Estructura de respuesta inválida')
      }
      
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      console.error('Parse error details:', {
        message: parseError.message,
        name: parseError.name,
        stack: parseError.stack
      })
      
      // Intentar generar una respuesta de fallback
      console.log('Attempting fallback titles generation...')
      const baseKeyword = payload.keywords?.mainKeyword || 'tema'
      const titleKeyword = payload.keywords?.titleKeyword || 'guía'
      
      titles = {
        titles: [
          {
            title: `${titleKeyword}: Una Guía Completa sobre ${baseKeyword}`,
            subtitle: "Todo lo que necesitas saber",
            keywords_incorporated: [baseKeyword, titleKeyword],
            amazon_optimized: true
          },
          {
            title: `El Manual Definitivo de ${baseKeyword}`,
            subtitle: `Estrategias y técnicas para dominar ${titleKeyword}`,
            keywords_incorporated: [baseKeyword, titleKeyword],
            amazon_optimized: true
          },
          {
            title: `${baseKeyword} para Principiantes`,
            subtitle: `Aprende ${titleKeyword} desde cero`,
            keywords_incorporated: [baseKeyword, titleKeyword],
            amazon_optimized: true
          },
          {
            title: `Secretos de ${baseKeyword}`,
            subtitle: `Técnicas avanzadas de ${titleKeyword}`,
            keywords_incorporated: [baseKeyword, titleKeyword],
            amazon_optimized: true
          }
        ]
      }
      console.log('Using fallback titles:', titles)
    }

    return new Response(
      JSON.stringify(titles),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating titles:', error)
    return new Response(
      JSON.stringify({ error: 'Error al generar títulos' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function generateBookDetails(supabaseClient: any, payload: any): Promise<Response> {
  try {
    const { selectedTitle, selectedTheme, keywords, modelId } = payload

    // Obtener instrucciones específicas de la categoría
    const { data: categoryInstructions, error: instructionsError } = await supabaseClient
      .from('category_instructions')
      .select('instructions')
      .eq('category', selectedTheme.category)
      .eq('subcategory', selectedTheme.subcategory)
      .maybeSingle()

    // Obtener atributos de la subcategoría
    const { data: attributes, error: attributesError } = await supabaseClient
      .from('subcategory_attributes')
      .select('*')
      .eq('subcategory_id', selectedTheme.subcategory)
      .order('display_order')

    // Obtener configuración del modelo de IA
    const { data: aiModel, error: modelError } = await supabaseClient
      .from('ai_models')
      .select(`
        *,
        ai_providers (*)
      `)
      .eq('id', modelId)
      .single()

    if (modelError) throw modelError

    const prompt = `
Eres un experto en creación de libros y conoces perfectamente los requisitos de cada categoría editorial. Genera los detalles completos para este libro.

INFORMACIÓN DEL LIBRO:
- Título seleccionado: "${selectedTitle.title}"
- Subtítulo: "${selectedTitle.subtitle || ''}"
- Categoría: ${selectedTheme.category}
- Subcategoría: ${selectedTheme.subcategory}
- Temática: ${selectedTheme.theme}
- Descripción: ${selectedTheme.description}

PALABRAS CLAVE:
${keywords.keywords.join(', ')}

INSTRUCCIONES ESPECÍFICAS DE LA CATEGORÍA:
${categoryInstructions?.instructions || 'Seguir las mejores prácticas para esta categoría'}

ATRIBUTOS REQUERIDOS:
${attributes?.map((attr: any) => `- ${attr.display_name} (${attr.type}): ${attr.description || ''}`).join('\n') || 'No hay atributos específicos definidos'}

INSTRUCCIONES:
1. Genera una idea/descripción detallada del libro (200-300 palabras)
2. Define el público objetivo específico
3. Estima el número de páginas apropiado
4. Completa todos los atributos requeridos para esta categoría
5. Asegúrate de seguir las instrucciones específicas de la categoría
6. La idea debe ser comercialmente viable y atractiva

FORMATO DE RESPUESTA (JSON):
{
  "idea": "Descripción detallada del libro de 200-300 palabras",
  "category": "${selectedTheme.category}",
  "subcategory": "${selectedTheme.subcategory}",
  "book_attributes": {
    // Completa todos los atributos requeridos según la subcategoría
  },
  "target_audience": "Descripción específica del público objetivo",
  "estimated_pages": 150
}

Responde SOLO con el JSON válido, sin texto adicional.`

    // Llamar a la IA real
    const aiResponse = await callAI(supabaseClient, aiModel, prompt)
    
    let bookDetails
    try {
      const cleanedResponse = cleanAIResponse(aiResponse)
      bookDetails = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      throw new Error('Error al procesar respuesta de IA')
    }

    return new Response(
      JSON.stringify(bookDetails),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating book details:', error)
    return new Response(
      JSON.stringify({ error: 'Error al generar detalles del libro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

function cleanAIResponse(response: string): string {
  // Remover bloques de código markdown
  let cleaned = response.trim()
  
  console.log('Raw AI response:', response)
  console.log('AI Response received, length:', response.length)
  
  // Remover ```json al inicio
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '')
  }
  
  // Remover ``` al final
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/, '')
  }
  
  // Remover cualquier texto antes del primer {
  const firstBrace = cleaned.indexOf('{')
  if (firstBrace > 0) {
    cleaned = cleaned.substring(firstBrace)
  }
  
  // Remover cualquier texto después del último }
  const lastBrace = cleaned.lastIndexOf('}')
  if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.substring(0, lastBrace + 1)
  }
  
  // Verificar si el JSON está incompleto y intentar repararlo
  if (!cleaned.endsWith('}')) {
    console.log('JSON appears incomplete, attempting to repair...')
    
    // Contar llaves abiertas y cerradas
    const openBraces = (cleaned.match(/{/g) || []).length
    const closeBraces = (cleaned.match(/}/g) || []).length
    
    // Añadir llaves cerradas faltantes
    const missingBraces = openBraces - closeBraces
    if (missingBraces > 0) {
      cleaned += '}'.repeat(missingBraces)
    }
    
    // Si hay comillas sin cerrar, intentar cerrarlas
    const quotes = (cleaned.match(/"/g) || []).length
    if (quotes % 2 !== 0) {
      cleaned += '"'
    }
  }
  
  console.log('Cleaned response:', cleaned)
  return cleaned.trim()
}

async function callAI(supabaseClient: any, aiModel: any, prompt: string): Promise<string> {
  let provider;
  
  // Si el modelo ya incluye el proveedor (join), usarlo directamente
  if (aiModel.ai_providers) {
    provider = aiModel.ai_providers;
    console.log('Using embedded provider:', provider.name);
  } else if (aiModel.provider_id && aiModel.provider_id !== 'null' && aiModel.provider_id !== null) {
    // Obtener el proveedor desde la base de datos solo si provider_id es válido
    const { data: providerData, error: providerError } = await supabaseClient
      .from('ai_providers')
      .select('*')
      .eq('id', aiModel.provider_id)
      .single()

    if (providerError || !providerData) {
      throw new Error(`Error obteniendo proveedor: ${providerError?.message || 'Proveedor no encontrado'}`)
    }
    provider = providerData;
  } else {
    throw new Error(`Modelo de IA sin proveedor válido. Model ID: ${aiModel.id}, Provider ID: ${aiModel.provider_id}`)
  }
  
  console.log('Using provider:', provider.name)
  
  if (provider.name.toLowerCase().includes('openai')) {
    return await callOpenAI(aiModel, prompt, provider.api_key)
  } else if (provider.name.toLowerCase().includes('anthropic')) {
    return await callAnthropic(aiModel, prompt, provider.api_key)
  } else if (provider.name.toLowerCase().includes('gemini')) {
    return await callGemini(aiModel, prompt, provider.api_key)
  } else {
    throw new Error(`Proveedor de IA no soportado: ${provider.name}`)
  }
}

async function callOpenAI(aiModel: any, prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: aiModel.name,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    throw new Error(`Error OpenAI: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

async function callAnthropic(aiModel: any, prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: aiModel.name,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Error Anthropic: ${response.status}`)
  }

  const data = await response.json()
  return data.content[0].text
}

async function callGemini(aiModel: any, prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel.name}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Error Gemini: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}
