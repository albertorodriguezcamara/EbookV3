// supabase/functions/_shared/ai-service.ts

interface AIProviderConfig {
  providerName: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  config: AIProviderConfig;
  messages: AIMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: "json_object" }; // For OpenAI JSON mode
}

interface AIResponse {
  content: string | null;
  error?: string;
  rawResponse?: any; 
}

// Interfaz para la generación de imágenes
export interface ImageAIRequest {
  config: AIProviderConfig;
  prompt: string;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural'; // Para DALL-E 3
}

// Interfaz para la respuesta de generación de imágenes
export interface ImageAIResponse {
  imageBlob: Blob | null; // Devolvemos directamente el Blob con los datos de la imagen
  error?: string;
  rawResponse?: any;
}

// Función para llamar a la API de generación de imágenes
export async function callImageAI(request: ImageAIRequest): Promise<ImageAIResponse> {
  const { config, prompt, n = 1, size = '1024x1024', quality = 'standard', style = 'vivid' } = request;

  if (config.providerName.toLowerCase() !== 'openai') {
    return { imageBlob: null, error: `Image generation is only supported for OpenAI, but got ${config.providerName}` };
  }

  const apiUrl = new URL('/v1/images/generations', config.baseUrl);
  const headers = {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };

  const body: any = {
    model: config.modelName,
    prompt: prompt,
    n: n,
    size: size,
  };

  // Añadir parámetros específicos del modelo según la documentación
  if (config.modelName === 'dall-e-3') {
    body.quality = quality;
    body.style = style;
    body.response_format = 'url'; // DALL-E 3 puede devolver URL
  } else {
    // Otros modelos como dall-e-2 o gpt-image-1 pueden tener otros defaults
    // Dejamos que la API use su default si no especificamos response_format
  }

  try {
    console.log(`Calling OpenAI Image API with model ${config.modelName}`);
    const apiResponse = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    const jsonResponse = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error('Error from OpenAI Image API:', jsonResponse);
      const errorMessage = jsonResponse.error?.message || `API responded with status ${apiResponse.status}`;
      return { imageBlob: null, error: errorMessage, rawResponse: jsonResponse };
    }

    const firstImageData = jsonResponse.data?.[0];
    if (!firstImageData) {
      return { imageBlob: null, error: 'OpenAI image response did not contain image data.', rawResponse: jsonResponse };
    }

    // Unificar la respuesta: siempre devolver un Blob
    let imageBlob: Blob | null = null;

    if (firstImageData.url) {
      console.log('Image URL received, downloading...');
      const imageFetch = await fetch(firstImageData.url);
      if (!imageFetch.ok) {
        throw new Error(`Failed to download image from temporary URL: ${imageFetch.statusText}`);
      }
      imageBlob = await imageFetch.blob();
    } else if (firstImageData.b64_json) {
      console.log('Base64 image data received, decoding...');
      const fetchRes = await fetch(`data:image/png;base64,${firstImageData.b64_json}`);
      imageBlob = await fetchRes.blob();
    }

    if (!imageBlob) {
      return { imageBlob: null, error: 'Could not extract image data from API response.', rawResponse: jsonResponse };
    }

    return { imageBlob: imageBlob, rawResponse: jsonResponse };

  } catch (e) {
    console.error('Failed to call or process OpenAI Image API response:', e);
    return { imageBlob: null, error: e.message };
  }
}

