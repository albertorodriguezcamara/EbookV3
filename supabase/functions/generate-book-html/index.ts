import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callAI } from "../ai-service/index.ts";
console.log('"generate-book-html" initialised');
// ---------- Lógica de Fallback (Plantillas) ----------
const css = (scheme)=>{
  const validScheme = [
    "color",
    "sepia",
    "bw"
  ].includes(scheme) ? scheme : "bw";
  const p = {
    color: {
      pageBg: "#f0f4f8",
      containerBg: "#ffffff",
      textColor: "#333",
      titleColor: "#1a2a4c",
      borderColor: "#e0e0e0"
    },
    sepia: {
      pageBg: "#f4f0e8",
      containerBg: "#faf5eb",
      textColor: "#5b4636",
      titleColor: "#5d493a",
      borderColor: "#dcd5c8"
    },
    bw: {
      pageBg: "#eee",
      containerBg: "#fff",
      textColor: "#000",
      titleColor: "#000",
      borderColor: "#ccc"
    }
  }[validScheme];
  return `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap');
  body{background:${p.pageBg};font-family:'Merriweather',serif;color:${p.textColor};margin:0;padding:20px;line-height:1.7}
  .page{max-width:800px;margin:20px auto;padding:60px 70px;background:${p.containerBg};border:1px solid ${p.borderColor};box-shadow:0 4px 12px rgba(0,0,0,.08);position:relative;page-break-after:always}
  .page:last-child{page-break-after:avoid}
  .page-number{position:absolute;bottom:30px;right:70px;font-style:italic;font-size:.9em}
  h1,h2,h3{font-family:'Cinzel',serif;color:${p.titleColor};text-align:center;margin-bottom:40px}
  .title-page h1{font-size:3em;margin-top:25%}.title-page .author{font-size:1.5em;margin-top:20px}
  .centered{text-align:center;padding-top:30%}.centered p{font-style:italic}
  p{text-align:justify;margin-bottom:1em;text-indent:2.5em}p:first-of-type{text-indent:0}
  .toc-table{width:100%;border-collapse:collapse;margin-top:50px}.toc-table td{padding:10px 0;border-bottom:1px dotted ${p.borderColor}}
  `;
};
const generateHtmlWithTemplates = (book, job, customCss)=>{
  console.log("Generating HTML with provided CSS.");
  const { export_options } = job;
  const simpleFormat = (txt)=>txt ? txt.split("\n").map((p)=>p.trim()).filter(Boolean).map((p)=>`<p>${p}</p>`).join("") : "";
  const titlePage = (t, a)=>`<div class="page title-page"><h1>${t}</h1><p class="author">${a}</p></div>`;
  const copyrightPage = (a, isbn)=>`<div class="page centered"><p> ${new Date().getFullYear()} ${a}</p><p>Todos los derechos reservados.</p>${isbn ? `<p>ISBN: ${isbn}</p>` : ""}</div>`;
  const dedicationPage = (d)=>`<div class="page centered"><h2>Dedicatoria</h2><p>${d}</p></div>`;
  const thanksPage = (t)=>`<div class="page centered"><h2>Agradecimientos</h2><p>${t}</p></div>`;
  const tocPage = (chs)=>`<div class="page"><h2>Contenido</h2><table class="toc-table">${chs.map((c, i)=>`<tr><td class="toc-title">${i + 1}. ${c.title}</td><td class="toc-page-num"></td></tr>`).join("")}</table></div>`;
  const chapterPg = (t, c, n)=>`<div class="page"><span class="page-number">${n}</span><h2>${t}</h2>${c}</div>`;
  let html = `<!DOCTYPE html><html lang="${book.language || "es"}"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${book.title}</title>
    <style>${customCss}</style>
  </head><body>`;
  html += titlePage(book.title, book.author);
  html += copyrightPage(book.author, export_options?.isbn);
  if (export_options?.dedication) html += dedicationPage(export_options.dedication);
  if (export_options?.acknowledgements) html += thanksPage(export_options.acknowledgements);
  html += tocPage(book.chapters);
  let page = 1;
  for (const ch of book.chapters){
    html += chapterPg(ch.title, simpleFormat(ch.content), page++);
  }
  html += "</body></html>";
  return html;
};
// ---------- Handler Principal ----------
serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  let job: any = null;
  try {
    job = (await req.json()).record;
    if (!job) {
      throw new Error('No job payload received');
    }
    console.log('Job received:', JSON.stringify(job));
    const { book_id } = job;
    const { data: book, error: bErr } = await supabase.from("books").select("title,author,language,category,subcategory,ai_config,chapters(title,content,order_number)").eq("id", book_id).single();
    if (bErr) throw new Error(`Book not found: ${bErr.message}`);
    console.log('Book fetched:', book?.title, 'Chapters:', book?.chapters?.length);
    let html;
    let finalCss;
    let editorModel = null;
    const modelIdToUse = job.editor_model_id || book.ai_config?.editor_model_id;
    if (modelIdToUse) {
      const { data, error } = await supabase.from('ai_models').select('name, ai_providers(*)').eq('id', modelIdToUse).single();
      if (error) {
        console.warn(`Could not fetch editor model (ID: ${modelIdToUse}). Error:`, error.message);
      } else {
        editorModel = data;
      }
    }
    if (editorModel && editorModel.ai_providers) {
      console.log(`Generating CSS with AI model: ${editorModel.name}`);
      await supabase.from("export_jobs").update({
        status: "generating_css",
        status_message: "La IA está diseñando el estilo..."
      }).eq("id", job.id);
      const systemPrompt = `
        You are a web designer. Generate a block of CSS code for a book based on its theme.
        The CSS should style the classes: 'body', 'page', 'page-number', 'h1', 'h2', 'h3', 'p', 'title-page', 'author', 'centered', 'toc-table', 'toc-table td'.
        Use professional and elegant fonts, like 'Cinzel' for titles and 'Merriweather' for text.
        You may add an optional decorative border or frame around the '.page' container if it enhances the overall aesthetic.
        Do NOT include the <style> tags, only the raw CSS code.
      `;
      const userPrompt = `
        Generate the CSS for a book with the following properties:
        - Category: ${book.category}
        - Subcategory: ${book.subcategory}
        - Desired color scheme: ${job.color_scheme}

        Please provide only the raw CSS code.
      `;
      const aiRequest = {
        config: {
          providerName: editorModel.ai_providers.name,
          apiKey: editorModel.ai_providers.api_key,
          baseUrl: editorModel.ai_providers.base_url,
          modelName: editorModel.name
        },
        messages: [
          {
            role: "system" as const,
            content: systemPrompt
          },
          {
            role: "user" as const,
            content: userPrompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      };
      const aiResponse = await callAI(aiRequest);
      if (aiResponse.content) {
        console.log("Successfully generated CSS with AI.");
        finalCss = aiResponse.content;
      } else {
        console.warn("AI failed to generate CSS, falling back to template. Reason:", aiResponse.error);
        finalCss = css(job.color_scheme);
      }
    } else {
      console.log("No AI model configured, using template CSS.");
      finalCss = css(job.color_scheme);
    }
    html = generateHtmlWithTemplates(book, job, finalCss);

    // Convertir la cadena HTML a Blob para una subida más robusta
    const htmlBlob = new Blob([html], { type: "text/html;charset=UTF-8" });

    // Guardar en Storage
    const path = `${job.user_id}/${book_id}/${job.id}.html`;
    console.log('Uploading HTML to storage:', path, 'Blob size:', htmlBlob.size);
    const { error: upErr, data: uploadData } = await supabase.storage.from("exports").upload(
      path,
      htmlBlob,
      {
        contentType: "text/html;charset=UTF-8",
        upsert: true,
      },
    );
    console.log('Upload data:', uploadData);
    if (upErr) throw new Error(`Storage error: ${upErr.message}`);
    const { data: urlData, error: urlErr } = supabase.storage.from("exports").getPublicUrl(path);
    console.log('Public URL data:', urlData);
    if (urlErr) throw new Error(`Error fetching public URL: ${urlErr.message}`);
    // 1. Actualizar el job a "html_generated" con la URL pública
    const { error: updateError } = await supabase.from("export_jobs").update({
      status: 'generating_pdf',
      status_message: 'HTML generated, starting PDF conversion.',
      html_url: urlData.publicUrl,
    }).eq('id', job.id);

    if (updateError) {
      console.error('Error updating job with HTML URL:', updateError);
    } else {
      console.log('Successfully updated job with HTML URL. Now invoking GCloud function.');
      // Asynchronously invoke the Google Cloud Function ONLY after successful DB update
      const gcloudFunctionUrl = Deno.env.get('GCLOUD_EXPORT_FUNCTION_URL');
      if (gcloudFunctionUrl) {
        console.log(`Invoking Google Cloud Function at ${gcloudFunctionUrl} for job ${job.id}`);
        // Fire-and-forget
        fetch(gcloudFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId: job.id,
            format: 'pdf', // Or determine format from job payload
          }),
        }).catch(console.error); // Log any error during the fetch call itself
      }
    }

    console.log(`Updated export job: ${job.id}`);

    return new Response(JSON.stringify({ success: true, jobId: job.id }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    console.error("generate-book-html error:", e);
    if (job) {
      await supabase.from("export_jobs").update({
        status: "failed",
        status_message: String(e)
      }).eq("id", job.id);
    }
    return new Response(JSON.stringify({
      error: String(e)
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
