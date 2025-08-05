@echo off
setlocal

echo 🚀 DESPLEGANDO FUNCION EXPORT-DOCUMENT (PRODUCCION)
echo.

REM --- CONFIGURACION --- 
set "FUNCTION_NAME=export-document"
set "REGION=europe-west1"
set "MEMORY=1Gi"
set "TIMEOUT=300s"
set "RUNTIME=nodejs20"

REM --- VARIABLES DE ENTORNO ---
REM La variable CLOUDMERSIVE_API_KEY se gestiona directamente en Google Cloud.
set "SUPABASE_URL=https://ydorhokujupnxpyrxczv.supabase.co"
set "SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb3Job2t1anVwbnhweXJ4Y3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDEzMTA0MCwiZXhwIjoyMDU1NzA3MDQwfQ.PW51n-DXxQ9h7xONqIZXmPgryG09tHoVNk8Tw7msEps"

REM Verificar que estamos en el directorio correcto
if not exist "package.json" (
    echo ❌ Error: No se encuentra package.json. Ejecuta desde el directorio de la función.
    pause
    exit /b 1
)

echo 🚀 Desplegando función...

gcloud functions deploy %FUNCTION_NAME% ^
  --gen2 ^
  --runtime=%RUNTIME% ^
  --trigger-http ^
  --entry-point=%FUNCTION_NAME% ^
  --region=%REGION% ^
  --allow-unauthenticated ^
  --memory=%MEMORY% ^
  --cpu=1 ^
  --timeout=%TIMEOUT% ^
  --set-env-vars="SUPABASE_URL=https://ydorhokujupnxpyrxczv.supabase.co,SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_KEY%,CLOUDMERSIVE_API_KEY=77b66464-cb37-4352-b045-98f144620096"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ ¡FUNCION DESPLEGADA EXITOSAMENTE!
    echo.
    echo 🎯 CONFIGURACION APLICADA:
    echo    - Memoria: %MEMORY%
    echo    - Timeout: %TIMEOUT%
    echo    - Region:  %REGION%
    echo.
    echo 🌐 URL de la función:
    gcloud functions describe %FUNCTION_NAME% --region=%REGION% --gen2 --format="value(serviceConfig.uri)"
    echo.
    echo 📊 PARA VER LOGS:
    echo gcloud functions logs read %FUNCTION_NAME% --region=%REGION% --limit=20
) else (
    echo ❌ ERROR EN EL DESPLIEGUE!
    echo.
    echo 🔍 POSIBLES SOLUCIONES:
    echo 1. Revisa que has iniciado sesión con 'gcloud auth login'.
    echo 2. Confirma que el proyecto de gcloud es el correcto con 'gcloud config get-value project'.
    echo 3. Asegúrate de que la API de Cloud Functions (y Cloud Build) está habilitada en tu proyecto.
)

echo.
pause

