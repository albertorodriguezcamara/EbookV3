import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Payload que se espera de la función 'handle-book-creation-request'
interface InitiationPayload {
  request_id: string;
}

// Define la estructura esperada del payload almacenado en book_creation_requests.payload
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // او un origen específico
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BookCreationDataFromRequest {
  title: string;
  author?: string;
  idea: string;
  language: string;
  category_id: string; 
  subcategory_id?: string | null;
  target_word_count?: number;
  target_number_of_chapters?: number;
  book_attributes: Record<string, any>;
  ai_config: {
    writer_model_id: string;
    editor_model_id: string;
    image_generator_model_id?: string | null;
    // Configuración completa de agentConfig desde el frontend
    writer?: {
      providerId: string;
      modelId: string;
      thinkingBudget?: number;
    };
    editor?: {
      providerId: string;
      modelId: string;
      thinkingBudget?: number;
    };
    image?: {
      providerId: string;
      modelId: string;
    };
    cover?: {
      providerId: string;
      modelId: string;
    };
  };
  chapters?: any[]; // Añadido para que coincida con el uso en bookDataToInsert
} 

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Create a Supabase client with the service role key to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: InitiationPayload = await req.json();
    const { request_id } = payload;
    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log(`Received request_id: ${request_id}`);

    // 1. Fetch book creation request details from the database
    const { data: creationRequest, error: fetchRequestError } = await supabaseClient
      .from('book_creation_requests')
      .select('id, user_id, payload, status')
      .eq('id', request_id)
      .single();

    if (fetchRequestError || !creationRequest) {
      console.error('Error fetching book creation request:', fetchRequestError);
      return new Response(JSON.stringify({ error: 'Book creation request not found or error fetching details', details: fetchRequestError?.message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (creationRequest.status !== 'pending' && creationRequest.status !== 'initiation_failed') {
        // Allow reprocessing if initiation failed previously, otherwise only process 'pending'
        console.warn(`Book creation request ${request_id} has status ${creationRequest.status} and will not be processed.`);
        return new Response(JSON.stringify({ error: `Request already processed or in an invalid state: ${creationRequest.status}` }), {
            status: 409, // Conflict
            headers: { 'Content-Type': 'application/json' },
        });
    }
    console.log('Book creation request details fetched successfully:', creationRequest);

    // Update status to 'processing'
    const { error: updateStatusError } = await supabaseClient
      .from('book_creation_requests')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', request_id);

    if (updateStatusError) {
      console.error('Error updating request status to processing:', updateStatusError);
      // Proceed, but log the error. The main failure point will be book creation itself.
    }

    const bookPayload: BookCreationDataFromRequest = creationRequest.payload as BookCreationDataFromRequest;
    const userId = creationRequest.user_id;

    // 2. Validate payload and fetch names (similar to handle-book-creation-request but now inside orchestrator)
    let categoryName: string, subcategoryName: string | null = null;
    try {
      // Validate Category
      const { data: categoryData, error: categoryError } = await supabaseClient
        .from('categories')
        .select('name, display_name')
        .eq('id', bookPayload.category_id)
        .single();
      if (categoryError || !categoryData) throw new Error(`Category ID ${bookPayload.category_id} not found.`);
      categoryName = categoryData.display_name || categoryData.name;

      // Validate Subcategory if provided
      if (bookPayload.subcategory_id) {
        const { data: subcategoryData, error: subcategoryError } = await supabaseClient
          .from('categories')
          .select('name, display_name')
          .eq('id', bookPayload.subcategory_id)
          // .eq('parent_id', bookPayload.category_id) // Optional: ensure it's a child of the main category
          .single();
        if (subcategoryError || !subcategoryData) throw new Error(`Subcategory ID ${bookPayload.subcategory_id} not found.`);
        subcategoryName = subcategoryData.display_name || subcategoryData.name;
      }

      // Validate AI Models
      const modelIdsToValidate = [
        bookPayload.ai_config.writer_model_id,
        bookPayload.ai_config.editor_model_id,
      ];
      if (bookPayload.ai_config.image_generator_model_id) {
        modelIdsToValidate.push(bookPayload.ai_config.image_generator_model_id);
      }
      
      const { data: modelsData, error: modelsError } = await supabaseClient
        .from('ai_models')
        .select('id')
        .in('id', modelIdsToValidate.filter(id => id != null)); // Filter out nulls before query

      if (modelsError) throw new Error('Error validating AI models.');
      if (modelsData.length !== modelIdsToValidate.filter(id => id != null).length) {
        const foundIds = modelsData.map(m => m.id);
        const notFoundIds = modelIdsToValidate.filter(id => id != null && !foundIds.includes(id));
        throw new Error(`AI Model IDs not found: ${notFoundIds.join(', ')}`);
      }
      console.log('Categories and AI models validated successfully.');

      // >>> INICIO: Validación de book_attributes dinámicos <<<
      const { data: attributeDefinitions, error: fetchAttributesError } = await supabaseClient
        .from('subcategory_attributes')
        .select('name, display_name, type, required, options, validation_rules')
        .eq('subcategory', subcategoryName); // subcategoryName fue obtenido antes

      if (fetchAttributesError) {
        console.error('Error fetching subcategory attribute definitions:', fetchAttributesError);
        throw new Error(`Failed to fetch attribute definitions for subcategory ${subcategoryName}: ${fetchAttributesError.message}`);
      }

      if (!attributeDefinitions || attributeDefinitions.length === 0) {
        console.log(`No attribute definitions found for subcategory: ${subcategoryName}. Proceeding without specific attribute validation.`);
        // Si se requiere que book_attributes esté vacío si no hay definiciones, añadir lógica aquí.
        // if (Object.keys(bookPayload.book_attributes || {}).length > 0) {
        //   throw new Error(`book_attributes must be empty as no attributes are defined for subcategory ${subcategoryName}.`);
        // }
      } else {
        console.log(`Found ${attributeDefinitions.length} attribute definitions for ${subcategoryName}. Validating book_attributes...`);
        const receivedAttributes = bookPayload.book_attributes || {};
        const currentValidationErrors: string[] = []; // Usar un nombre diferente para evitar colisión con validationError del catch principal

        for (const def of attributeDefinitions) {
          const attributeValue = receivedAttributes[def.name];

          if (def.required && (attributeValue === undefined || attributeValue === null || attributeValue === '')) {
            currentValidationErrors.push(`Attribute '${def.display_name} (${def.name})' is required.`);
            continue;
          }

          if (!def.required && (attributeValue === undefined || attributeValue === null)) {
            continue;
          }
          
          switch (def.type) {
            case 'text':
              if (typeof attributeValue !== 'string') {
                currentValidationErrors.push(`Attribute '${def.display_name}' must be a string.`);
              } else if (def.validation_rules) {
                if (def.validation_rules.minLength !== undefined && attributeValue.length < def.validation_rules.minLength) {
                  currentValidationErrors.push(`'${def.display_name}' must be at least ${def.validation_rules.minLength} characters.`);
                }
                if (def.validation_rules.maxLength !== undefined && attributeValue.length > def.validation_rules.maxLength) {
                  currentValidationErrors.push(`'${def.display_name}' must be no more than ${def.validation_rules.maxLength} characters.`);
                }
                if (def.validation_rules.pattern) {
                  try {
                    const regex = new RegExp(def.validation_rules.pattern);
                    if (!regex.test(attributeValue)) {
                      currentValidationErrors.push(`'${def.display_name}' does not match the required pattern.`);
                    }
                  } catch (e) {
                    console.warn(`Invalid regex pattern for attribute ${def.name}: ${def.validation_rules.pattern}`);
                    currentValidationErrors.push(`Invalid validation pattern configured for '${def.display_name}'.`);
                  }
                }
              }
              break;
            case 'number':
              if (typeof attributeValue !== 'number') {
                currentValidationErrors.push(`Attribute '${def.display_name}' must be a number.`);
              } else if (def.validation_rules) {
                if (def.validation_rules.min !== undefined && attributeValue < def.validation_rules.min) {
                  currentValidationErrors.push(`'${def.display_name}' must be at least ${def.validation_rules.min}.`);
                }
                if (def.validation_rules.max !== undefined && attributeValue > def.validation_rules.max) {
                  currentValidationErrors.push(`'${def.display_name}' must be no more than ${def.validation_rules.max}.`);
                }
              }
              break;
            case 'boolean':
              if (typeof attributeValue !== 'boolean') {
                currentValidationErrors.push(`Attribute '${def.display_name}' must be a boolean (true/false).`);
              }
              break;
            case 'select':
              if (typeof attributeValue !== 'string' && typeof attributeValue !== 'number' && typeof attributeValue !== 'boolean') { 
                currentValidationErrors.push(`Attribute '${def.display_name}' has an invalid value type for select.`);
              } else if (def.options && Array.isArray(def.options)) {
                const validOptions = def.options.map((opt: any) => opt.value);
                if (!validOptions.includes(attributeValue)) {
                  currentValidationErrors.push(`'${def.display_name}' has an invalid selection. Allowed values: ${validOptions.join(', ')}.`);
                }
              }
              break;
            case 'array':
              if (!Array.isArray(attributeValue)) {
                currentValidationErrors.push(`Attribute '${def.display_name}' must be an array.`);
              } else {
                 // Implementar validación más detallada para 'array' si es necesario, usando validation_rules.array_item_type, etc.
                 // Ejemplo: Validar si todos los elementos son strings si validation_rules.itemType === 'string'
                 if (def.validation_rules && def.validation_rules.itemType === 'string') {
                   if (!attributeValue.every(item => typeof item === 'string')) {
                     currentValidationErrors.push(`All items in '${def.display_name}' must be strings.`);
                   }
                 }
                 // Añadir más validaciones de array aquí (minItems, maxItems, etc.)
                console.warn(`Validation for array type '${def.name}' is basic. Enhance if needed.`);
              }
              break;
            default:
              console.warn(`Unknown attribute type '${def.type}' for '${def.display_name}'. Consider adding validation or logging as an error.`);
              // currentValidationErrors.push(`Unknown attribute type '${def.type}' for '${def.display_name}'.`);
          }
        }

        const definedAttributeNames = attributeDefinitions.map(def => def.name);
        for (const receivedAttrName in receivedAttributes) {
          if (!definedAttributeNames.includes(receivedAttrName)) {
            console.warn(`Received unknown attribute '${receivedAttrName}' not defined for subcategory '${subcategoryName}'. This attribute will be ignored.`);
            // Si se quiere tratar como error, descomentar la siguiente línea:
            // currentValidationErrors.push(`Attribute '${receivedAttrName}' is not a valid attribute for this subcategory.`);
          }
        }
        
        if (currentValidationErrors.length > 0) {
          throw new Error(`Book attributes validation failed: ${currentValidationErrors.join('; ')}`);
        }
        console.log('Book attributes validated successfully.');
      }
      // >>> FIN: Validación de book_attributes dinámicos <<<

    } catch (validationError: any) {
      console.error('Validation failed:', validationError.message);
      await supabaseClient
        .from('book_creation_requests')
        .update({ status: 'failed', error_message: validationError.message, updated_at: new Date().toISOString() })
        .eq('id', request_id);
      return new Response(JSON.stringify({ error: 'Validation failed', details: validationError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Prepare data for book insertion
    const bookDataToInsert = {
      user_id: userId,
      title: bookPayload.title,
      author: bookPayload.author || 'Autor Desconocido',
      idea: bookPayload.idea,
      language: bookPayload.language,
      category: categoryName,
      subcategory: subcategoryName,
      book_attributes: {
        ...(bookPayload.book_attributes || {}),
        target_word_count: bookPayload.target_word_count,
        target_number_of_chapters: bookPayload.target_number_of_chapters,
      },
      ai_config: bookPayload.ai_config,
      chapters: (bookPayload.chapters && Array.isArray(bookPayload.chapters)) ? bookPayload.chapters : [],
    };

    // 5. Insert into 'books' table
    console.log('[initiate-book-creation] Attempting to insert into books. Data:', JSON.stringify(bookDataToInsert, null, 2));

    // --- INICIO: Depuración de user_id ---
    console.log(`[DEBUG] Intentando insertar libro con user_id: ${userId}`);
    console.log('[DEBUG] Datos completos a insertar:', JSON.stringify(bookDataToInsert, null, 2));
    // --- FIN: Depuración de user_id ---

    const { data: newBook, error: insertBookError } = await supabaseClient
      .from('books')
      .insert(bookDataToInsert)
      .select()
      .single();

    // --- INICIO: Depuración de user_id ---
    if (newBook) {
        console.log('[DEBUG] Libro insertado con éxito. Datos devueltos por la BD:', JSON.stringify(newBook, null, 2));
    } else {
        console.log('[DEBUG] La inserción del libro no devolvió datos.');
    }
    // --- FIN: Depuración de user_id ---

    if (insertBookError || !newBook) {
      console.error('[initiate-book-creation] Error inserting book. Raw error object:', insertBookError);
      console.error('[initiate-book-creation] Detailed insertBookError JSON:', JSON.stringify(insertBookError, null, 2));
      await supabaseClient
        .from('book_creation_requests')
        .update({ status: 'failed', error_message: `Failed to create book in books table: ${insertBookError?.message}`, updated_at: new Date().toISOString() })
        .eq('id', request_id);
      return new Response(JSON.stringify({ error: 'Failed to create book record', details: insertBookError?.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log(`Book created successfully in 'books' table: ${newBook.id} - ${newBook.title}`);

    // 6. Create a job for the book creation
    const jobPayload = {
      type: 'create_book', // CRÍTICO: Definir tipo de job para que el trigger filtre correctamente
      book_id: newBook.id,
      title: newBook.title, // Pass title to job payload
      user_id: userId,      // Pass user_id to job payload
      ai_config: bookPayload.ai_config // Pass ai_config to job payload
    };
    console.log('Creating job');

    // El job para 'generate_outline' ya no se crea aquí.
    // El trigger que maneja 'create_book' se encargará de orquestar todos los pasos subsiguientes,
    // incluida la generación del índice, para evitar la duplicación.

    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .insert({
        book_id: newBook.id,
        status: 'pending', // Initial job status should be pending
        status_message: 'Book creation initiated, job pending execution.',
        progress_percentage: 0,
        payload: jobPayload, 
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('Error creating job:', jobError);
      await supabaseClient
        .from('book_creation_requests')
        .update({ status: 'failed', error_message: `Book created, but failed to create job: ${jobError?.message}`, updated_at: new Date().toISOString() })
        .eq('id', request_id);
      // Optionally, update the book status in 'books' table to indicate a failure in job creation
      // await supabaseClient.from('books').update({ status: 'creation_failed_job' }).eq('id', newBook.id);
      return new Response(JSON.stringify({ error: 'Failed to create job', book_id: newBook.id, details: jobError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`Job created successfully: ${job.id} for book_id: ${newBook.id}`);

    // 7. Create an initial log entry
    const { error: logError } = await supabaseClient.from('creation_logs').insert({
      book_id: newBook.id,
      message: '¡Hemos recibido tu idea! Manos a la obra. El proceso de creación ha comenzado.',
    });

    if (logError) {
      console.error('Error creating initial log:', logError);
      // This is non-critical for the overall success of book and job creation,
      // but it's good to log. The request status will still be 'completed'.
    }
    console.log(`Initial log created for book_id: ${newBook.id}`);

    // 8. Update book_creation_requests status to 'completed'
    const { error: completeRequestError } = await supabaseClient
      .from('book_creation_requests')
      .update({ 
        status: 'completed', 
        error_message: null, 
        updated_at: new Date().toISOString(),
        book_id: newBook.id // Añadimos el book_id a la solicitud completada
      })
      .eq('id', request_id);

    if (completeRequestError) {
      console.error('Error updating request status to completed:', completeRequestError);
      // Log this error, but the main process was successful at this point.
      // The client will still receive a success response for book/job creation.
    }

    return new Response(JSON.stringify({ 
      message: 'Book creation process initiated and job created successfully.', 
      book_id: newBook.id, 
      job_id: job.id 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