export async function callAI(request: AIRequest): Promise<AIResponse> {
  const { config, messages, max_tokens, temperature, response_format } = request;

  if (!config.modelName) {
    const errorMsg = "AI model ID is missing (modelName is null or empty). Please ensure the selected model in the database has a 'provider_model_id' set.";
    console.error(`Error in callAI: ${errorMsg}`);
    return {
      content: null,
      error: errorMsg,
    };
  }

  if (config.providerName.toLowerCase() === 'openai') {
    const apiUrl = new URL('/v1/chat/completions', config.baseUrl);
    const headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };

    const body: any = {
      model: config.modelName,
      messages: messages,
    };

    if (max_tokens) body.max_tokens = max_tokens;
    if (temperature !== undefined) body.temperature = temperature;
    if (response_format) body.response_format = response_format;

    try {
      console.log(`Calling OpenAI API: ${apiUrl.toString()} with model ${config.modelName}`);
      const apiResponse = await fetch(apiUrl.toString(), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });

      const jsonResponse = await apiResponse.json();

      if (!apiResponse.ok) {
        console.error('Error from OpenAI API:', jsonResponse);
        const errorMessage = jsonResponse.error?.message || `API responded with status ${apiResponse.status}`;
        return { content: null, error: errorMessage, rawResponse: jsonResponse };
      }

      const aiContent = jsonResponse.choices?.[0]?.message?.content;
      if (!aiContent) {
        return { content: null, error: 'OpenAI response did not contain valid content.', rawResponse: jsonResponse };
      }
      return { content: aiContent, rawResponse: jsonResponse };

    } catch (e) {
      console.error('Failed to call OpenAI API:', e);
      return { content: null, error: e.message };
    }
  } else if (config.providerName.toLowerCase() === 'gemini') {
    const geminiApiUrl = `${config.baseUrl}/v1beta/models/${config.modelName}:generateContent?key=${config.apiKey}`;
    
    let geminiContents: any[] = [];
    let currentRoleInternal = ''; // 'user' or 'model' for Gemini
    let currentParts: any[] = [];

    for (const msg of messages) {
        let targetRole = '';
        if (msg.role === 'system') {
            // Prepend system message to the next user message or treat as user if it's the first message.
            // Gemini doesn't have a dedicated 'system' role in the same way as OpenAI for chat history.
            // It can be part of the first user message or a separate `system_instruction` field (model dependent).
            // For simplicity here, we'll merge it into a user message part.
            targetRole = 'user'; 
        } else if (msg.role === 'user') {
            targetRole = 'user';
        } else if (msg.role === 'assistant') {
            targetRole = 'model';
        }

        if (currentRoleInternal === '' || currentRoleInternal === targetRole) {
            currentParts.push({ text: msg.content });
        } else {
            // Role changed, push previous content block
            if (currentParts.length > 0) {
                geminiContents.push({ role: currentRoleInternal, parts: currentParts });
            }
            currentParts = [{ text: msg.content }];
        }
        currentRoleInternal = targetRole;
    }
    // Push any remaining parts
    if (currentParts.length > 0) {
        geminiContents.push({ role: currentRoleInternal, parts: currentParts });
    }
    
    const generationConfig: any = {};
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (max_tokens) generationConfig.maxOutputTokens = max_tokens; 
    if (response_format?.type === "json_object") {
        generationConfig.responseMimeType = "application/json";
    }

    const geminiBody = {
      contents: geminiContents,
      ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
    };

    try {
      console.log(`Calling Gemini API: ${geminiApiUrl} with model ${config.modelName}`);
      // console.log('Gemini request body:', JSON.stringify(geminiBody, null, 2)); // Uncomment for debugging

      const apiResponse = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiBody),
      });

      const jsonResponse = await apiResponse.json();

      if (!apiResponse.ok) {
        console.error('Error from Gemini API:', jsonResponse);
        const errorMessage = jsonResponse.error?.message || `API responded with status ${apiResponse.status}`;
        return { content: null, error: errorMessage, rawResponse: jsonResponse };
      }

      const aiContent = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiContent) {
        console.error('Gemini response did not contain valid content:', jsonResponse);
        return { content: null, error: 'Gemini response did not contain valid content.', rawResponse: jsonResponse };
      }
      return { content: aiContent, rawResponse: jsonResponse };

    } catch (e) {
      console.error('Failed to call Gemini API:', e);
      return { content: null, error: e.message };
    }

  } else {
    console.error(`Unsupported AI provider: ${config.providerName}`);
    return { content: null, error: `Unsupported AI provider: ${config.providerName}` };
  }
}
