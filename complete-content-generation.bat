@echo off
echo.
echo ========================================
echo  COMPLETAR GENERACION DE CONTENIDO
echo ========================================
echo.
echo Libro: Daily Grace: A 2025 Devotional
echo Capitulos con contenido: 351/365 (96.16%%)
echo Capitulos sin contenido: 14 (3.84%%)
echo.
echo Capitulos a procesar:
echo 16, 27, 39, 84, 109, 111, 202, 228, 234, 246, 256, 323, 328, 346
echo.
echo IMPORTANTE: Este script procesara los capitulos restantes por lotes
echo.
echo Enviando solicitud para procesar contenido...
echo.

curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"book_id\":\"1c2c7a69-38f4-4ded-b02d-dfe462caec24\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"batch\",\"batch_size\":5}" ^
-w "\n\nCodigo de respuesta: %%{http_code}\nTiempo total: %%{time_total}s\n" ^
-v

echo.
echo ========================================
echo  PROCESO COMPLETADO
echo ========================================
echo.
echo El sistema deberia procesar los 14 capitulos restantes
echo Progreso esperado: 365/365 capitulos (100%%)
echo.
echo Para verificar progreso:
echo SELECT COUNT(CASE WHEN content IS NOT NULL AND content != '' THEN 1 END) as con_contenido FROM chapters WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24';
echo.
pause
