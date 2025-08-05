@echo off
echo ========================================
echo   DESPLIEGUE DEBUG GENERATE-BOOK-BIBLE
echo ========================================

echo [DEBUG] Verificando variables de entorno...
if "%SUPABASE_URL%"=="" (
    echo WARNING: SUPABASE_URL no configurada
) else (
    echo OK: SUPABASE_URL configurada
)

if "%SUPABASE_SERVICE_ROLE_KEY%"=="" (
    echo WARNING: SUPABASE_SERVICE_ROLE_KEY no configurada
) else (
    echo OK: SUPABASE_SERVICE_ROLE_KEY configurada
)

echo.
echo [DEBUG] Verificando archivos...
dir /b *.js *.json

echo.
echo [DEBUG] Contenido de package.json:
type package.json

echo.
echo [DEBUG] Iniciando despliegue con logs detallados...
gcloud functions deploy generate-book-bible ^
    --runtime=nodejs20 ^
    --trigger-http ^
    --allow-unauthenticated ^
    --entry-point=generate-book-bible ^
    --memory=2GiB ^
    --timeout=540s ^
    --region=europe-west1 ^
    --set-env-vars="SUPABASE_URL=%SUPABASE_URL%,SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_SERVICE_ROLE_KEY%" ^
    --verbosity=debug

echo.
echo [DEBUG] Estado final de la funcion:
gcloud functions describe generate-book-bible --region=europe-west1

echo.
echo [DEBUG] Logs recientes:
gcloud functions logs read generate-book-bible --region=europe-west1 --limit=10

pause
