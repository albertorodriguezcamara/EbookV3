// supabase/functions/generate-book-cover/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callAI, callImageAI } from '../ai-service/index.ts'

interface CoverPayload {
  book_id: string;
  job_id: string; // Para seguir el progreso
}

serve(async (req) => {
  let payload: CoverPayload | null = null;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }

    payload = await req.json();
    const { book_id, job_id } = payload;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. OBTENER DATOS DEL LIBRO Y SINOPSIS DE CAPÍTULOS
    console.log(`Iniciando generación de portada para el libro: ${book_id}`);
    await supabaseClient.from('jobs').update({ status_message: 'Iniciando generación de portada...' }).eq('id', job_id);

    const { data: bookData, error: bookError } = await supabaseClient
      .from('books')
      .select('title, author, ai_config')
      .eq('id', book_id)
      .single();

    if (bookError) throw new Error(`Error al obtener datos del libro: ${bookError.message}`);

    const { data: chaptersData, error: chaptersError } = await supabaseClient
      .from('chapters')
      .select('synopsis')
      .eq('book_id', book_id)
      .order('order_number', { ascending: true });

    if (chaptersError) throw new Error(`Error al obtener sinopsis de capítulos: ${chaptersError.message}`);
    if (!chaptersData || chaptersData.length === 0) throw new Error('No se encontraron sinopsis de capítulos para generar el resumen.');

    const combinedSynopsis = chaptersData.map(c => c.synopsis).join('\n\n---\n\n');

    // 2. OBTENER CONFIGURACIÓN DE IA (PARA PROMPT Y PARA IMAGEN)
    const textModelId = bookData.ai_config?.editor_model_id; // Usamos el editor para crear el prompt
    const imageModelId = bookData.ai_config?.image_generator_model_id; // Usamos el generador de imagen para la portada

    if (!textModelId || !imageModelId) {
      throw new Error('Falta configuración de IA para `editor_model_id` o `image_generator_model_id` en el libro.');
    }

    // Obtener datos del proveedor para el modelo de TEXTO
    const { data: textModelData, error: textModelError } = await supabaseClient
      .from('ai_models')
      .select('*, ai_providers(*)')
      .eq('id', textModelId)
      .single();
    if (textModelError || !textModelData?.ai_providers) throw new Error(`No se pudo obtener la configuración del modelo de texto: ${textModelError?.message}`);

    // Obtener datos del proveedor para el modelo de IMAGEN
    const { data: imageModelData, error: imageModelError } = await supabaseClient
      .from('ai_models')
      .select('*, ai_providers(*)')
      .eq('id', imageModelId)
      .single();
    if (imageModelError || !imageModelData?.ai_providers) throw new Error(`No se pudo obtener la configuración del modelo de imagen: ${imageModelError?.message}`);

    // 3. GENERAR UN PROMPT VISUAL DETALLADO USANDO IA DE TEXTO
    await supabaseClient.from('jobs').update({ status_message: 'Creando un prompt visual para la portada...' }).eq('id', job_id);
    const promptGenerationSystemPrompt = `Eres un director de arte y diseñador de portadas de libros experto. Tu tarea es concebir una portada completa para un libro y describirla en un prompt para un modelo de IA generador de imágenes (como DALL-E 3 o Midjourney).

Tu análisis debe ser profundo:
1. **Analiza el Tema**: Lee el título, autor y el resumen de la historia para entender el género, el tono y los elementos clave.
2. **Crea una Descripción Visual**: Basado en tu análisis, especialmente en en cuenta la tematica del libro, describe una escena o concepto visualmente impactante para la ilustración de la portada. Sé específico sobre composición, colores, iluminación y ambiente. La ilustración NO debe contener ningún texto.
3. **Diseña la Tipografía**: Basado en el tema, describe cómo deberían verse el título y el autor. Indica estilo de fuente, color, textura y ubicación. ESTA ES LA PARTE MÁS IMPORTANTE.

Formato de salida obligatorio (JSON válido):
{
  "prompt_visual": "...",
  "prompt_tipografico": "..."
}`;
    const promptGenerationUserPrompt = `Genera el concepto de portada para el siguiente libro:\n\nTítulo: "${bookData.title}"\nAutor: "${bookData.author}"\n\nResumen de la historia:\n${combinedSynopsis}`;

    const promptResult = await callAI({
      config: {
        providerName: textModelData.ai_providers.name,
        apiKey: textModelData.ai_providers.api_key,
        baseUrl: textModelData.ai_providers.base_url,
        modelName: textModelData.name,
      },
      messages: [
        { role: 'system', content: promptGenerationSystemPrompt },
        { role: 'user', content: promptGenerationUserPrompt },
      ],
      // Para OpenAI solicitamos objeto JSON
      ...(textModelData.ai_providers.name.toLowerCase() === 'openai' ? { response_format: { type: 'json_object' } } : {})
    });

    if (promptResult.error || !promptResult.content) throw new Error(`Error al generar el concepto de portada: ${promptResult.error}`);

// Intentar parsear la respuesta JSON
let coverConcept: { prompt_visual: string; prompt_tipografico: string };
try {
  // El modelo a veces añade explicaciones antes o después del JSON. Buscamos el primer bloque que parezca un objeto JSON.
  const cleanedResponse = promptResult.content.replace(/```json[\s\S]*?```/g, (m) => m.replace(/```json|```/g, ''));
  const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No se encontró un objeto JSON en la respuesta.');
  }
  coverConcept = JSON.parse(jsonMatch[0]);
} catch (e) {
  throw new Error(`Error al parsear la respuesta JSON del concepto de portada: ${e.message}. Contenido recibido: ${promptResult.content}`);
}

