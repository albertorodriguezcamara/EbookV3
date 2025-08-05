import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createSupabaseClient } from '../_shared/supabase-client.ts';

console.log('"handle-export-request" function initialized');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createSupabaseClient(req);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The rest of the logic is for POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      book_id, 
      format, 
      color_scheme, 
      export_options, 
      editor_model_id 
    } = await req.json();

    if (!book_id || !format || !color_scheme) {
      return new Response(JSON.stringify({ error: 'Missing required fields: book_id, format, and color_scheme are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extraer campos KDP de export_options
    const kdpFormatSize = export_options?.kdp_format_size || null;
    const kdpFormatType = export_options?.kdp_format_type || null;
    const kdpInkType = export_options?.kdp_ink_type || null;
    const kdpPaperType = export_options?.kdp_paper_type || null;

    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .insert({
        book_id,
        user_id: user.id,
        format,
        color_scheme,
        export_options,
        editor_model_id, // Puede ser null, lo cual es correcto
        kdp_format_size: kdpFormatSize,
        kdp_format_type: kdpFormatType,
        kdp_ink_type: kdpInkType,
        kdp_paper_type: kdpPaperType,
        status: 'pending',
        status_message: 'Job created and awaiting processing.',
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating export job:', jobError);
      return new Response(JSON.stringify({ error: jobError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Non-blocking invocation of the new DOCX generation pipeline
    console.log(`🚀 [${job.id}] Intentando invocar función generate-book-docx...`);
    console.log(`📋 [${job.id}] Job payload:`, {
      id: job.id,
      book_id: job.book_id,
      user_id: job.user_id,
      format: job.format,
      status: job.status
    });
    
    // Llamar a la función migrada en Google Cloud Functions
    const googleCloudUrl = 'https://europe-west1-export-document-project.cloudfunctions.net/generate-book-docx';
    
    fetch(googleCloudUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ record: job })
    }).then(async (response) => {
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ [${job.id}] Función generate-book-docx (Google Cloud) invocada exitosamente:`, result);
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    }).catch(async (invokeError) => {
      // Log the error and update job status
      console.error('Failed to invoke generate-book-docx function (Google Cloud):', invokeError);
      
      // Update job status to failed
      try {
        await supabase.from('export_jobs').update({
          status: 'failed',
          status_message: `Error invoking generate-book-docx: ${invokeError.message || 'Unknown error'}`,
          progress_percentage: 0
        }).eq('id', job.id);
        console.log(`Job ${job.id} marked as failed due to invocation error`);
      } catch (updateError) {
        console.error('Failed to update job status to failed:', updateError);
      }
    });

    return new Response(JSON.stringify({ job_id: job.id }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('An unexpected error occurred:', e);
    return new Response(JSON.stringify({ error: e.message || 'An internal server error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
