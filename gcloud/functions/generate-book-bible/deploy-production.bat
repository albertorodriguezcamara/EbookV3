@echo off
echo ========================================
echo   DESPLEGANDO GENERATE-BOOK-BIBLE
echo ========================================

echo [1/3] Verificando configuracion...
if not exist "index.js" (
    echo ERROR: index.js no encontrado
    exit /b 1
)

if not exist "package.json" (
    echo ERROR: package.json no encontrado
    exit /b 1
)

echo [2/3] Desplegando funcion a Google Cloud...
gcloud functions deploy generate-book-bible ^
    --runtime=nodejs20 ^
    --trigger-http ^
    --allow-unauthenticated ^
    --entry-point=generate-book-bible ^
    --memory=4GiB ^
    --timeout=540s ^
    --region=europe-west1 ^
    --max-instances=10 ^
    --set-env-vars="SUPABASE_URL=%SUPABASE_URL%,SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_SERVICE_ROLE_KEY%"

if %ERRORLEVEL% neq 0 (
    echo ERROR: Fallo en el despliegue
    exit /b 1
)

echo [3/3] Verificando despliegue...
gcloud functions describe generate-book-bible --region=europe-west1

echo.
echo ========================================
echo   DESPLIEGUE COMPLETADO EXITOSAMENTE
echo ========================================
echo URL: https://europe-west1-export-document-project.cloudfunctions.net/generate-book-bible
echo.

pause
