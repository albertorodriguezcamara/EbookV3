@echo off
echo Desplegando generate-book-docx con logs de debug...

REM Verificar que estamos en el directorio correcto
if not exist "index.js" (
    echo ERROR: No se encuentra index.js en el directorio actual
    pause
    exit /b 1
)

echo.
echo === DESPLEGANDO GENERATE-BOOK-DOCX (DEBUG MODE) ===
echo Configuracion con logs detallados para debugging
echo.

REM Desplegar con logs de debug
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
    echo ✅ Despliegue completado!
    echo.
    echo === COMANDOS DE DEBUG ===
    echo Ver logs en tiempo real:
    echo gcloud functions logs tail generate-book-docx --region=europe-west1
    echo.
    echo Ver logs recientes:
    echo gcloud functions logs read generate-book-docx --region=europe-west1 --limit=50
    echo.
    echo URL de la función:
    gcloud functions describe generate-book-docx --region=europe-west1 --format="value(httpsTrigger.url)"
    echo.
) else (
    echo ❌ Error en el despliegue
)

pause
