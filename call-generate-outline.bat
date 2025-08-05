@echo off
echo.
echo ========================================
echo  INICIANDO GENERACION DE ESQUEMA
echo ========================================
echo.
echo Libro: Daily Grace: A 2025 Devotional
echo Autor: J.D. Shepherd
echo Job ID: 0d977792-2f9a-4ab1-a415-61484efef236
echo.
echo Enviando solicitud...
echo.

curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/generate-book-outline" ^
-H "Content-Type: application/json" ^
-d "{\"book_id\":\"1c2c7a69-38f4-4ded-b02d-dfe462caec24\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\"}" ^
-w "\n\nCodigo de respuesta: %%{http_code}\nTiempo total: %%{time_total}s\n" ^
-v

echo.
echo ========================================
echo  PROCESO COMPLETADO
echo ========================================
echo.
echo Para monitorear el progreso, ejecuta esta consulta SQL:
echo SELECT status, status_message, progress_percentage FROM jobs WHERE id = '0d977792-2f9a-4ab1-a415-61484efef236';
echo.
pause
