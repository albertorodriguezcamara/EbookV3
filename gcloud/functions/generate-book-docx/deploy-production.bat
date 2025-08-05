@echo off
echo Desplegando generate-book-docx a Google Cloud Functions...

REM Verificar que estamos en el directorio correcto
if not exist "index.js" (
    echo ERROR: No se encuentra index.js en el directorio actual
    echo Asegurate de ejecutar este script desde el directorio generate-book-docx
    pause
    exit /b 1
)

echo.
echo === DESPLEGANDO GENERATE-BOOK-DOCX ===
echo Configuracion optimizada para generacion DOCX:
echo - Memoria: 8GiB (para procesamiento de libros grandes)
echo - Timeout: 900s (15 minutos)
echo - Region: europe-west1
echo - Dependencias: docxtemplater, pizzip
echo.

REM Desplegar con configuración optimizada
gcloud functions deploy generate-book-docx ^
    --runtime=nodejs20 ^
    --trigger-http ^
    --allow-unauthenticated ^
    --entry-point=generate-book-docx ^
    --memory=8GiB ^
    --timeout=900s ^
    --region=europe-west1 ^
    --set-env-vars="SUPABASE_URL=https://ydorhokujupnxpyrxczv.supabase.co,SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb3Job2t1anVwbnhweXJ4Y3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDEzMTA0MCwiZXhwIjoyMDU1NzA3MDQwfQ.PW51n-DXxQ9h7xONqIZXmPgryG09tHoVNk8Tw7msEps" ^
    --max-instances=5

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Despliegue completado exitosamente!
    echo.
    echo URL de la función:
    gcloud functions describe generate-book-docx --region=europe-west1 --format="value(httpsTrigger.url)"
    echo.
    echo === CONFIGURACION APLICADA ===
    echo Memoria: 8GiB
    echo Timeout: 15 minutos
    echo Max Instancias: 5
    echo Dependencias: docxtemplater, pizzip
    echo Optimizada para generacion DOCX con IA
    echo.
) else (
    echo.
    echo ❌ Error en el despliegue. Revisa los logs arriba.
    echo.
)

pause
