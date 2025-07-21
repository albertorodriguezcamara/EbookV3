# Cómo Añadir un Nuevo Proveedor de IA

Este documento explica el proceso para integrar un nuevo proveedor de IA (por ejemplo, Anthropic, Google Gemini, etc.) en el sistema. La integración se realiza en dos áreas principales: la base de datos y el código del `ai-service`.

## Paso 1: Actualizar la Base de Datos

El sistema obtiene la lista de proveedores y modelos de IA directamente de la base de datos. Por lo tanto, el primer paso es registrar el nuevo proveedor y sus modelos.

### 1.1. Añadir el Proveedor

Inserta una nueva fila en la tabla `public.ai_providers`.

- **`name`**: Un identificador único en minúsculas para el proveedor (ej. `anthropic`, `google`). Este nombre se usará en el código para identificar al proveedor.
- **`display_name`**: El nombre legible para mostrar en la interfaz de usuario (ej. `Anthropic`, `Google`).

**Ejemplo SQL:**
```sql
INSERT INTO public.ai_providers (name, display_name) VALUES ('google', 'Google');
```

### 1.2. Añadir los Modelos

Por cada modelo que quieras ofrecer del nuevo proveedor, inserta una nueva fila en la tabla `public.ai_models`.

- **`provider_id`**: El `id` de la fila que acabas de crear en `ai_providers`.
- **`name`**: El identificador de la API del modelo (ej. `claude-3-opus-20240229`, `gemini-1.5-pro-latest`).
- **`display_name`**: El nombre legible para la interfaz (ej. `Claude 3 Opus`, `Gemini 1.5 Pro`).
- **`description`**: Una breve descripción de sus capacidades.
- **`family`**: La familia a la que pertenece (ej. `Claude 3`, `Gemini`).
- **`capabilities`**: Un array de `tags` que describen lo que el modelo puede hacer. Los valores actuales son:
  - `writer`: Para generar texto (capítulos, sinopsis).
  - `editor`: Para revisar y mejorar texto.
  - `portada`: Para generar imágenes de portada.
  - `image`: Para generar imágenes de capítulos.
- **`input_price_per_million_tokens`**: Coste en USD por cada millón de tokens de entrada.
- **`output_price_per_million_tokens`**: Coste en USD por cada millón de tokens de salida.
- **`is_active`**: `true` si el modelo está disponible para ser seleccionado.

**Ejemplo SQL:**
```sql
INSERT INTO public.ai_models (provider_id, name, display_name, family, capabilities, ...)
VALUES ((SELECT id FROM ai_providers WHERE name = 'google'), 'gemini-1.5-pro-latest', 'Gemini 1.5 Pro', 'Gemini', '{\"writer\", \"editor\"}', ...);
```

## Paso 2: Extender el `ai-service`

El fichero `supabase/functions/_shared/ai-service.ts` contiene la lógica para comunicarse con las diferentes APIs de IA. Deberás modificarlo para incluir el nuevo proveedor.

### 2.1. Añadir un nuevo `case` en `generateText`

Dentro de la función `generateText` (o `generateImage` si es un modelo de imagen), añade un nuevo `case` al `switch (providerName)` que se corresponda con el `name` que diste de alta en la tabla `ai_providers`.

Dentro de este `case`, implementa la lógica específica para:

1.  **Construir el `payload`**: Adapta el formato de los mensajes (`messages`) y los parámetros (`temperature`, `max_tokens`, etc.) al formato que espera la API del nuevo proveedor.
2.  **Realizar la llamada a la API**: Usa `fetch` para enviar la petición al `endpoint` correcto, incluyendo las cabeceras de autenticación (`Authorization: Bearer $API_KEY`). La API Key debe estar almacenada de forma segura como un Secret en Supabase.
3.  **Procesar la respuesta**: Extrae el contenido generado de la respuesta de la API y devuélvelo en el formato unificado que espera el resto del sistema (generalmente, un `string` con el texto).
4.  **Manejar errores**: Captura cualquier error de la API y lanza una excepción con un mensaje descriptivo.

**Ejemplo de esqueleto:**

```typescript
// Dentro de supabase/functions/_shared/ai-service.ts

// ...

export async function generateText(providerName: string, model: string, messages: any[], options: GenerationOptions = {}) {
  // ...
  switch (providerName) {
    case 'openai':
      // ... lógica existente
      break;

    case 'google': // Nuevo proveedor
      // 1. Obtener la API Key de los secrets
      const apiKey = Deno.env.get('GOOGLE_API_KEY');
      if (!apiKey) throw new Error('Google API key is not set.');

      // 2. Transformar los mensajes al formato de Gemini
      const geminiPayload = {
        contents: messages.map(msg => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] })),
        // ... otros parámetros
      };

      // 3. Realizar la llamada a la API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Google API error: ${errorBody.error.message}`);
      }

      // 4. Extraer y devolver el contenido
      const data = await response.json();
      return data.candidates[0].content.parts[0].text;

    default:
      throw new Error(`Unsupported AI provider: ${providerName}`);
  }
}
```

Una vez completados estos dos pasos, el nuevo proveedor y sus modelos estarán disponibles en el wizard de creación de libros y funcionarán a través del servicio centralizado de IA.
