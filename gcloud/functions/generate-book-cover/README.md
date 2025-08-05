# Generate Book Cover - Google Cloud Function

Esta función migrada de Supabase Edge Functions a Google Cloud Functions se encarga de generar portadas profesionales para libros usando IA de imágenes y texto.

## 🎯 **Propósito**

- Genera portadas de libros profesionales usando IA
- Maneja múltiples proveedores de IA (OpenAI para imágenes y texto)
- Incluye **CONTROL DE DUPLICACIÓN** para evitar regeneración innecesaria
- Sube imágenes a Supabase Storage y actualiza la base de datos
- Actualiza progreso del job en tiempo real

## 🚨 **SOLUCIÓN A DUPLICACIÓN**

Esta función incluye control específico para **EVITAR LA DUPLICACIÓN** que ocurría en el sistema anterior:

### ✅ **Control de Estado Implementado**
```javascript
// Verificar si ya existe portada
const { data: existingBook } = await supabaseClient
  .from('books')
  .select('cover_image_url')
  .eq('id', book_id)
  .single();

if (existingBook?.cover_image_url) {
  console.log('⚠️ DUPLICACIÓN EVITADA: El libro ya tiene portada');
  // Marcar job como completado sin regenerar
  return res.status(200).json({
    success: true,
    message: 'Cover already exists - duplication avoided'
  });
}
```

### 🔄 **Flujo Corregido**
1. **Verificación inicial** → Si ya existe portada, no regenerar
2. **Generación controlada** → Solo procede si no hay portada existente
3. **Actualización atómica** → Actualiza libro y job en una sola operación
4. **Logging detallado** → Para debugging y monitoreo

## 📋 **Funcionalidades Principales**

### ✅ **Generación de Portadas Avanzada**
- Análisis inteligente del contenido del libro
- Generación de prompts contextuales usando IA de texto
- Creación de imágenes profesionales con IA
- Optimización para diferentes categorías de libros

### 🧠 **Integración Dual con IA**
- **IA de Texto**: Genera prompts detallados para la portada
- **IA de Imágenes**: Crea la imagen basada en el prompt
- Soporte para OpenAI (texto e imágenes) y Gemini (texto)
- Configuración dinámica desde la base de datos

### 📊 **Gestión de Progreso**
- Actualiza estado del job en tiempo real
- Progreso granular (10% → 30% → 60% → 80% → 100%)
- Manejo de errores y actualización a "failed" si es necesario
- Logging detallado para debugging

### 🔄 **Integración con Supabase**
- Consulta datos del libro y sinopsis de capítulos
- Sube imágenes a Supabase Storage (bucket 'book-assets')
- Actualiza tabla `books` con URL de portada
- Gestiona jobs y creation_logs

## 🔧 **Configuración**

### Variables de Entorno Requeridas
```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### Especificaciones de la Función
- **Memoria**: 4GiB (necesario para procesamiento de imágenes)
- **Timeout**: 540s (9 minutos)
- **Región**: europe-west1
- **Max Instancias**: 3

## 🚀 **Despliegue**

### Producción
```bash
deploy-production.bat
```

### Debug (con logs detallados)
```bash
deploy-debug.bat
```

### Manual
```bash
gcloud functions deploy generate-book-cover \
    --runtime=nodejs20 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point=generateBookCover \
    --memory=4GiB \
    --timeout=540s \
    --region=europe-west1 \
    --set-env-vars="SUPABASE_URL=$SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
```

## 📝 **Payload de Entrada**

```json
{
  "book_id": "uuid-del-libro",
  "job_id": "uuid-del-job"
}
```

## 📤 **Respuesta**

### Éxito (Nueva portada)
```json
{
  "success": true,
  "message": "Book cover generated successfully in Google Cloud",
  "cover_url": "https://storage-url/covers/cover_book-id_timestamp.png",
  "method": "Google Cloud"
}
```

### Éxito (Duplicación evitada)
```json
{
  "success": true,
  "message": "Cover already exists - duplication avoided",
  "cover_url": "https://existing-cover-url.png"
}
```

### Error
```json
{
  "error": "Descripción del error",
  "success": false
}
```

## 🔄 **Integración con Supabase**

La función se integra con las siguientes tablas de Supabase:

- **`books`**: Lee datos del libro y actualiza `cover_image_url`
- **`chapters`**: Obtiene sinopsis para generar contexto
- **`jobs`**: Actualiza progreso y estado del job
- **`ai_models`** + **`ai_providers`**: Configuración de modelos de IA
- **`creation_logs`**: Registra eventos y errores
- **`storage.book-assets`**: Almacena imágenes de portada

## ⚠️ **Consideraciones Importantes**

1. **Control de Duplicación**: La función verifica si ya existe portada antes de generar
2. **Memoria Alta**: 4GiB necesarios para procesamiento de imágenes
3. **Timeout Extendido**: 9 minutos suficientes para generación completa
4. **Storage**: Imágenes se suben a bucket 'book-assets' en Supabase
5. **Dependencias**: Solo requiere @supabase/supabase-js

## 🔗 **Migración desde Supabase**

Esta función reemplaza la Edge Function `generate-book-cover` de Supabase. Para completar la migración:

1. ✅ Desplegar esta función en Google Cloud
2. ⏳ Actualizar trigger `update_chapter_and_log_progress` para usar nueva URL
3. ⏳ Probar flujo completo de creación de libro
4. ⏳ Verificar que no hay duplicación de contenido

## 📊 **Ventajas de la Migración**

- ✅ **Sin timeouts**: 9 minutos vs 5 minutos de Supabase
- ✅ **Control de duplicación**: Evita regeneración innecesaria
- ✅ **Más memoria**: 4GiB vs límites de Supabase  
- ✅ **Mejor rendimiento**: CPU y recursos dedicados
- ✅ **Costos optimizados**: Pago por uso real
- ✅ **Debugging mejorado**: Logs detallados y estructurados

## 🐛 **Debugging**

### Ver logs en tiempo real:
```bash
gcloud functions logs tail generate-book-cover --region=europe-west1
```

### Ver logs recientes:
```bash
gcloud functions logs read generate-book-cover --region=europe-west1 --limit=50
```

### Obtener URL de la función:
```bash
gcloud functions describe generate-book-cover --region=europe-west1 --format="value(httpsTrigger.url)"
```

### Probar la función:
```bash
curl -X POST https://europe-west1-export-document-project.cloudfunctions.net/generate-book-cover \
  -H "Content-Type: application/json" \
  -d '{"book_id":"test-book-id","job_id":"test-job-id"}'
```

## 🎯 **Solución a Problema de Duplicación**

Esta migración resuelve específicamente el problema reportado donde:
- ❌ **Antes**: Al completar capítulos se disparaba portada y se duplicaba todo el flujo
- ✅ **Ahora**: Control de estado evita regeneración y duplicación
- ✅ **Resultado**: Flujo limpio sin duplicación de contenido
