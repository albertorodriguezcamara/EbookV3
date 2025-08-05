import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Usuario no autenticado')
    }

    const { book_id, image_model_id } = await req.json()

    if (!book_id) {
      throw new Error('book_id es requerido')
    }
    
    console.log(`🎨 Generación manual solicitada - Libro: ${book_id}, Modelo: ${image_model_id || 'por defecto'}`);

    // Verificar que el libro pertenece al usuario
    const { data: book, error: bookError } = await supabaseClient
      .from('books')
      .select('id, user_id, title, author, cover_image_url')
      .eq('id', book_id)
      .eq('user_id', user.id)
      .single()

    if (bookError || !book) {
      throw new Error('Libro no encontrado o no tienes permisos para acceder a él')
    }

    // Para generación manual, permitir regeneración de portada existente
    if (book.cover_image_url) {
      console.log(`🎨 Regenerando portada existente para libro: ${book.title}`);
    } else {
      console.log(`🎨 Generando nueva portada para libro: ${book.title}`);
    }

    console.log(`🎨 Iniciando generación manual de portada para libro: ${book.title}`)

    // Crear un job para trackear el progreso
    console.log('Intentando crear job con datos:', {
      book_id: book_id,
      status: 'pending',
      status_message: 'Iniciando generación de portada...',
      progress_percentage: 0,
      payload: { type: 'generate_cover_manual', book_id, user_id: user.id }
    });
    
    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .insert({
        book_id: book_id,
        status: 'pending',
        status_message: 'Iniciando generación de portada...',
        progress_percentage: 0,
        payload: { type: 'generate_cover_manual', book_id, user_id: user.id }
      })
      .select()
      .single()

    if (jobError) {
      console.error('Error detallado al crear job:', jobError);
      throw new Error(`Error al crear el job de seguimiento: ${jobError.message || JSON.stringify(jobError)}`);
    }
    
    if (!job) {
      throw new Error('No se pudo crear el job de seguimiento - respuesta vacía');
    }

    // Llamar a la función de Google Cloud
    console.log('Llamando a Google Cloud Functions con payload:', {
      book_id,
      job_id: job.id,
      manual_trigger: true,
      image_model_id: image_model_id
    });
    
    const gcpResponse = await fetch(
      'https://europe-west1-export-document-project.cloudfunctions.net/generate-book-cover',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          book_id,
          job_id: job.id,
          manual_trigger: true, // Indicar que es una llamada manual
          image_model_id: image_model_id // Modelo de imagen seleccionado por el usuario
        })
      }
    )

    console.log('Respuesta de Google Cloud Functions:', {
      status: gcpResponse.status,
      statusText: gcpResponse.statusText,
      ok: gcpResponse.ok
    });

    if (!gcpResponse.ok) {
      // Intentar obtener el cuerpo de la respuesta para más detalles del error
      let errorDetails = 'Sin detalles adicionales';
      try {
        const errorText = await gcpResponse.text();
        errorDetails = errorText;
        console.error('Detalles del error de GCP:', errorText);
      } catch (e) {
        console.error('No se pudo obtener detalles del error:', e);
      }
      
      // Actualizar job como fallido
      await supabaseClient
        .from('jobs')
        .update({
          status: 'failed',
          status_message: `Error al llamar a la función de generación de portada: ${gcpResponse.status} - ${errorDetails}`
        })
        .eq('id', job.id)

      throw new Error(`Error al generar portada: ${gcpResponse.status} - ${errorDetails}`)
    }

    // Actualizar job como en progreso
    await supabaseClient
      .from('jobs')
      .update({
        status: 'processing',
        status_message: 'Generando portada con IA...',
        progress_percentage: 25
      })
      .eq('id', job.id)

    console.log(`✅ Generación de portada iniciada exitosamente para libro: ${book.title}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Generación de portada iniciada',
        job_id: job.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Error en generate-cover-manual:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
