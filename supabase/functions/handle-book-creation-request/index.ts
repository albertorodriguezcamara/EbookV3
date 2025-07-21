import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Define the expected payload structure
interface BookCreationPayload {
  title: string;
  author?: string; // Author might be optional or derived
  idea: string;
  language: string;
  category_id: string; // uuid
  subcategory_id: string; // uuid
  target_word_count?: number;
  target_number_of_chapters?: number;
  book_attributes: Record<string, any>;
  ai_config: {
    writer_model_id: string; // uuid
    editor_model_id: string; // uuid
    image_generator_model_id?: string; // uuid, optional
  };
}

// Define a type for the book data to be inserted
console.log('`handle-book-creation-request` function booting up...');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust for production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function validatePayloadAndFetchNames(supabaseClient: SupabaseClient, payload: BookCreationPayload) {
  if (!payload.title || !payload.idea || !payload.language || !payload.category_id || !payload.subcategory_id || !payload.ai_config?.writer_model_id || !payload.ai_config?.editor_model_id) {
    throw new Error('Missing required fields');
  }

  // Basic UUID format check (can be more robust)
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(payload.category_id) || !uuidRegex.test(payload.subcategory_id) || 
      !uuidRegex.test(payload.ai_config.writer_model_id) || !uuidRegex.test(payload.ai_config.editor_model_id) || 
      (payload.ai_config.image_generator_model_id && !uuidRegex.test(payload.ai_config.image_generator_model_id))) {
    throw new Error('Invalid UUID format for one or more IDs');
  }

  // Fetch category and subcategory details
  const [categoryResult, subcategoryResult] = await Promise.all([
    supabaseClient.from('categories').select('id, name, display_name, parent_id').eq('id', payload.category_id).single(),
    supabaseClient.from('categories').select('id, name, display_name, parent_id').eq('id', payload.subcategory_id).single(),
  ]);

  if (categoryResult.error || !categoryResult.data) {
    console.error('Error fetching category:', categoryResult.error);
    throw new Error('Invalid category ID or database error.');
  }
  if (subcategoryResult.error || !subcategoryResult.data) {
    console.error('Error fetching subcategory:', subcategoryResult.error);
    throw new Error('Invalid subcategory ID or database error.');
  }

  if (subcategoryResult.data.parent_id !== categoryResult.data.id) {
    throw new Error('Subcategory does not belong to the specified category.');
  }
  
  // Validate AI models (simplified: checking existence)
  const modelIdsToValidate = [payload.ai_config.writer_model_id, payload.ai_config.editor_model_id];
  if (payload.ai_config.image_generator_model_id) {
      modelIdsToValidate.push(payload.ai_config.image_generator_model_id);
  }

  const { data: modelsData, error: modelsError } = await supabaseClient
      .from('ai_models')
      .select('id')
      .in('id', modelIdsToValidate);

  if (modelsError) {
      console.error('Error fetching AI models:', modelsError);
      throw new Error('Database error while validating AI models.');
  }
  if (modelsData.length !== modelIdsToValidate.length) {
      throw new Error('One or more AI model IDs are invalid.');
  }

  console.log('Payload validation successful.');
  return { 
    categoryName: categoryResult.data.name || categoryResult.data.display_name,
    subcategoryName: subcategoryResult.data.name || subcategoryResult.data.display_name
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role for backend operations
    //   { global: { headers: { Authorization: req.headers.get('Authorization')! } } } // If using user's JWT
    );
    
    // If you intend to use user's JWT for RLS, uncomment the above and ensure user is authenticated
    const authHeader = req.headers.get('Authorization');
    let userId: string;
    if (authHeader) {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) {
            console.error('User retrieval error:', userError);
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        userId = user.id;
        console.log('User authenticated:', userId);
    } else {
        // This case should ideally not happen if requests are always authenticated
        console.error('Missing Authorization header');
        return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const payload: BookCreationPayload = await req.json();
    console.log('Received payload:', payload);

    // Perform validation. If it passes, proceed to create the request.
    // The names categoryName and subcategoryName are not directly used here anymore for insertion,
    // but the validation itself is crucial.
    await validatePayloadAndFetchNames(supabaseClient, payload);
    console.log('Payload validated, proceeding to create request entry.');

    const requestDataToInsert = {
      user_id: userId,
      payload: payload, // Store the full original payload
      status: 'pending',
    };
    console.log('Data prepared for book_creation_requests insertion:', requestDataToInsert);

    const { data: newCreationRequest, error: insertRequestError } = await supabaseClient
      .from('book_creation_requests')
      .insert(requestDataToInsert)
      .select('id') // Select the ID of the new request
      .single();

    if (insertRequestError || !newCreationRequest) {
      console.error('Error inserting book creation request:', insertRequestError);
      return new Response(JSON.stringify({ error: 'Failed to create book creation request', details: insertRequestError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`Book creation request created successfully: ${newCreationRequest.id}`);

    console.log(`Invoking 'initiate-book-creation' for request_id: ${newCreationRequest.id}`);
    const { data: orchestratorData, error: orchestratorError } = await supabaseClient.functions.invoke(
      'initiate-book-creation',
      { body: { request_id: newCreationRequest.id } } // Pass request_id instead of book_id
    );

    if (orchestratorError) {
      console.error('Error invoking orchestrator function:', orchestratorError);
      // Update the status of the request in 'book_creation_requests' to 'failed'
      await supabaseClient
        .from('book_creation_requests')
        .update({ status: 'initiation_failed', error_message: orchestratorError.message || orchestratorError })
        .eq('id', newCreationRequest.id);
        
      return new Response(JSON.stringify({ 
        message: 'Book creation request submitted, but orchestrator invocation failed.', 
        request_id: newCreationRequest.id,
        orchestratorError: orchestratorError.message || orchestratorError
      }), {
        status: 202, // Accepted, but with a warning about orchestration
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Orchestrator function invoked successfully, response:', orchestratorData);

    return new Response(JSON.stringify({ message: 'Book creation request submitted successfully and process initiated.', request_id: newCreationRequest.id }), {
      status: 201, // Created (the request, not the final book yet)
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unhandled error in handle-book-creation-request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    const errorStatus = (error.message === 'Missing required fields' || error.message.includes('Invalid') || error.message.includes('Subcategory does not belong')) ? 400 : 500;
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: errorStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