const finalImagePrompt = `${coverConcept.prompt_visual}. La portada debe incluir el título del libro \"${bookData.title}\" y el nombre del autor \"${bookData.author}\". El estilo del texto debe seguir esta descripción: ${coverConcept.prompt_tipografico}. El texto debe ser legible y estar integrado en la composición.`;
console.log('Prompt de imagen final generado:', finalImagePrompt);

    // 4. GENERAR LA IMAGEN USANDO EL PROMPT DETALLADO
    await supabaseClient.from('jobs').update({ status_message: 'Generando la imagen de la portada...' }).eq('id', job_id);
    const imageResult = await callImageAI({
      config: {
        providerName: imageModelData.ai_providers.name,
        apiKey: imageModelData.ai_providers.api_key,
        baseUrl: imageModelData.ai_providers.base_url,
        modelName: imageModelData.provider_model_id.trim(), // e.g., 'dall-e-3', using provider_model_id and trimming whitespace
      },
      prompt: finalImagePrompt,
      size: '1024x1536', // Tamaño vertical soportado por OpenAI (1024x1536)
      quality: 'hd',
    });

    if (imageResult.error || !imageResult.imageBlob) {
      throw new Error(`Error al generar la imagen: ${imageResult.error || 'No se recibieron datos de la imagen.'}`);
    }
    console.log('Blob de imagen obtenido directamente desde el servicio de IA.');

    // 5. SUBIR EL BLOB DE LA IMAGEN A SUPABASE STORAGE
    await supabaseClient.from('jobs').update({ status_message: 'Guardando la portada de forma permanente...' }).eq('id', job_id);

    const filePath = `${book_id}/cover.png`;
    const { error: uploadError } = await supabaseClient.storage
      .from('book-covers') // <-- ¡ASEGÚRATE DE QUE ESTE BUCKET EXISTA!
      .upload(filePath, imageResult.imageBlob, { upsert: true, contentType: 'image/png' });

    if (uploadError) throw new Error(`Error al subir la imagen a Storage: ${uploadError.message}`);

    // 6. OBTENER URL PÚBLICA Y ACTUALIZAR EL LIBRO
    const { data: publicUrlData } = supabaseClient.storage
      .from('book-covers')
      .getPublicUrl(filePath);

    if (!publicUrlData.publicUrl) throw new Error('No se pudo obtener la URL pública de la imagen.');

    const { error: updateBookError } = await supabaseClient
      .from('books')
      .update({ cover_image_url: publicUrlData.publicUrl })
      .eq('id', book_id);

    if (updateBookError) throw new Error(`Error al actualizar el libro con la URL de la portada: ${updateBookError.message}`);

    await supabaseClient.from('jobs').update({ status_message: '¡Portada generada con éxito!', progress_percentage: 100 }).eq('id', job_id);
    console.log(`Portada generada y guardada con éxito para el libro ${book_id}`);

    return new Response(JSON.stringify({ success: true, coverUrl: publicUrlData.publicUrl }), { status: 200 });

  } catch (error) {
    console.error('Error fatal en generate-book-cover:', error);
    if (payload?.job_id) {
      const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      await supabaseAdmin.from('jobs').update({
        status: 'failed',
        status_message: `Error en generate-book-cover: ${error.message}`,
      }).eq('id', payload.job_id);
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
