@echo off
echo.
echo === DESPLEGANDO GENERATE-BOOK-COVER (DEBUG) ===
echo Configuracion con logs detallados para debugging
echo.

REM Verificar variables de entorno
if "%SUPABASE_URL%"=="" (
    echo ERROR: Variable SUPABASE_URL no configurada
    pause
    exit /b 1
)

if "%SUPABASE_SERVICE_ROLE_KEY%"=="" (
    echo ERROR: Variable SUPABASE_SERVICE_ROLE_KEY no configurada
    pause
    exit /b 1
)

echo Desplegando funcion con configuracion debug...
echo.

gcloud functions deploy generate-book-cover ^
    --runtime=nodejs20 ^
    --trigger-http ^
    --allow-unauthenticated ^
    --entry-point=generateBookCover ^
    --memory=4GiB ^
    --timeout=540s ^
    --region=europe-west1 ^
    --max-instances=3 ^
    --set-env-vars="SUPABASE_URL=https://ydorhokujupnxpyrxczv.supabase.co/functions/v1 ,SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb3Job2t1anVwbnhweXJ4Y3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDEzMTA0MCwiZXhwIjoyMDU1NzA3MDQwfQ.PW51n-DXxQ9h7xONqIZXmPgryG09tHoVNk8Tw7msEps"" ^
    --verbosity=debug

echo.
echo === DIAGNOSTICO POST-DESPLIEGUE ===
echo.

echo 1. Verificando estado de la funcion:
gcloud functions describe generate-book-cover --region=europe-west1

echo.
echo 2. URL de la funcion:
echo https://europe-west1-export-document-project.cloudfunctions.net/generate-book-cover

echo.
echo 3. Para ver logs en tiempo real:
echo gcloud functions logs tail generate-book-cover --region=europe-west1

echo.
echo 4. Para probar la funcion:
echo curl -X POST https://europe-west1-export-document-project.cloudfunctions.net/generate-book-cover -H "Content-Type: application/json" -d "{\"book_id\":\"test\",\"job_id\":\"test\"}"

pause
