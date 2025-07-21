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

    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .insert({
        book_id,
        user_id: user.id,
        format,
        color_scheme,
        export_options,
        editor_model_id, // Puede ser null, lo cual es correcto
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

    // Non-blocking invocation of the next step in the process
    supabase.functions.invoke('generate-book-html', { 
      body: { record: job }
    }).catch(invokeError => {
      // Log the error but don't block the response to the client
      console.error('Failed to invoke generate-book-html function:', invokeError);
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
