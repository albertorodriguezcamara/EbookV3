import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface BatchWritePayload {
  job_id: string;
  book_id: string;
  chapter_ids: string[];
  ai_config: {
    writer_model_id: string;
    editor_model_id: string;
    image_generator_model_id?: string;
  };
  book_config: {
    title: string;
    author: string;
    idea: string;
    category: string;
    subcategory?: string;
    language: string;
  };
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let payload: BatchWritePayload | null = null;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    payload = await req.json();
    
    // Validar payload
    if (!payload || !payload.job_id || !payload.book_id || !payload.chapter_ids || payload.chapter_ids.length === 0) {
      throw new Error('Invalid payload: job_id, book_id, and chapter_ids are required.');
    }

    if (!payload.ai_config?.writer_model_id) {
      throw new Error('Invalid payload: writer_model_id is required in ai_config.');
    }

    console.log(`🚀 Iniciando reescritura por lotes para ${payload.chapter_ids.length} capítulos del libro ${payload.book_id}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Actualizar job a processing
    await supabaseClient
      .from('jobs')
      .update({
        status: 'processing',
        status_message: `Iniciando reescritura de ${payload.chapter_ids.length} capítulos seleccionados...`,
        progress_percentage: 5
      })
      .eq('id', payload.job_id);

    // Log de inicio
    await supabaseClient.from('creation_logs').insert({
      book_id: payload.book_id,
      message: `🔄 Iniciando reescritura de ${payload.chapter_ids.length} capítulos seleccionados por el usuario`
    });

    // Llamar a la función de Google Cloud Functions para procesamiento por lotes
    const GCLOUD_FUNCTION_URL = 'https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content';
    
    console.log(`📡 Llamando a Google Cloud Functions: ${GCLOUD_FUNCTION_URL}`);

    const gcloudPayload = {
      mode: 'batch',
      job_id: payload.job_id,
      book_id: payload.book_id,
      chapter_ids: payload.chapter_ids,
      ai_config: payload.ai_config,
      book_config: payload.book_config,
      manual_trigger: true, // Indicar que es una reescritura manual
      supabase_auth_token: req.headers.get('Authorization') // Pasar el token de autenticación
    };

    const response = await fetch(GCLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Removido Authorization header que causaba problemas JWT
      },
      body: JSON.stringify(gcloudPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Cloud Function error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Google Cloud Function response:', result);

    // Actualizar job con progreso inicial
    await supabaseClient
      .from('jobs')
      .update({
        status: 'processing',
        status_message: `Procesando ${payload.chapter_ids.length} capítulos en paralelo...`,
        progress_percentage: 10
      })
      .eq('id', payload.job_id);

    // Log de éxito
    await supabaseClient.from('creation_logs').insert({
      book_id: payload.book_id,
      message: `✅ Reescritura iniciada exitosamente. Los capítulos se están procesando en paralelo.`
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Reescritura de ${payload.chapter_ids.length} capítulos iniciada exitosamente`,
      job_id: payload.job_id,
      chapters_count: payload.chapter_ids.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in write-chapter-content-batch:', error.message);

    // Intentar actualizar el job a failed si tenemos payload
    try {
      if (payload?.job_id) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseClient
          .from('jobs')
          .update({
            status: 'failed',
            status_message: `Error en reescritura por lotes: ${error.message}`,
            progress_percentage: 0
          })
          .eq('id', payload.job_id);

        // Log de error
        await supabaseClient.from('creation_logs').insert({
          book_id: payload.book_id || 'unknown',
          message: `❌ Error en reescritura de capítulos: ${error.message}`
        });
      }
    } catch (updateError) {
      console.error('Error updating job status:', updateError);
    }

    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
