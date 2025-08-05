@echo off
echo.
echo ========================================
echo  COMPLETAR CONTENIDO - MODO INDIVIDUAL
echo ========================================
echo.
echo Libro: Daily Grace: A 2025 Devotional
echo Capitulos restantes: 14 capitulos sin contenido
echo Modo: Procesamiento INDIVIDUAL (mas seguro)
echo.
echo IMPORTANTE: Este script procesa capitulos uno por uno para evitar timeouts
echo.
echo Enviando solicitud para procesamiento individual...
echo.

curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"book_id\":\"1c2c7a69-38f4-4ded-b02d-dfe462caec24\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"individual\",\"batch_size\":1}" ^
-w "\n\nCodigo de respuesta: %%{http_code}\nTiempo total: %%{time_total}s\n" ^
-v

echo.
echo ========================================
echo  PROCESO INDIVIDUAL COMPLETADO
echo ========================================
echo.
echo El sistema procesara los capitulos uno por uno
echo Esto es mas lento pero evita errores de timeout
echo.
echo Para monitorear progreso en tiempo real:
echo SELECT COUNT(CASE WHEN content IS NOT NULL AND content != '' THEN 1 END) as con_contenido, COUNT(*) as total FROM chapters WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24';
echo.
pause
