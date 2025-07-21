const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const htmlToDocx = require('html-to-docx');

// TODO: Cargar estas variables de forma segura desde Secret Manager
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * HTTP Cloud Function que convierte un HTML (almacenado en Supabase) a PDF o DOCX.
 * 
 * @param {Object} req Cloud Function request context.
 * @param {Object} res Cloud Function response context.
 */
functions.http('exportDocument', async (req, res) => {
  console.log('Received request:', req.body);

  const { jobId, format } = req.body;

  if (!jobId || !format) {
    return res.status(400).send('Missing jobId or format in request body.');
  }

  if (format !== 'pdf' && format !== 'docx') {
    return res.status(400).send('Invalid format. Must be \"pdf\" or \"docx\".');
  }

  try {
    // 1. Obtener datos del job desde Supabase
    await supabase.from('export_jobs').update({ status: 'processing', status_message: `Iniciando conversión a ${format}...` }).eq('id', jobId);

    const { data: job, error: jobError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) throw new Error(`Job not found: ${jobError.message}`);
    if (!job.download_url) throw new Error('Job has no HTML URL to process.');

    // 2. Descargar el HTML
    const htmlResponse = await fetch(job.download_url);
    if (!htmlResponse.ok) throw new Error(`Failed to download HTML: ${htmlResponse.statusText}`);
    const htmlContent = await htmlResponse.text();

    let fileBuffer;
    let fileExtension;
    let mimeType;

    // 3. Convertir a PDF o DOCX
    if (format === 'pdf') {
      console.log('Converting to PDF...');
      const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      fileBuffer = await page.pdf({ format: 'A5', printBackground: true });
      await browser.close();
      fileExtension = 'pdf';
      mimeType = 'application/pdf';
    } else { // format === 'docx'
      console.log('Converting to DOCX...');
      fileBuffer = await htmlToDocx(htmlContent, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });
      fileExtension = 'docx';
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    // 4. Subir el archivo resultante
    const filePath = `${job.user_id}/${job.book_id}/${job.id}.${fileExtension}`;
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(filePath, fileBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) throw new Error(`Error uploading file: ${uploadError.message}`);

    // 5. Actualizar el job en Supabase
    const { data: urlData } = supabase.storage.from('exports').getPublicUrl(filePath);
    await supabase.from('export_jobs').update({
      status: 'completed',
      status_message: 'Archivo convertido y subido con éxito.',
      download_url: urlData.publicUrl,
    }).eq('id', jobId);

    console.log(`Job ${jobId} completed successfully.`);
    res.status(200).send({ success: true, downloadUrl: urlData.publicUrl });

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await supabase.from('export_jobs').update({
      status: 'failed',
      status_message: error.message,
    }).eq('id', jobId);
    res.status(500).send({ success: false, error: error.message });
  }
});
