@echo off
echo === DESPLEGANDO GENERATE-BOOK-COVER (SIMPLE) ===
echo.

set SUPABASE_URL=https://ydorhokujupnxpyrxczv.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb3Job2t1anVwbnhweXJ4Y3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDEzMTA0MCwiZXhwIjoyMDU1NzA3MDQwfQ.PW51n-DXxQ9h7xONqIZXmPgryG09tHoVNk8Tw7msEps

echo Desplegando funcion con variables de entorno...
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
    --set-env-vars="SUPABASE_URL=%SUPABASE_URL%,SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_SERVICE_ROLE_KEY%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ DESPLIEGUE EXITOSO
    echo.
    echo URL de la funcion:
    echo https://europe-west1-export-document-project.cloudfunctions.net/generate-book-cover
    echo.
) else (
    echo.
    echo ❌ ERROR EN EL DESPLIEGUE
    echo Codigo de error: %ERRORLEVEL%
    echo.
)

pause
