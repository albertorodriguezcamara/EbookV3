# Generate Book DOCX - Google Cloud Function

Esta función migrada de Supabase Edge Functions a Google Cloud Functions se encarga de generar documentos DOCX profesionales para libros usando IA y plantillas avanzadas.

## 🎯 **Propósito**

- Genera documentos DOCX completos con estilos profesionales
- Maneja múltiples proveedores de IA (OpenAI, Gemini) para personalización
- Implementa plantillas avanzadas con docxtemplater
- Sube archivos a Supabase Storage y genera URLs de descarga
- Actualiza progreso del job en tiempo real

## 📋 **Funcionalidades Principales**

### ✅ **Generación DOCX Avanzada**
- Plantillas profesionales con estilos KDP
- Soporte para dedicatorias, agradecimientos e ISBN
- Formateo automático de capítulos y contenido
- Configuración de página personalizable (6x9, 8.5x11, etc.)

### 🧠 **Integración con IA**
- Genera estilos personalizados usando IA
- Prompts contextuales basados en categoría del libro
- Fallback a plantillas por defecto si falla la IA
- Soporte para múltiples modelos de IA

### 📊 **Gestión de Progreso**
- Actualiza estado del job en tiempo real
- Progreso granular (5% → 30% → 60% → 80% → 100%)
- Manejo de errores y actualización a "failed" si es necesario
- Logging detallado para debugging

### 🔄 **Integración con Supabase**
- Consulta datos del libro y capítulos
- Sube archivos a Supabase Storage
- Genera URLs firmadas para descarga
- Actualiza tabla `export_jobs` con resultados

## 🔧 **Configuración**

### Variables de Entorno Requeridas
```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### Especificaciones de la Función
- **Memoria**: 8GiB (necesario para procesamiento DOCX y IA)
- **Timeout**: 900s (15 minutos)
- **Región**: europe-west1
- **Max Instancias**: 5

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
gcloud functions deploy generate-book-docx \
    --runtime=nodejs20 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point=generate-book-docx \
    --memory=8GiB \
    --timeout=900s \
    --region=europe-west1 \
    --set-env-vars="SUPABASE_URL=$SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
```

## 📝 **Payload de Entrada**

```json
{
  "record": {
    "id": "uuid-del-job",
    "book_id": "uuid-del-libro",
    "user_id": "uuid-del-usuario",
    "format": "DOCX",
    "page_size": "6x9",
    "dedication": "Texto opcional",
    "acknowledgments": "Texto opcional",
    "isbn": "ISBN opcional",
    "editor_model_id": "uuid-del-modelo-ia"
  }
}
```

## 📤 **Respuesta**

### Éxito
```json
{
  "success": true,
  "message": "DOCX generated successfully in Google Cloud",
  "result": {
    "docxPath": "docx/user_id/filename.docx",
    "fileName": "filename.docx",
    "method": "Google Cloud"
  }
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

- **`export_jobs`**: Actualiza progreso y estado del job
- **`books`**: Lee datos del libro (título, autor, categoría)
- **`chapters`**: Obtiene contenido de capítulos ordenados
- **`ai_models`** + **`ai_providers`**: Configuración de modelos de IA
- **`storage.exports`**: Sube archivos DOCX generados

## ⚠️ **Consideraciones Importantes**

1. **Memoria Alta**: 8GiB necesarios para procesamiento DOCX y llamadas IA
2. **Timeout Extendido**: 15 minutos suficientes para libros de 150+ capítulos
3. **Dependencias**: docxtemplater y pizzip para generación DOCX
4. **Storage**: Archivos se suben a bucket 'exports' en Supabase
5. **URLs Firmadas**: 24 horas de validez para descarga

## 🔗 **Migración desde Supabase**

Esta función reemplaza la Edge Function `generate-book-docx` de Supabase. Para completar la migración:

1. Desplegar esta función en Google Cloud
2. Actualizar `handle-export-request` para llamar a esta URL
3. Actualizar `export-document` para usar la nueva URL
4. Probar con libros de diferentes tamaños

## 📊 **Ventajas de la Migración**

- ✅ **Sin timeouts**: 15 minutos vs 5 minutos de Supabase
- ✅ **Más memoria**: 8GiB vs límites de Supabase  
- ✅ **Mejor rendimiento**: CPU y recursos dedicados
- ✅ **Costos optimizados**: Pago por uso real
- ✅ **Escalabilidad**: Manejo mejorado de concurrencia

## 🐛 **Debugging**

### Ver logs en tiempo real:
```bash
gcloud functions logs tail generate-book-docx --region=europe-west1
```

### Ver logs recientes:
```bash
gcloud functions logs read generate-book-docx --region=europe-west1 --limit=50
```

### Obtener URL de la función:
```bash
gcloud functions describe generate-book-docx --region=europe-west1 --format="value(httpsTrigger.url)"
```

## 🔄 **Flujo de Trabajo**

1. **Frontend** → `handle-export-request` → **Google Cloud Functions**
2. **Función** lee datos del libro y capítulos de Supabase
3. **Genera estilos** usando IA (opcional) o plantillas por defecto
4. **Crea DOCX** usando docxtemplater con contenido estructurado
5. **Sube archivo** a Supabase Storage
6. **Genera URL** firmada para descarga
7. **Actualiza job** como completado con URL de descarga

La función está optimizada para libros grandes y proporciona una experiencia de usuario fluida con actualizaciones de progreso en tiempo real.
