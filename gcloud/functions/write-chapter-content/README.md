# Write Chapter Content - Google Cloud Function

Esta función migrada de Supabase Edge Functions a Google Cloud Functions se encarga de escribir el contenido completo de capítulos usando IA.

## 🎯 **Propósito**

- Genera contenido de capítulos (1200-1800 palabras por defecto)
- Maneja múltiples proveedores de IA (OpenAI, Gemini)
- Implementa reintentos automáticos si falla el primer intento
- Actualiza progreso del job en tiempo real
- Registra logs detallados de prompts y respuestas

## 📋 **Funcionalidades Principales**

### ✅ **Verificación de Idempotencia**
- Verifica si el capítulo ya tiene contenido antes de procesar
- Evita duplicación de trabajo

### 🧠 **Generación de Contenido IA**
- Construye prompts contextuales con:
  - Título y sinopsis del capítulo
  - Idea general del libro
  - Atributos específicos del libro
  - Biblia del libro (personajes, lugares, etc.)
- Calcula tokens dinámicamente para optimizar respuestas
- Implementa reintentos con palabras reducidas si falla

### 📊 **Gestión de Progreso**
- Actualiza estado del job en tiempo real
- Registra logs de creación para el usuario
- Maneja errores y actualiza estado a "failed" si es necesario

## 🔧 **Configuración**

### Variables de Entorno Requeridas
```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### Especificaciones de la Función
- **Memoria**: 4GiB (necesario para procesamiento de IA)
- **Timeout**: 540s (9 minutos)
- **Región**: europe-west1
- **Max Instancias**: 10

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
gcloud functions deploy write-chapter-content \
    --runtime=nodejs20 \
    --trigger=http \
    --allow-unauthenticated \
    --entry-point=write-chapter-content \
    --memory=4GiB \
    --timeout=540s \
    --region=europe-west1 \
    --set-env-vars="SUPABASE_URL=$SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
```

## 📝 **Payload de Entrada**

```json
{
  "chapter_id": "uuid-del-capitulo",
  "job_id": "uuid-del-job"
}
```

## 📤 **Respuesta**

### Éxito
```json
{
  "success": true,
  "message": "Chapter uuid written successfully."
}
```

### Error
```json
{
  "error": "Descripción del error"
}
```

## 🔄 **Integración con Supabase**

La función se integra con las siguientes tablas de Supabase:

- **`chapters`**: Lee datos del capítulo y actualiza contenido
- **`books`**: Obtiene configuración del libro y atributos
- **`ai_models`** + **`ai_providers`**: Configuración de modelos de IA
- **`jobs`**: Actualiza progreso y estado
- **`creation_logs`**: Registra mensajes para el usuario
- **`ai_prompts_log`**: Guarda historial de prompts y respuestas

## ⚠️ **Consideraciones Importantes**

1. **Timeout**: La función tiene 9 minutos de timeout, suficiente para capítulos largos
2. **Memoria**: 4GiB necesarios para procesamiento de IA y manejo de respuestas largas
3. **Reintentos**: Implementa lógica de reintentos automáticos si falla el primer intento
4. **Tokens**: Calcula dinámicamente el presupuesto de tokens para evitar errores de límite

## 🔗 **Migración desde Supabase**

Esta función reemplaza la Edge Function `write-chapter-content` de Supabase. Para completar la migración:

1. Desplegar esta función en Google Cloud
2. Actualizar las funciones orquestadoras en Supabase para llamar a esta URL
3. Configurar autenticación entre plataformas
4. Probar con libros de diferentes tamaños

## 📊 **Ventajas de la Migración**

- ✅ **Sin timeouts**: 9 minutos vs 5 minutos de Supabase
- ✅ **Más memoria**: 4GiB vs límites de Supabase
- ✅ **Mejor escalabilidad**: Manejo de concurrencia mejorado
- ✅ **Costos optimizados**: Pago por uso real
