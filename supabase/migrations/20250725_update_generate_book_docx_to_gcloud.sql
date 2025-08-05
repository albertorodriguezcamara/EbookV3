-- Migración: Actualización de referencias de generate-book-docx a Google Cloud Functions
-- Fecha: 2025-07-25
-- Descripción: Documenta la migración de generate-book-docx de Supabase Edge Functions a Google Cloud Functions

/*
CAMBIOS REALIZADOS:

1. FUNCIÓN MIGRADA:
   - generate-book-docx migrada de Supabase Edge Functions a Google Cloud Functions
   - Nueva URL: https://europe-west1-export-document-project.cloudfunctions.net/generate-book-docx
   - Configuración optimizada: 8GiB memoria, 15 min timeout

2. REFERENCIAS ACTUALIZADAS:

   a) handle-export-request/index.ts (línea 94-96):
      ANTES: supabase.functions.invoke('generate-book-docx', { body: { record: job } })
      DESPUÉS: fetch('https://europe-west1-export-document-project.cloudfunctions.net/generate-book-docx', ...)

   b) export-document/index.js (línea 55-58):
      ANTES: const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/generate-book-docx`;
      DESPUÉS: const googleCloudUrl = 'https://europe-west1-export-document-project.cloudfunctions.net/generate-book-docx';

3. FUNCIONES AFECTADAS:
   - ✅ handle-export-request: Actualizada para llamar a Google Cloud
   - ✅ export-document: Actualizada para llamar a Google Cloud
   - ❌ generate-book-docx (Supabase): Ya no se usa, puede ser eliminada

4. VENTAJAS DE LA MIGRACIÓN:
   - Sin timeouts para libros grandes (15 min vs 5 min)
   - 8GiB de memoria vs límites de Supabase
   - Mejor rendimiento y escalabilidad
   - Costos optimizados por uso real

5. FUNCIONES RESTANTES EN SUPABASE:
   - initiate-book-creation (ligera, no requiere migración)
   - handle-book-creation-request (orquestación, no requiere migración)
   - ai-service (ligera, no requiere migración)
   - generate-book-cover (candidata para futura migración)
   - generate-sudoku (independiente del sistema de libros)
   - upload-to-gcs (ligera, no requiere migración)
   - debug-trigger (debugging, no requiere migración)

NOTAS IMPORTANTES:
- La función generate-book-docx en Supabase ya no recibe llamadas
- Todas las exportaciones DOCX ahora se procesan en Google Cloud Functions
- El flujo de trabajo completo sigue siendo: Frontend → handle-export-request → Google Cloud Functions
- Los jobs se siguen gestionando en la tabla export_jobs de Supabase
- Los archivos DOCX se siguen subiendo a Supabase Storage

PRÓXIMOS PASOS:
1. Desplegar la función generate-book-docx en Google Cloud
2. Probar la exportación DOCX end-to-end
3. Monitorear logs y rendimiento
4. Considerar eliminar la Edge Function no utilizada
*/

-- Esta migración es solo documentativa, no requiere cambios en la base de datos
SELECT 'generate-book-docx migration to Google Cloud Functions completed' as status;
