# Generate Book Outline - Google Cloud Function

Esta función migrada de Supabase Edge Functions a Google Cloud Functions se encarga de generar esquemas completos de libros usando IA.

## 🎯 **Propósito**

- Genera títulos y sinopsis para todos los capítulos de un libro
- Procesa libros grandes (hasta 150+ capítulos) sin timeouts
- Implementa procesamiento por lotes para optimizar rendimiento
- Maneja múltiples proveedores de IA (OpenAI, Gemini)
- Implementa reintentos automáticos con división de rangos si falla el parseo

## 📋 **Funcionalidades Principales**

### ✅ **Procesamiento por Lotes Inteligente**
- Procesa capítulos en lotes de 20 para evitar timeouts
- División automática de rangos si el parseo JSON falla
- Invocación recursiva para procesar libros grandes

### 🧠 **Generación de Esquemas IA**
- Construye prompts contextuales con:
  - Idea general del libro
  - Categoría y subcategoría
  - Instrucciones específicas por categoría
  - Idioma del libro
- Calcula tokens dinámicamente para optimizar respuestas
- Parseo robusto de respuestas JSON con fallbacks

### 📊 **Gestión de Progreso**
- Actualiza estado del job en tiempo real
- Registra logs de creación para el usuario
- Maneja errores y actualiza estado a "failed" si es necesario
- Progreso granular por lotes procesados

### 🔄 **Integración con Base de Datos**
- Inserta capítulos usando `upsert` para evitar duplicados
- Preserva contenido existente (solo actualiza título y sinopsis)
- Registra logs de prompts y respuestas para auditoría

## 🔧 **Configuración**

### Variables de Entorno Requeridas
```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
GCLOUD_FUNCTION_URL=https://europe-west1-export-document-project.cloudfunctions.net
```

### Especificaciones de la Función
- **Memoria**: 8GiB (necesario para libros de 150+ capítulos)
- **Timeout**: 900s (15 minutos)
- **Región**: europe-west1
- **Max Instancias**: 5 (control de concurrencia)

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
gcloud functions deploy generate-book-outline \
    --runtime=nodejs20 \
    --trigger=http \
    --allow-unauthenticated \
    --entry-point=generate-book-outline \
    --memory=8GiB \
    --timeout=900s \
    --region=europe-west1 \
    --set-env-vars="SUPABASE_URL=$SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY,GCLOUD_FUNCTION_URL=$GCLOUD_FUNCTION_URL"
```

## 📝 **Payload de Entrada**

```json
{
  "book_id": "uuid-del-libro",
  "job_id": "uuid-del-job",
  "start_chapter": 1,  // Opcional, por defecto 1
  "end_chapter": 20    // Opcional, se calcula automáticamente
}
```

## 📤 **Respuesta**

### Procesando Lote (202)
```json
{
  "success": true,
  "message": "Lote 1-20 procesado. Continuando..."
}
```

### Último Lote Completado (200)
```json
{
  "success": true,
  "message": "Outline generated and chapters created successfully."
}
```

### Error (500)
```json
{
  "error": "Descripción del error"
}
```

## 🔄 **Integración con Supabase**

La función se integra con las siguientes tablas de Supabase:

- **`books`**: Lee configuración del libro y atributos
- **`ai_models`** + **`ai_providers`**: Configuración de modelos de IA
- **`category_instructions`**: Instrucciones específicas por categoría
- **`chapters`**: Inserta títulos y sinopsis generados
- **`jobs`**: Actualiza progreso y estado
- **`creation_logs`**: Registra mensajes para el usuario
- **`ai_prompts_log`**: Guarda historial de prompts y respuestas

## ⚠️ **Consideraciones Importantes**

1. **Memoria Alta**: 8GiB necesarios para procesar libros de 150+ capítulos
2. **Timeout Extendido**: 15 minutos suficientes para el procesamiento completo
3. **Procesamiento por Lotes**: Divide automáticamente libros grandes en lotes de 20
4. **Reintentos Inteligentes**: División de rangos si falla el parseo JSON
5. **Invocación Recursiva**: Llama a sí misma para procesar lotes siguientes

## 🔗 **Migración desde Supabase**

Esta función reemplaza la Edge Function `generate-book-outline` de Supabase. Para completar la migración:

1. Desplegar esta función en Google Cloud
2. Actualizar las funciones orquestadoras en Supabase para llamar a esta URL
3. Configurar autenticación entre plataformas
4. Probar con libros de diferentes tamaños (especialmente 150+ capítulos)

## 📊 **Ventajas de la Migración**

- ✅ **Sin timeouts**: 15 minutos vs 5 minutos de Supabase
- ✅ **Más memoria**: 8GiB vs límites de Supabase
- ✅ **Mejor escalabilidad**: Procesamiento por lotes optimizado
- ✅ **Costos optimizados**: Pago por uso real
- ✅ **Manejo de libros grandes**: Hasta 150+ capítulos sin problemas

## 🔍 **Dependencias Migradas**

### AI Service
La función incluye una versión completa del servicio de IA (`callAI`) que soporta:
- **OpenAI**: GPT-3.5, GPT-4, etc.
- **Gemini**: Gemini Pro, Gemini Flash, etc.
- **Manejo de errores**: Reintentos y fallbacks automáticos
- **Logging detallado**: Para debugging y auditoría

## 🎯 **Casos de Uso Optimizados**

- **Libros cortos** (10-20 capítulos): Procesamiento en un solo lote
- **Libros medianos** (20-50 capítulos): 2-3 lotes, completado en ~5 minutos
- **Libros largos** (50-100 capítulos): 3-5 lotes, completado en ~10 minutos
- **Libros muy largos** (100-150+ capítulos): 5-8 lotes, completado en ~15 minutos

La función está específicamente optimizada para resolver los problemas de timeout que ocurrían con libros de 150 capítulos en Supabase Edge Functions.
