import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

console.log('"convert-html-to-pdf" function initialized');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let jobId: string | null = null;

  try {
    const { record: job } = await req.json();
    jobId = job.id;
    const { download_url: htmlUrl, user_id, book_id } = job;

    if (!htmlUrl) {
      throw new Error('El trabajo no tiene una URL de HTML para procesar.');
    }

    const supabase = createSupabaseClient(req);

    // 1. Actualizar estado a 'processing_pdf'
    await supabase.from('export_jobs').update({ status: 'processing_pdf', status_message: 'Convirtiendo HTML a PDF...' }).eq('id', jobId);

    // 2. Lanzar Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"], // Requerido para Deno Deploy/Edge Functions
    });
    const page = await browser.newPage();

    // 3. Ir a la URL del HTML y generar el PDF
    await page.goto(htmlUrl, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A5', // Formato estándar para libros
      printBackground: true,
      margin: {
        top: '2.5cm',
        bottom: '2.5cm',
        left: '2cm',
        right: '2cm',
      },
    });
    await browser.close();

    // 4. Guardar el PDF en Supabase Storage
    const pdfFilePath = `${user_id}/${book_id}/${jobId}.pdf`;
    const { error: storageError } = await supabase.storage
      .from('exports')
      .upload(pdfFilePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (storageError) {
      throw new Error(`Error guardando PDF en Storage: ${storageError.message}`);
    }

    // 5. Obtener la nueva URL pública y actualizar el job a 'completed'
    const { data: urlData } = supabase.storage.from('exports').getPublicUrl(pdfFilePath);

    await supabase
      .from('export_jobs')
      .update({
        status: 'completed',
        status_message: 'El archivo PDF ha sido generado con éxito.',
        download_url: urlData.publicUrl,
      })
      .eq('id', jobId);

    return new Response(JSON.stringify({ success: true, url: urlData.publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error converting HTML to PDF:', error);
    // Si algo falla, actualizamos el job a 'failed'
    if (jobId) {
        const supabase = createSupabaseClient(req);
        await supabase.from('export_jobs').update({ status: 'failed', status_message: error.message }).eq('id', jobId);
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
