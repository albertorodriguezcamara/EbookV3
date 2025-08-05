@echo off
echo.
echo ========================================
echo  CONTINUANDO DESDE CAPITULO 261
echo ========================================
echo.
echo Libro: Daily Grace: A 2025 Devotional
echo Capitulos ya generados: 260 (1-260)
echo Continuando desde: Capitulo 261
echo Job ID: 0d977792-2f9a-4ab1-a415-61484efef236
echo.
echo IMPORTANTE: Este script continua el proceso sin perder el progreso anterior
echo.
echo Enviando solicitud para continuar...
echo.

curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/generate-book-outline" ^
-H "Content-Type: application/json" ^
-d "{\"book_id\":\"1c2c7a69-38f4-4ded-b02d-dfe462caec24\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"continue_from_chapter\":261}" ^
-w "\n\nCodigo de respuesta: %%{http_code}\nTiempo total: %%{time_total}s\n" ^
-v

echo.
echo ========================================
echo  PROCESO COMPLETADO
echo ========================================
echo.
echo El proceso deberia continuar desde el capitulo 261
echo Los capitulos 1-260 ya estan generados y NO se perdieron
echo.
echo Para monitorear el progreso:
echo SELECT status, status_message, progress_percentage FROM jobs WHERE id = '0d977792-2f9a-4ab1-a415-61484efef236';
echo.
echo Para verificar capitulos generados:
echo SELECT COUNT(*) as total_chapters, MAX(order_number) as ultimo_capitulo FROM chapters WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24';
echo.
pause
