const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Cargar variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLOUDMERSIVE_API_KEY = process.env.CLOUDMERSIVE_API_KEY; // ¡NUEVO!

// Inicializar cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Registra un mensaje de log y actualiza el estado del job en Supabase.
 * @param {string} jobId - El ID del job.
 * @param {string} message - El mensaje a registrar.
 * @param {'processing' | 'failed' | 'completed'} [status] - El nuevo estado del job.
 */
async function updateJobStatus(jobId, message, status = 'processing') {
  console.log(`[${jobId}] ${message}`);
  try {
    await supabase.from('export_jobs').update({ status, status_message: message }).eq('id', jobId);
  } catch (error) {
    console.error(`[${jobId}] Failed to update job status in Supabase:`, error.message);
  }
}

/**
 * Genera un documento DOCX usando la nueva Edge Function generate-book-docx.
 * Esta función reemplaza el flujo anterior de HTML → PDF → DOCX por un pipeline
 * LLM + docxtemplater que genera DOCX directamente desde los datos del libro.
 * @param {string} jobId - El ID del job para logging.
 * @returns {Promise<string>} - Una promesa que se resuelve con la ruta del archivo DOCX generado.
 */
async function generateDocxWithEdgeFunction(jobId) {
  console.log(`[${jobId}] Iniciando generación DOCX con Edge Function...`);
  
  await updateJobStatus(jobId, 'Iniciando generación DOCX con IA + docxtemplater...');
  
  try {
    // Obtener datos del job desde Supabase
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      throw new Error(`Error obteniendo job: ${jobError?.message || 'Job no encontrado'}`);
    }
    
    console.log(`[${jobId}] Job obtenido: book_id=${job.book_id}, editor_model_id=${job.editor_model_id}`);
    
    // Llamar a la Edge Function generate-book-docx
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/generate-book-docx`;
    
    const response = await axios.post(
      edgeFunctionUrl,
      { record: job }, // Enviar el job completo como payload
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        timeout: 300000, // 5 minutos timeout
      }
    );
    
    if (!response.data.success) {
      throw new Error(`Edge Function error: ${response.data.error || 'Unknown error'}`);
    }
    
    console.log(`[${jobId}] ✅ Edge Function completada exitosamente`);
    console.log(`[${jobId}] Resultado:`, response.data.message);
    
    // La Edge Function ya actualiza el job status, pero verificamos el resultado
    const { data: updatedJob } = await supabase
      .from('export_jobs')
      .select('docx_file_path, status')
      .eq('id', jobId)
      .single();
    
    if (updatedJob?.status === 'completed' && updatedJob?.docx_file_path) {
      console.log(`[${jobId}] DOCX generado en: ${updatedJob.docx_file_path}`);
      return updatedJob.docx_file_path;
    } else {
      throw new Error('Edge Function no completó correctamente la generación');
    }
    
  } catch (error) {
    console.error(`[${jobId}] ❌ Error en Edge Function:`, error.message);
    
    // Actualizar job como fallido
    await updateJobStatus(jobId, `Error en generación DOCX: ${error.message}`, 'failed');
    
    throw new Error(`DOCX generation error: ${error.message}`);
  }
}

/**
 * HTTP Cloud Function que gestiona la generación de documentos DOCX.
 * Utiliza el nuevo pipeline LLM + docxtemplater a través de la Edge Function generate-book-docx.
 */
functions.http('export-document', async (req, res) => {
  const { jobId, format } = req.body;

  if (!jobId || !format) {
    return res.status(400).send('Falta `jobId` o `format` en el cuerpo de la petición.');
  }

  if (format !== 'docx') {
    return res.status(400).send('Formato no válido. Actualmente solo se soporta "docx".');
  }

  try {
    // 1. Obtener datos del job desde Supabase
    await updateJobStatus(jobId, 'Job recibido. Obteniendo datos desde Supabase...');
    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job no encontrado o error al obtenerlo: ${jobError?.message || 'not found'}`);
    }

    // 2. Generar DOCX usando la nueva Edge Function (LLM + docxtemplater)
    // Este nuevo pipeline reemplaza completamente el flujo HTML → PDF → DOCX
    // por un sistema que genera DOCX directamente desde los datos del libro
    const docxFilePath = await generateDocxWithEdgeFunction(jobId);
    
    // 3. Obtener URL pública del archivo generado
    await updateJobStatus(jobId, 'Obteniendo URL pública del archivo...');
    const { data: urlData } = supabase.storage.from('exports').getPublicUrl(docxFilePath);
    
    // 4. Actualizar el job con la URL de descarga
    await supabase.from('export_jobs').update({
      download_url: urlData.publicUrl,
    }).eq('id', jobId);

    console.log(`[${jobId}] ✅ Job completado con éxito.`);
    res.status(200).send({ success: true, downloadUrl: urlData.publicUrl });

  } catch (error) {
    console.error(`[${jobId}] ❌ Error procesando el job:`, error.message);
    // Asegurarse de que el estado del job se actualice a 'failed' en caso de error
    await updateJobStatus(jobId, `Error: ${error.message}`, 'failed');
    res.status(500).send({ success: false, error: error.message });
  }
});
